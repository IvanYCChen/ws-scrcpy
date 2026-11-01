<script setup lang="ts">
import '@xterm/xterm/css/xterm.css';
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Eraser, RotateCw } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { deviceTitle } from '@/lib/device';
import { buildShellUrl, describeClose, resizeMessage, SPECIAL_KEYS, startMessage } from '@/lib/shell';
import type { GoogDeviceDescriptor } from '@/types/protocol';
import { useDeviceTracker } from '@/composables/useDeviceTracker';

type Status = 'connecting' | 'open' | 'closed';

const props = defineProps<{ device: GoogDeviceDescriptor }>();
const open = defineModel<boolean>('open', { default: false });

const { history } = useDeviceTracker();
const title = computed(() => history.get(props.device.udid)?.alias || deviceTitle(props.device));

// Only rendered while the dialog is open, so the terminal lives exactly as long as this element.
const container = ref<HTMLElement | null>(null);
const term = shallowRef<Terminal | null>(null);
const status = ref<Status>('connecting');
const closeMessage = ref('');

let fit: FitAddon | null = null;
let socket: WebSocket | null = null;
let observer: ResizeObserver | null = null;
let size = { cols: 0, rows: 0 };

function send(data: string | Uint8Array): void {
    if (socket?.readyState === WebSocket.OPEN) {
        socket.send(data);
    }
}

function fitAndResize(): void {
    if (!term.value || !fit) {
        return;
    }
    fit.fit();
    const { cols, rows } = term.value;
    if (cols !== size.cols || rows !== size.rows) {
        size = { cols, rows };
        send(resizeMessage(cols, rows));
    }
}

function connect(): void {
    const terminal = term.value;
    if (!terminal) {
        return;
    }
    socket?.close();
    status.value = 'connecting';
    closeMessage.value = '';
    const ws = new WebSocket(buildShellUrl());
    ws.binaryType = 'arraybuffer';
    socket = ws;
    ws.onopen = () => {
        fit?.fit();
        size = { cols: terminal.cols, rows: terminal.rows };
        ws.send(startMessage(props.device.udid, size.cols, size.rows));
        status.value = 'open';
        terminal.focus();
    };
    ws.onmessage = (event) => {
        terminal.write(typeof event.data === 'string' ? event.data : new Uint8Array(event.data));
    };
    ws.onclose = (event) => {
        if (socket !== ws) {
            return;
        }
        socket = null;
        status.value = 'closed';
        closeMessage.value = describeClose(event);
        terminal.write(`\r\n\x1b[90m[${closeMessage.value}]\x1b[0m\r\n`);
    };
}

function reconnect(): void {
    term.value?.reset();
    connect();
}

function stop(): void {
    observer?.disconnect();
    observer = null;
    const ws = socket;
    socket = null;
    ws?.close();
    term.value?.dispose();
    term.value = null;
    fit = null;
}

watch(container, (element) => {
    stop();
    if (!element) {
        return;
    }
    const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
        scrollback: 5000,
        theme: { background: '#0a0a0a' },
    });
    fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(element);
    terminal.onData((data) => send(data));
    term.value = terminal;
    fit.fit();
    observer = new ResizeObserver(() => fitAndResize());
    observer.observe(element);
    connect();
});

onBeforeUnmount(stop);

function sendKey(data: string): void {
    send(data);
    term.value?.focus();
}

// Esc belongs to the shell (vi, less…) while the terminal has focus; the close button still works.
function onEscape(event: KeyboardEvent): void {
    if (container.value?.contains(document.activeElement)) {
        event.preventDefault();
    }
}

const statusText = computed(() => {
    switch (status.value) {
        case 'connecting':
            return '連線中…';
        case 'open':
            return '已連線';
        default:
            return closeMessage.value || '已中斷';
    }
});
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent
            class="flex h-[92dvh] flex-col gap-3 overflow-hidden p-4 sm:h-[80dvh] sm:max-w-4xl sm:p-6"
            @escape-key-down="onEscape"
            @open-auto-focus.prevent
        >
            <DialogHeader class="pr-6">
                <DialogTitle class="truncate">{{ title }} 的 ADB Shell</DialogTitle>
                <DialogDescription class="flex items-center gap-2 truncate">
                    <span
                        class="inline-block size-2 shrink-0 rounded-full"
                        :class="{
                            'bg-success': status === 'open',
                            'animate-pulse bg-muted-foreground': status === 'connecting',
                            'bg-destructive': status === 'closed',
                        }"
                    />
                    <span class="truncate">{{ device.udid }} · {{ statusText }}</span>
                </DialogDescription>
            </DialogHeader>

            <div class="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" :disabled="status === 'connecting'" @click="reconnect">
                    <RotateCw />
                    重新連線
                </Button>
                <Button size="sm" variant="outline" :disabled="!term" @click="term?.clear()">
                    <Eraser />
                    清除畫面
                </Button>
            </div>

            <div class="min-h-0 flex-1 overflow-hidden rounded-md border bg-[#0a0a0a] p-2">
                <div ref="container" class="size-full" />
            </div>

            <div class="flex flex-wrap gap-1.5">
                <Button
                    v-for="key in SPECIAL_KEYS"
                    :key="key.label"
                    size="sm"
                    variant="secondary"
                    class="h-7 min-w-9 px-2 font-mono text-xs"
                    :disabled="status !== 'open'"
                    @click="sendKey(key.data)"
                >
                    {{ key.label }}
                </Button>
            </div>
        </DialogContent>
    </Dialog>
</template>
