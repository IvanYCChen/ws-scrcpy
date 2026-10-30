import { ACTION, PLAYERS, SCRCPY_SERVER_PORT, type PlayerCode } from '@/types/protocol';

/** WebSocket URL of the plain-JSON device tracker (`?action=goog-device-list`). */
export function buildTrackerUrl(): string {
    if (import.meta.env.VITE_WS_URL) {
        return import.meta.env.VITE_WS_URL;
    }
    const url = new URL(location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    // The server only looks at `?action=`; the path is ignored, so keeping the current pathname works for any PATHNAME.
    url.search = `?action=${ACTION.GOOG_DEVICE_LIST}`;
    url.hash = '';
    return url.toString();
}

/** Base URL of the main ws-scrcpy UI (the admin lives one level below it at `<PATHNAME>admin/`). */
export function appBaseUrl(): URL {
    if (import.meta.env.VITE_APP_BASE) {
        return new URL(import.meta.env.VITE_APP_BASE, location.href);
    }
    if (import.meta.env.DEV) {
        return new URL('http://localhost:8000/');
    }
    return new URL('../', location.href);
}

const TCP_UDID = /^(\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-f:]+\]|[a-z0-9-]+(?:\.[a-z0-9-]+)+):(\d{1,5})$/i;

/** `192.168.1.10:5555`, `[::1]:5555` or `phone.lan:5555` → a device connected over TCP/IP. */
export function isTcpUdid(udid: string): boolean {
    return TCP_UDID.test(udid);
}

export function splitTcpUdid(udid: string): { host: string; port: number } | null {
    const match = TCP_UDID.exec(udid);
    if (!match) {
        return null;
    }
    return { host: match[1], port: Number(match[2]) };
}

export function isPlayerCode(value: string): value is PlayerCode {
    return PLAYERS.some((p) => p.code === value);
}

/**
 * Link to the existing player page, in the same format as `BaseDeviceTracker.buildLink`:
 * `<base>#!action=stream&udid=…&player=…&ws=<ws url via proxy-adb>&fitToScreen=true`
 */
export function buildStreamLink(udid: string, player: PlayerCode = 'mse'): string {
    const base = appBaseUrl();
    const ws = new URL(base.toString());
    ws.protocol = ws.protocol === 'https:' ? 'wss:' : 'ws:';
    ws.search = new URLSearchParams({
        action: ACTION.PROXY_ADB,
        remote: `tcp:${SCRCPY_SERVER_PORT}`,
        udid,
    }).toString();
    const query = new URLSearchParams({
        action: ACTION.STREAM_SCRCPY,
        udid,
        player,
        ws: ws.toString(),
        fitToScreen: 'true',
    });
    return `${base.toString()}#!${query.toString()}`;
}
