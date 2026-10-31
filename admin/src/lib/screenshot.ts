// Client for the server's `<PATHNAME>api/screenshot` endpoint (src/server/goog-device/ScreenshotApi.ts).

export async function captureScreenshot(udid: string): Promise<Blob> {
    const url = new URL('api/screenshot', location.href);
    url.search = new URLSearchParams({ udid, t: String(Date.now()) }).toString();
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    return response.blob();
}

/** `screenshot-Pixel 7-20261031-142530.png`, with characters that are invalid in file names replaced. */
export function screenshotFileName(name: string, time: Date): string {
    const pad = (value: number): string => String(value).padStart(2, '0');
    const date = `${time.getFullYear()}${pad(time.getMonth() + 1)}${pad(time.getDate())}`;
    const clock = `${pad(time.getHours())}${pad(time.getMinutes())}${pad(time.getSeconds())}`;
    const safeName = name.replace(/[\\/:*?"<>|]+/g, '_').trim();
    return `screenshot-${safeName}-${date}-${clock}.png`;
}
