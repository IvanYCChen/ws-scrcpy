export enum XtermServiceActions {
    start,
    stop,
    resize,
}

export interface XtermServiceParameters {
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: { [key: string]: string };
    udid: string;
}

export interface XtermClientMessage extends XtermServiceParameters {
    type: keyof typeof XtermServiceActions;
    pid?: number;
}
