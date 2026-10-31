import express, { Router } from 'express';
import { AdbExtended } from './adb';

const TIMEOUT_MS = 20000;

// Not an `Error` subclass: the server is compiled to ES5, where `instanceof` fails for those.
type HttpError = Error & { status: number };

function httpError(status: number, message: string): HttpError {
    return Object.assign(new Error(message), { status });
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function readAll(stream: NodeJS.ReadableStream & { destroy?: () => void }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const timer = setTimeout(() => {
            stream.destroy?.();
            reject(httpError(504, '截圖逾時'));
        }, TIMEOUT_MS);
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.once('end', () => {
            clearTimeout(timer);
            resolve(Buffer.concat(chunks));
        });
        stream.once('error', (error: Error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
}

/**
 * `/api/screenshot` endpoint for the admin UI, to be mounted at PATHNAME behind the auth gate.
 * Answers with the PNG from `screencap -p` on the device.
 */
export class ScreenshotApi {
    public static createRouter(): Router {
        const router = express.Router();

        router.get('/api/screenshot', async (req, res) => {
            try {
                const { udid } = req.query;
                if (typeof udid !== 'string' || !udid) {
                    throw httpError(400, 'Invalid "udid" value');
                }
                const client = AdbExtended.createClient();
                const png = await readAll(await client.screencap(udid));
                // An empty or non-PNG reply means screencap failed on the device (its stderr is dropped).
                if (!png.slice(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
                    throw httpError(502, '裝置未回傳有效的截圖');
                }
                res.setHeader('Cache-Control', 'no-store');
                res.type('image/png').send(png);
            } catch (error) {
                const { status, message } = error as Error & { status?: number };
                if (!res.headersSent) {
                    res.status(status || 500).json({ error: message });
                }
            }
        });

        return router;
    }
}
