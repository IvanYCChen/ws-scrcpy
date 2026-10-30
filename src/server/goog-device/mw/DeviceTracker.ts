import WS from 'ws';
import { Mw, RequestParameters } from '../../mw/Mw';
import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { ControlCenter } from '../services/ControlCenter';
import { ACTION } from '../../../common/Action';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import { DeviceTrackerEvent } from '../../../types/DeviceTrackerEvent';
import { DeviceTrackerEventList } from '../../../types/DeviceTrackerEventList';
import { Multiplexer } from '../../../packages/multiplexer/Multiplexer';
import { ChannelCode } from '../../../common/ChannelCode';
import { ControlCenterResponse, ControlCenterResponseData } from '../../../types/ControlCenterResponse';

export class DeviceTracker extends Mw {
    public static readonly TAG = 'DeviceTracker';
    public static readonly type = 'android';
    private adt: ControlCenter = ControlCenter.getInstance();
    private readonly id: string;

    public static processChannel(ws: Multiplexer, code: string): Mw | undefined {
        if (code !== ChannelCode.GTRC) {
            return;
        }
        return new DeviceTracker(ws);
    }

    public static processRequest(ws: WS, params: RequestParameters): DeviceTracker | undefined {
        if (params.action !== ACTION.GOOG_DEVICE_LIST) {
            return;
        }
        return new DeviceTracker(ws);
    }

    constructor(ws: WS | Multiplexer) {
        super(ws);

        this.id = this.adt.getId();
        this.adt
            .init()
            .then(() => {
                this.adt.on('device', this.sendDeviceMessage);
                this.buildAndSendMessage(this.adt.getDevices());
            })
            .catch((error: Error) => {
                console.error(`[${DeviceTracker.TAG}] Error: ${error.message}`);
            });
    }

    private sendDeviceMessage = (device: GoogDeviceDescriptor): void => {
        const data: DeviceTrackerEvent<GoogDeviceDescriptor> = {
            device,
            id: this.id,
            name: this.adt.getName(),
        };
        this.sendMessage({
            id: -1,
            type: 'device',
            data,
        });
    };

    private buildAndSendMessage = (list: GoogDeviceDescriptor[]): void => {
        const data: DeviceTrackerEventList<GoogDeviceDescriptor> = {
            list,
            id: this.id,
            name: this.adt.getName(),
        };
        this.sendMessage({
            id: -1,
            type: 'devicelist',
            data,
        });
    };

    private sendResponse(id: number, data: ControlCenterResponseData): void {
        const message: ControlCenterResponse = { id, type: 'response', data };
        this.sendMessage(message);
    }

    protected onSocketMessage(event: WS.MessageEvent): void {
        const raw = event.data.toString();
        let command: ControlCenterCommand;
        try {
            command = ControlCenterCommand.fromJSON(raw);
        } catch (error: any) {
            console.error(`[${DeviceTracker.TAG}], Received message: ${raw}. Error: ${error?.message}`);
            const { id, type } = DeviceTracker.peekIdAndType(raw);
            this.sendResponse(id, { command: type, success: false, message: error?.message || 'Invalid command' });
            return;
        }
        const id = command.getId();
        const type = command.getType();
        this.adt
            .runCommand(command)
            .then((result) => {
                this.sendResponse(id, { command: type, success: true, message: result || undefined });
            })
            .catch((e) => {
                console.error(`[${DeviceTracker.TAG}], Received message: ${raw}. Error: ${e.message}`);
                this.sendResponse(id, { command: type, success: false, message: e.message });
            });
    }

    private static peekIdAndType(raw: string): { id: number; type: string } {
        try {
            const body = JSON.parse(raw);
            return {
                id: body && typeof body.id === 'number' ? body.id : -1,
                type: body && typeof body.type === 'string' ? body.type : '',
            };
        } catch {
            return { id: -1, type: '' };
        }
    }

    public release(): void {
        super.release();
        this.adt.off('device', this.sendDeviceMessage);
    }
}
