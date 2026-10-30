import { WDAMethod } from './WDAMethod';

export class ControlCenterCommand {
    public static KILL_SERVER = 'kill_server';
    public static START_SERVER = 'start_server';
    public static UPDATE_INTERFACES = 'update_interfaces';
    public static CONFIGURE_STREAM = 'configure_stream';
    public static RUN_WDA = 'run-wda';
    public static REQUEST_WDA = 'request-wda';
    public static ADB_CONNECT = 'adb_connect';
    public static ADB_DISCONNECT = 'adb_disconnect';
    public static ADB_KILL_SERVER = 'adb_kill_server';
    public static DEVICE_SET_ALIAS = 'device_set_alias';
    public static DEVICE_FORGET = 'device_forget';
    public static DEVICE_REORDER = 'device_reorder';

    public static DEFAULT_ADB_PORT = 5555;

    private id = -1;
    private type = '';
    private pid = 0;
    private udid = '';
    private host = '';
    private port = 0;
    private alias = '';
    private udids: string[] = [];
    private method = '';
    private args?: any;
    private data?: any;

    public static fromJSON(json: string): ControlCenterCommand {
        const body = JSON.parse(json);
        if (!body || typeof body !== 'object') {
            throw new Error('Invalid input');
        }
        const command = new ControlCenterCommand();
        const data = (command.data = body.data && typeof body.data === 'object' ? body.data : {});
        command.id = typeof body.id === 'number' ? body.id : -1;
        command.type = typeof body.type === 'string' ? body.type : '';

        if (typeof data.udid === 'string') {
            command.udid = data.udid;
        }
        switch (body.type) {
            case this.KILL_SERVER:
                if (typeof data.pid !== 'number' && data.pid <= 0) {
                    throw new Error('Invalid "pid" value');
                }
                command.pid = data.pid;
                return command;
            case this.REQUEST_WDA:
                if (typeof data.method !== 'string') {
                    throw new Error('Invalid "method" value');
                }
                command.method = data.method;
                command.args = data.args;
                return command;
            case this.ADB_CONNECT:
            case this.ADB_DISCONNECT:
                command.host = this.parseHost(data.host);
                command.port = this.parsePort(data.port);
                return command;
            case this.DEVICE_SET_ALIAS:
                if (!command.udid) {
                    throw new Error('Invalid "udid" value');
                }
                if (typeof data.alias !== 'string') {
                    throw new Error('Invalid "alias" value');
                }
                command.alias = data.alias;
                return command;
            case this.DEVICE_FORGET:
                if (!command.udid) {
                    throw new Error('Invalid "udid" value');
                }
                return command;
            case this.DEVICE_REORDER:
                if (!Array.isArray(data.udids) || !data.udids.every((item: unknown) => typeof item === 'string')) {
                    throw new Error('Invalid "udids" value');
                }
                command.udids = data.udids;
                return command;
            case this.ADB_KILL_SERVER:
            case this.START_SERVER:
            case this.UPDATE_INTERFACES:
            case this.CONFIGURE_STREAM:
            case this.RUN_WDA:
                return command;
            default:
                throw new Error(`Unknown command "${body.type}"`);
        }
    }

    private static parseHost(value: unknown): string {
        if (typeof value !== 'string') {
            throw new Error('Invalid "host" value');
        }
        const host = value.trim();
        if (!host || /\s/.test(host)) {
            throw new Error('Invalid "host" value');
        }
        return host;
    }

    private static parsePort(value: unknown): number {
        if (value === undefined || value === null || value === '') {
            return this.DEFAULT_ADB_PORT;
        }
        const port = typeof value === 'string' ? Number(value) : value;
        if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error('Invalid "port" value');
        }
        return port;
    }

    public getType(): string {
        return this.type;
    }
    public getPid(): number {
        return this.pid;
    }
    public getUdid(): string {
        return this.udid;
    }
    public getHost(): string {
        return this.host;
    }
    public getPort(): number {
        return this.port;
    }
    public getAlias(): string {
        return this.alias;
    }
    public getUdids(): string[] {
        return this.udids;
    }
    public getId(): number {
        return this.id;
    }
    public getMethod(): WDAMethod | string {
        return this.method;
    }
    public getData(): any {
        return this.data;
    }
    public getArgs(): any {
        return this.args;
    }
}
