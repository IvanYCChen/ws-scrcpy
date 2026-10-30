import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import { TypedEmitter } from '../../../common/TypedEmitter';
import { EnvName } from '../../EnvName';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import { DeviceHistoryEntry } from '../../../types/DeviceHistoryEntry';

interface DeviceHistoryEvents {
    change: DeviceHistoryEntry[];
}

const MAX_ALIAS_LENGTH = 64;

/**
 * Devices that have been online at least once, with a user-defined alias.
 * Stored in `<WS_SCRCPY_DATA_DIR>/devices.json` next to `auth.json`, so it survives container restarts.
 */
export class DeviceHistory extends TypedEmitter<DeviceHistoryEvents> {
    private static instance?: DeviceHistory;
    private readonly file: string;
    private entries: Map<string, DeviceHistoryEntry> = new Map();

    protected constructor() {
        super();
        const dir = process.env[EnvName.WS_SCRCPY_DATA_DIR] || path.join(process.cwd(), 'data');
        this.file = path.join(dir, 'devices.json');
        this.load();
    }

    public static getInstance(): DeviceHistory {
        if (!this.instance) {
            this.instance = new DeviceHistory();
        }
        return this.instance;
    }

    private load(): void {
        try {
            const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
            if (Array.isArray(data)) {
                for (const item of data) {
                    if (item && typeof item.udid === 'string') {
                        this.entries.set(item.udid, item);
                    }
                }
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                console.error(`[DeviceHistory] Failed to read ${this.file}:`, (error as Error).message);
            }
        }
    }

    private save(): void {
        try {
            fs.mkdirSync(path.dirname(this.file), { recursive: true });
            fs.writeFileSync(this.file, JSON.stringify(this.getList(), null, 2));
        } catch (error) {
            console.error(`[DeviceHistory] Failed to write ${this.file}:`, (error as Error).message);
        }
        this.emit('change', this.getList());
    }

    public getList(): DeviceHistoryEntry[] {
        return Array.from(this.entries.values());
    }

    /**
     * Called on every descriptor update. `cameOnline` is true only when the device has just switched to
     * the "device" state: that is when a new entry is created, so a forgotten device that stays connected
     * does not come straight back. Otherwise known entries only get their properties filled in.
     */
    public record(descriptor: GoogDeviceDescriptor, cameOnline: boolean): void {
        const { udid } = descriptor;
        const existing = this.entries.get(udid);
        if (!existing && !cameOnline) {
            return;
        }
        const now = Date.now();
        const entry: DeviceHistoryEntry = existing || {
            udid,
            alias: '',
            manufacturer: '',
            model: '',
            release: '',
            sdk: '',
            firstSeen: now,
            lastSeen: now,
        };
        let changed = !existing;
        const fill = (key: 'manufacturer' | 'model' | 'release' | 'sdk', value: string | undefined): void => {
            const next = (value || '').trim();
            if (next && entry[key] !== next) {
                entry[key] = next;
                changed = true;
            }
        };
        fill('manufacturer', descriptor['ro.product.manufacturer']);
        fill('model', descriptor['ro.product.model']);
        fill('release', descriptor['ro.build.version.release']);
        fill('sdk', descriptor['ro.build.version.sdk']);
        if (cameOnline) {
            entry.lastSeen = now;
            changed = true;
        }
        if (changed) {
            this.entries.set(udid, entry);
            this.save();
        }
    }

    /** Marks the moment a known device went away, so "last seen" is accurate for long sessions. */
    public touch(udid: string): void {
        const entry = this.entries.get(udid);
        if (entry) {
            entry.lastSeen = Date.now();
            this.save();
        }
    }

    public setAlias(udid: string, alias: string): void {
        const entry = this.entries.get(udid);
        if (!entry) {
            throw new Error(`Device "${udid}" is not in the history`);
        }
        entry.alias = alias.trim().slice(0, MAX_ALIAS_LENGTH);
        this.save();
    }

    public remove(udid: string): void {
        if (!this.entries.delete(udid)) {
            throw new Error(`Device "${udid}" is not in the history`);
        }
        this.save();
    }
}
