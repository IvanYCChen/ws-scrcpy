// Client side of the server's remote shell (`?action=shell`, src/server/goog-device/mw/RemoteShell.ts):
// the first text frame is a JSON `start` message, after that text frames are keystrokes and the
// server answers with raw terminal output. A binary frame carries a JSON control message (resize).

import { ACTION } from '@/types/protocol';
import { buildTrackerUrl } from '@/lib/ws';

/** Same host and path as the tracker socket (the server routes by `?action=` only). */
export function buildShellUrl(): string {
    const url = new URL(buildTrackerUrl());
    url.search = `?action=${ACTION.SHELL}`;
    url.hash = '';
    return url.toString();
}

export function startMessage(udid: string, cols: number, rows: number): string {
    return JSON.stringify({ id: 1, type: 'shell', data: { type: 'start', udid, cols, rows } });
}

export function resizeMessage(cols: number, rows: number): Uint8Array {
    return new TextEncoder().encode(JSON.stringify({ id: 0, type: 'shell', data: { type: 'resize', cols, rows } }));
}

/** Keys that are hard or impossible to type on a phone keyboard. */
export const SPECIAL_KEYS = [
    { label: 'Ctrl+C', data: '\x03' },
    { label: 'Ctrl+D', data: '\x04' },
    { label: 'Tab', data: '\t' },
    { label: 'Esc', data: '\x1b' },
    { label: '↑', data: '\x1b[A' },
    { label: '↓', data: '\x1b[B' },
    { label: '←', data: '\x1b[D' },
    { label: '→', data: '\x1b[C' },
] as const;

/** Close reasons sent by the server, mapped to something readable. */
export function describeClose(event: CloseEvent): string {
    if (event.code === 4401) {
        return '未登入或登入已過期';
    }
    if (event.code === 4002) {
        return '伺服器未啟用 ADB Shell';
    }
    const exit = /exited with code: (-?\d+)/.exec(event.reason);
    if (exit) {
        return `Shell 已結束（代碼 ${exit[1]}）`;
    }
    return event.reason || `連線已中斷（${event.code}）`;
}
