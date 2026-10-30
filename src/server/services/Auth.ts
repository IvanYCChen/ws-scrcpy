import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import express, { NextFunction, Request, Response, Router } from 'express';
import { EnvName } from '../EnvName';

const COOKIE_NAME = 'ws_scrcpy_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 6;
const KEY_LENGTH = 64;
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 5 * 60 * 1000;

// Paths (relative to PATHNAME) served without a session, so the admin SPA can render its login screen.
const PUBLIC_PATHS = /^\/(index\.html)?$|^\/admin-assets\/|^\/api\/auth\//;

interface AuthData {
    salt: string;
    hash: string;
    // HMAC key for session cookies; regenerated with every password change, which logs out all sessions.
    secret: string;
}

function scrypt(password: string, salt: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key)));
    });
}

function sign(secret: string, value: string): string {
    return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function readCookie(header: string | undefined, name: string): string | undefined {
    if (!header) {
        return;
    }
    for (const part of header.split(';')) {
        const index = part.indexOf('=');
        if (index !== -1 && part.slice(0, index).trim() === name) {
            return decodeURIComponent(part.slice(index + 1).trim());
        }
    }
    return;
}

/**
 * Single admin password, stored as an scrypt hash in `<WS_SCRCPY_DATA_DIR>/auth.json`.
 * Sessions are stateless signed cookies (`<expiresMs>.<hmac>`) scoped to PATHNAME, so they also
 * reach the player iframe and every WebSocket upgrade under the same origin.
 */
export class Auth {
    private static instance?: Auth;
    private readonly file: string;
    private data?: AuthData;
    private failures = new Map<string, { count: number; since: number }>();

    protected constructor() {
        const dir = process.env[EnvName.WS_SCRCPY_DATA_DIR] || path.join(process.cwd(), 'data');
        this.file = path.join(dir, 'auth.json');
        this.load();
    }

    public static getInstance(): Auth {
        if (!this.instance) {
            this.instance = new Auth();
        }
        return this.instance;
    }

    private load(): void {
        try {
            const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
            if (data && data.salt && data.hash && data.secret) {
                this.data = data;
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                console.error(`[Auth] Failed to read ${this.file}:`, (error as Error).message);
            }
        }
    }

    public isConfigured(): boolean {
        // Re-read when missing, so deleting auth.json resets the password without a restart.
        if (this.data && !fs.existsSync(this.file)) {
            this.data = undefined;
        }
        return !!this.data;
    }

    public async setPassword(password: string): Promise<void> {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = (await scrypt(password, salt)).toString('hex');
        const secret = crypto.randomBytes(32).toString('hex');
        const data: AuthData = { salt, hash, secret };
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        fs.writeFileSync(this.file, JSON.stringify(data), { mode: 0o600 });
        this.data = data;
    }

    public async verifyPassword(password: string): Promise<boolean> {
        if (!this.isConfigured() || !this.data) {
            return false;
        }
        const { salt, hash } = this.data;
        return safeEqual((await scrypt(password, salt)).toString('hex'), hash);
    }

    public issueToken(): string {
        if (!this.data) {
            throw Error('Password is not set');
        }
        const expires = String(Date.now() + SESSION_MAX_AGE_MS);
        return `${expires}.${sign(this.data.secret, expires)}`;
    }

    public verifyToken(token: string | undefined): boolean {
        if (!token || !this.isConfigured() || !this.data) {
            return false;
        }
        const [expires, signature] = token.split('.');
        if (!expires || !signature || !(Number(expires) > Date.now())) {
            return false;
        }
        return safeEqual(sign(this.data.secret, expires), signature);
    }

    public verifyCookieHeader(header: string | undefined): boolean {
        return this.verifyToken(readCookie(header, COOKIE_NAME));
    }

    private isRateLimited(ip: string): boolean {
        const entry = this.failures.get(ip);
        if (!entry || Date.now() - entry.since > FAILURE_WINDOW_MS) {
            this.failures.delete(ip);
            return false;
        }
        return entry.count >= MAX_FAILURES;
    }

    private recordFailure(ip: string): void {
        const entry = this.failures.get(ip);
        if (!entry || Date.now() - entry.since > FAILURE_WINDOW_MS) {
            this.failures.set(ip, { count: 1, since: Date.now() });
        } else {
            entry.count++;
        }
    }

    /** `/api/auth/*` endpoints, to be mounted at PATHNAME. */
    public createRouter(pathname: string): Router {
        const router = express.Router();
        router.use('/api/auth', express.json());

        const setCookie = (req: Request, res: Response): void => {
            res.cookie(COOKIE_NAME, this.issueToken(), {
                httpOnly: true,
                sameSite: 'lax',
                secure: req.secure,
                path: pathname,
                maxAge: SESSION_MAX_AGE_MS,
            });
        };
        const validPassword = (value: unknown): value is string =>
            typeof value === 'string' && value.length >= MIN_PASSWORD_LENGTH;
        const ipOf = (req: Request): string => req.ip || req.socket.remoteAddress || '';

        router.get('/api/auth/status', (req, res) => {
            res.json({
                configured: this.isConfigured(),
                authenticated: this.verifyCookieHeader(req.headers.cookie),
            });
        });

        router.post('/api/auth/setup', async (req, res) => {
            if (this.isConfigured()) {
                res.status(409).json({ error: '密碼已設定' });
                return;
            }
            const { password } = req.body || {};
            if (!validPassword(password)) {
                res.status(400).json({ error: `密碼至少 ${MIN_PASSWORD_LENGTH} 個字元` });
                return;
            }
            await this.setPassword(password);
            setCookie(req, res);
            res.json({ ok: true });
        });

        router.post('/api/auth/login', async (req, res) => {
            const ip = ipOf(req);
            if (this.isRateLimited(ip)) {
                res.status(429).json({ error: '嘗試次數過多，請稍後再試' });
                return;
            }
            const { password } = req.body || {};
            if (typeof password !== 'string' || !(await this.verifyPassword(password))) {
                this.recordFailure(ip);
                res.status(401).json({ error: '密碼錯誤' });
                return;
            }
            this.failures.delete(ip);
            setCookie(req, res);
            res.json({ ok: true });
        });

        router.post('/api/auth/logout', (_req, res) => {
            res.clearCookie(COOKIE_NAME, { path: pathname });
            res.json({ ok: true });
        });

        router.post('/api/auth/password', async (req, res) => {
            if (!this.verifyCookieHeader(req.headers.cookie)) {
                res.status(401).json({ error: '請重新登入' });
                return;
            }
            const { current, next } = req.body || {};
            if (typeof current !== 'string' || !(await this.verifyPassword(current))) {
                res.status(403).json({ error: '目前密碼錯誤' });
                return;
            }
            if (!validPassword(next)) {
                res.status(400).json({ error: `新密碼至少 ${MIN_PASSWORD_LENGTH} 個字元` });
                return;
            }
            await this.setPassword(next);
            setCookie(req, res);
            res.json({ ok: true });
        });

        return router;
    }

    /** Blocks everything under PATHNAME except the login page and its assets until there is a valid session. */
    public gate = (req: Request, res: Response, next: NextFunction): void => {
        if (PUBLIC_PATHS.test(req.path) || this.verifyCookieHeader(req.headers.cookie)) {
            next();
            return;
        }
        res.status(401).send('Unauthorized');
    };
}
