// Wire protocol shared with the ws-scrcpy server.
// Copied (not imported) from `src/types/*` and `src/common/ControlCenterCommand.ts` in the repo root,
// because the root tree is compiled with a different TypeScript setup. Keep the string values in sync.

export interface NetInterface {
    name: string;
    ipv4: string;
}

export interface GoogDeviceDescriptor {
    udid: string;
    state: string;
    'ro.build.version.release': string;
    'ro.build.version.sdk': string;
    'ro.product.cpu.abi': string;
    'ro.product.manufacturer': string;
    'ro.product.model': string;
    'wifi.interface': string;
    interfaces: NetInterface[];
    pid: number;
    'last.update.timestamp': number;
}

export const DeviceState = {
    DEVICE: 'device',
    OFFLINE: 'offline',
    UNAUTHORIZED: 'unauthorized',
    DISCONNECTED: 'disconnected',
} as const;

export interface Message<T = unknown> {
    id: number;
    type: string;
    data: T;
}

export interface DeviceTrackerEventList {
    id: string;
    name: string;
    list: GoogDeviceDescriptor[];
}

export interface DeviceTrackerEvent {
    id: string;
    name: string;
    device: GoogDeviceDescriptor;
}

/** A device that has been online at least once (`<WS_SCRCPY_DATA_DIR>/devices.json` on the server). */
export interface DeviceHistoryEntry {
    udid: string;
    alias: string;
    manufacturer: string;
    model: string;
    release: string;
    sdk: string;
    firstSeen: number;
    lastSeen: number;
}

export interface DeviceHistoryEvent {
    list: DeviceHistoryEntry[];
}

export const ServerMessageType = {
    DEVICE_LIST: 'devicelist',
    DEVICE: 'device',
    HISTORY: 'history',
    RESPONSE: 'response',
} as const;

export const Command = {
    ADB_CONNECT: 'adb_connect',
    ADB_DISCONNECT: 'adb_disconnect',
    ADB_KILL_SERVER: 'adb_kill_server',
    DEVICE_SET_ALIAS: 'device_set_alias',
    DEVICE_FORGET: 'device_forget',
    DEVICE_REORDER: 'device_reorder',
} as const;

export type CommandType = (typeof Command)[keyof typeof Command];

export interface ControlCenterResponseData {
    command: string;
    success: boolean;
    message?: string;
}

export const ACTION = {
    GOOG_DEVICE_LIST: 'goog-device-list',
    PROXY_ADB: 'proxy-adb',
    STREAM_SCRCPY: 'stream',
} as const;

/** Port the scrcpy server listens on inside the device (see `src/common/Constants.ts`). */
export const SCRCPY_SERVER_PORT = 8886;
export const DEFAULT_ADB_PORT = 5555;

export const PLAYERS = [
    { code: 'mse', name: 'MSE (H.264)' },
    { code: 'webcodecs', name: 'WebCodecs' },
    { code: 'tinyh264', name: 'TinyH264' },
    { code: 'broadway', name: 'Broadway' },
] as const;

export type PlayerCode = (typeof PLAYERS)[number]['code'];
