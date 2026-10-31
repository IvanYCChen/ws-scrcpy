import * as path from 'path';
import express, { Request, Response, Router } from 'express';
import Stats from '@dead50f7/adbkit/lib/adb/sync/stats';
import { AdbExtended } from './adb';

type EntryType = 'dir' | 'file' | 'link' | 'other';

interface FileEntry {
    name: string;
    type: EntryType;
    size: number;
    mtime: number;
}

// Not an `Error` subclass: the server is compiled to ES5, where `instanceof` fails for those.
type HttpError = Error & { status: number };

function httpError(status: number, message: string): HttpError {
    return Object.assign(new Error(message), { status });
}

function entryType(stats: Stats): EntryType {
    if (stats.isSymbolicLink()) {
        return 'link';
    }
    if (stats.isDirectory()) {
        return 'dir';
    }
    if (stats.isFile()) {
        return 'file';
    }
    return 'other';
}

function readParams(req: Request): { serial: string; pathString: string } {
    const { udid, path: pathParam } = req.query;
    if (typeof udid !== 'string' || !udid) {
        throw httpError(400, 'Invalid "udid" value');
    }
    if (typeof pathParam !== 'string' || !pathParam.startsWith('/') || pathParam.includes('\0')) {
        throw httpError(400, 'Invalid "path" value');
    }
    return { serial: udid, pathString: path.posix.normalize(pathParam) };
}

// adbkit reports a missing path as `code: 'ENOENT'` and other sync failures as adbd's own message.
function statusOf(error: Error & { status?: number; code?: string }): number {
    if (error.status) {
        return error.status;
    }
    if (error.code === 'ENOENT') {
        return 404;
    }
    if (/Permission denied/i.test(error.message)) {
        return 403;
    }
    if (/Is a directory|Not a directory/i.test(error.message)) {
        return 400;
    }
    return 500;
}

/** First chunk of the stream (`null` if it ended empty), leaving the stream paused for `pipe`. */
function firstChunk(stream: NodeJS.ReadableStream): Promise<Buffer | null> {
    return new Promise((resolve, reject) => {
        const cleanup = (): void => {
            stream.removeListener('data', onData);
            stream.removeListener('end', onEnd);
            stream.removeListener('error', onError);
        };
        const onData = (chunk: Buffer): void => {
            cleanup();
            stream.pause();
            resolve(chunk);
        };
        const onEnd = (): void => {
            cleanup();
            resolve(null);
        };
        const onError = (error: Error): void => {
            cleanup();
            reject(error);
        };
        stream.on('data', onData);
        stream.once('end', onEnd);
        stream.once('error', onError);
    });
}

function sendError(res: Response, error: Error): void {
    if (res.writableEnded) {
        return;
    }
    const status = statusOf(error);
    if (res.headersSent) {
        res.destroy(error);
        return;
    }
    res.status(status).json({ error: error.message });
}

/**
 * `/api/files/*` endpoints for the admin UI, to be mounted at PATHNAME behind the auth gate.
 * Plain HTTP counterpart of the FSLS multiplexer channel used by the original FileListingClient.
 */
export class FileApi {
    public static createRouter(): Router {
        const router = express.Router();

        // A directory, or a symlink to one (`/sdcard`): the trailing slash makes adbd follow the link.
        router.get('/api/files/list', async (req, res) => {
            try {
                const { serial, pathString } = readParams(req);
                const dir = pathString.endsWith('/') ? pathString : `${pathString}/`;
                const client = AdbExtended.createClient();
                const stats = await client.stat(serial, dir).catch(() => undefined);
                if (!stats || stats.mode === 0 || !stats.isDirectory()) {
                    throw httpError(404, `找不到資料夾 ${pathString}`);
                }
                const list = await client.readdir(serial, dir);
                const entries: FileEntry[] = list.map((entry) => ({
                    name: entry.name,
                    type: entryType(entry),
                    size: entry.size,
                    mtime: entry.mtime.getTime(),
                }));
                res.json({ path: pathString, entries });
            } catch (error) {
                sendError(res, error as Error);
            }
        });

        router.get('/api/files/download', async (req, res) => {
            try {
                const { serial, pathString } = readParams(req);
                const client = AdbExtended.createClient();
                const stats = await client.stat(serial, pathString).catch(() => undefined);
                if (!stats || stats.mode === 0) {
                    throw httpError(404, `找不到 ${pathString}`);
                }
                if (stats.isDirectory()) {
                    throw httpError(400, `${pathString} 是資料夾，無法下載`);
                }
                const transfer = await client.pullStream(serial, pathString);
                transfer.on('error', (error: Error) => sendError(res, error));
                // Client gone (or done): closes the sync connection.
                res.on('close', () => transfer.destroy());
                // adbd only reports "Permission denied" / "Is a directory" (symlinked folders) once the pull runs,
                // so headers are committed after the first chunk: until then a failure is still a JSON error.
                const first = await firstChunk(transfer);
                res.attachment(path.posix.basename(pathString));
                res.type('application/octet-stream');
                // For a symlink the size is the link's own, so only trust it for regular files.
                if (stats.isFile()) {
                    res.setHeader('Content-Length', stats.size);
                }
                if (!first) {
                    res.end();
                    return;
                }
                res.write(first);
                transfer.pipe(res);
            } catch (error) {
                sendError(res, error as Error);
            }
        });

        return router;
    }
}
