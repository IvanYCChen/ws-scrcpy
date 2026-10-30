import { computed, reactive, ref, watch } from 'vue';
import { createSharedComposable, tryOnScopeDispose, useDocumentVisibility } from '@vueuse/core';
import { buildTrackerUrl } from '@/lib/ws';
import { useAuth } from '@/composables/useAuth';
import {
    Command,
    DeviceState,
    ServerMessageType,
    type ControlCenterResponseData,
    type DeviceHistoryEntry,
    type DeviceHistoryEvent,
    type DeviceTrackerEvent,
    type DeviceTrackerEventList,
    type GoogDeviceDescriptor,
    type Message,
} from '@/types/protocol';

export type TrackerStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

interface PendingCommand {
    resolve: (data: ControlCenterResponseData) => void;
    reject: (error: Error) => void;
    timer: number;
}

const MAX_RECONNECT_DELAY = 30_000;
const COMMAND_TIMEOUT = 20_000;

function stateRank(state: string): number {
    switch (state) {
        case DeviceState.DEVICE:
            return 0;
        case DeviceState.DISCONNECTED:
            return 2;
        default:
            return 1;
    }
}

function compareDevices(a: GoogDeviceDescriptor, b: GoogDeviceDescriptor): number {
    const rank = stateRank(a.state) - stateRank(b.state);
    if (rank !== 0) {
        return rank;
    }
    return a.udid.localeCompare(b.udid);
}

/** Placeholder descriptor for a remembered device that the adb server does not currently know about. */
function historyDescriptor(entry: DeviceHistoryEntry): GoogDeviceDescriptor {
    return {
        udid: entry.udid,
        state: DeviceState.DISCONNECTED,
        'ro.build.version.release': entry.release,
        'ro.build.version.sdk': entry.sdk,
        'ro.product.cpu.abi': '',
        'ro.product.manufacturer': entry.manufacturer,
        'ro.product.model': entry.model,
        'wifi.interface': '',
        interfaces: [],
        pid: -1,
        'last.update.timestamp': entry.lastSeen,
    };
}

function useDeviceTrackerImpl() {
    const url = buildTrackerUrl();
    const status = ref<TrackerStatus>('connecting');
    const attempt = ref(0);
    const trackerName = ref('');
    const lastError = ref<string | null>(null);
    const devices = reactive(new Map<string, GoogDeviceDescriptor>());
    const history = reactive(new Map<string, DeviceHistoryEntry>());
    const pending = new Map<number, PendingCommand>();

    let ws: WebSocket | null = null;
    let nextId = 1;
    let reconnectTimer: number | undefined;
    let disposed = false;

    // Live devices plus remembered ones that are not connected, so they can be reconnected after a restart.
    const deviceList = computed(() => {
        const list = Array.from(devices.values());
        for (const entry of history.values()) {
            if (!devices.has(entry.udid)) {
                list.push(historyDescriptor(entry));
            }
        }
        return list.sort(compareDevices);
    });
    const isOpen = computed(() => status.value === 'open');

    function clearReconnect(): void {
        if (reconnectTimer !== undefined) {
            window.clearTimeout(reconnectTimer);
            reconnectTimer = undefined;
        }
    }

    function rejectAllPending(error: Error): void {
        for (const [id, item] of pending) {
            window.clearTimeout(item.timer);
            item.reject(error);
            pending.delete(id);
        }
    }

    function scheduleReconnect(): void {
        if (disposed || reconnectTimer !== undefined) {
            return;
        }
        status.value = 'reconnecting';
        const delay = Math.min(1000 * 2 ** attempt.value, MAX_RECONNECT_DELAY) + Math.random() * 500;
        attempt.value += 1;
        reconnectTimer = window.setTimeout(() => {
            reconnectTimer = undefined;
            connect();
        }, delay);
    }

    function handleMessage(raw: string): void {
        let message: Message;
        try {
            message = JSON.parse(raw);
        } catch {
            console.warn('[tracker] invalid JSON', raw);
            return;
        }
        if (typeof message.id === 'number' && message.id > 0 && pending.has(message.id)) {
            const item = pending.get(message.id)!;
            pending.delete(message.id);
            window.clearTimeout(item.timer);
            const data = (message.data ?? {}) as Partial<ControlCenterResponseData>;
            if (data.success) {
                item.resolve({ command: data.command ?? '', success: true, message: data.message });
            } else {
                item.reject(new Error(data.message || '指令執行失敗'));
            }
            return;
        }
        switch (message.type) {
            case ServerMessageType.DEVICE_LIST: {
                const event = message.data as DeviceTrackerEventList;
                trackerName.value = event.name;
                devices.clear();
                for (const device of event.list) {
                    devices.set(device.udid, device);
                }
                break;
            }
            case ServerMessageType.DEVICE: {
                const event = message.data as DeviceTrackerEvent;
                trackerName.value = event.name;
                devices.set(event.device.udid, event.device);
                break;
            }
            case ServerMessageType.HISTORY: {
                const event = message.data as DeviceHistoryEvent;
                history.clear();
                for (const entry of event.list) {
                    history.set(entry.udid, entry);
                }
                break;
            }
            default:
                break;
        }
    }

    function connect(): void {
        if (disposed) {
            return;
        }
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            return;
        }
        clearReconnect();
        status.value = attempt.value === 0 ? 'connecting' : 'reconnecting';
        const socket = new WebSocket(url);
        ws = socket;
        socket.onopen = () => {
            if (ws !== socket) {
                return;
            }
            status.value = 'open';
            attempt.value = 0;
            lastError.value = null;
        };
        socket.onmessage = (event) => {
            if (ws === socket && typeof event.data === 'string') {
                handleMessage(event.data);
            }
        };
        socket.onerror = () => {
            if (ws === socket) {
                lastError.value = '無法連線到 ws-scrcpy 伺服器';
            }
        };
        socket.onclose = (event) => {
            if (ws !== socket) {
                return;
            }
            ws = null;
            rejectAllPending(new Error('與伺服器的連線已中斷'));
            if (disposed) {
                status.value = 'closed';
                return;
            }
            // 4401: the session expired or the password was changed elsewhere; App.vue switches to the login screen.
            if (event.code === 4401) {
                status.value = 'closed';
                void useAuth().refresh();
                return;
            }
            scheduleReconnect();
        };
    }

    function send(
        type: string,
        data: Record<string, unknown>,
        timeoutMs = COMMAND_TIMEOUT,
    ): Promise<ControlCenterResponseData> {
        return new Promise((resolve, reject) => {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                reject(new Error('尚未連線到伺服器'));
                return;
            }
            const id = nextId++;
            const timer = window.setTimeout(() => {
                pending.delete(id);
                reject(new Error('伺服器逾時未回應'));
            }, timeoutMs);
            pending.set(id, { resolve, reject, timer });
            ws.send(JSON.stringify({ id, type, data }));
        });
    }

    function adbConnect(host: string, port: number): Promise<ControlCenterResponseData> {
        return send(Command.ADB_CONNECT, { host, port });
    }

    function adbDisconnect(host: string, port: number): Promise<ControlCenterResponseData> {
        return send(Command.ADB_DISCONNECT, { host, port });
    }

    function adbKillServer(): Promise<ControlCenterResponseData> {
        return send(Command.ADB_KILL_SERVER, {});
    }

    function setAlias(udid: string, alias: string): Promise<ControlCenterResponseData> {
        return send(Command.DEVICE_SET_ALIAS, { udid, alias });
    }

    function forgetDevice(udid: string): Promise<ControlCenterResponseData> {
        return send(Command.DEVICE_FORGET, { udid });
    }

    function reconnectNow(): void {
        if (ws && ws.readyState === WebSocket.OPEN) {
            return;
        }
        clearReconnect();
        attempt.value = 0;
        if (ws) {
            const old = ws;
            ws = null;
            try {
                old.close();
            } catch {
                // ignore
            }
        }
        connect();
    }

    const visibility = useDocumentVisibility();
    watch(visibility, (value) => {
        if (value === 'visible' && status.value === 'reconnecting') {
            reconnectNow();
        }
    });

    connect();

    tryOnScopeDispose(() => {
        disposed = true;
        clearReconnect();
        rejectAllPending(new Error('已關閉'));
        if (ws) {
            const old = ws;
            ws = null;
            old.close();
        }
        status.value = 'closed';
    });

    return {
        url,
        status,
        isOpen,
        attempt,
        trackerName,
        lastError,
        devices,
        history,
        deviceList,
        send,
        adbConnect,
        adbDisconnect,
        adbKillServer,
        setAlias,
        forgetDevice,
        reconnectNow,
    };
}

export const useDeviceTracker = createSharedComposable(useDeviceTrackerImpl);
