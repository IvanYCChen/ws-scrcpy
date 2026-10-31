// Client for the server's `<PATHNAME>api/files/*` endpoints (src/server/goog-device/FileApi.ts).

export type FileEntryType = 'dir' | 'file' | 'link' | 'other';

export interface FileEntry {
    name: string;
    type: FileEntryType;
    size: number;
    mtime: number;
}

export interface FileListing {
    path: string;
    entries: FileEntry[];
}

function filesUrl(name: string, udid: string, path: string): string {
    const url = new URL(`api/files/${name}`, location.href);
    url.search = new URLSearchParams({ udid, path }).toString();
    return url.toString();
}

export async function listFiles(udid: string, path: string): Promise<FileListing> {
    const response = await fetch(filesUrl('list', udid, path), { credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data as FileListing;
}

/**
 * The server streams the file with `Content-Disposition: attachment`, so the browser saves it without leaving the page.
 * A plain link would save the server's error JSON as the file, so the request is probed first: the server only answers
 * once the pull has really started, and the probe is aborted before the body is read.
 */
export async function downloadFile(udid: string, path: string): Promise<void> {
    const url = filesUrl('download', udid, path);
    const controller = new AbortController();
    const response = await fetch(url, { credentials: 'same-origin', signal: controller.signal });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    controller.abort();
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    a.click();
}

export function joinPath(dir: string, name: string): string {
    return `${dir.replace(/\/+$/, '')}/${name}`;
}

export function parentPath(path: string): string {
    const trimmed = path.replace(/\/+$/, '');
    const index = trimmed.lastIndexOf('/');
    return index <= 0 ? '/' : trimmed.slice(0, index);
}

/** `/storage/emulated/0` → `['/', '/storage', '/storage/emulated', '/storage/emulated/0']` paired with their names. */
export function breadcrumbs(path: string): Array<{ name: string; path: string }> {
    const parts = path.split('/').filter(Boolean);
    return [
        { name: '/', path: '/' },
        ...parts.map((name, index) => ({ name, path: `/${parts.slice(0, index + 1).join('/')}` })),
    ];
}

export function formatSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

const ORDER: Record<FileEntryType, number> = { dir: 0, link: 1, file: 2, other: 3 };

export function sortEntries(entries: FileEntry[]): FileEntry[] {
    return [...entries].sort((a, b) => ORDER[a.type] - ORDER[b.type] || a.name.localeCompare(b.name));
}
