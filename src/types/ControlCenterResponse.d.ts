export interface ControlCenterResponseData {
    command: string;
    success: boolean;
    message?: string;
}

export interface ControlCenterResponse {
    id: number;
    type: 'response';
    data: ControlCenterResponseData;
}
