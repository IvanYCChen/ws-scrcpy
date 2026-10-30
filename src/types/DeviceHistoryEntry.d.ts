/** A device that has been online at least once, persisted in `<WS_SCRCPY_DATA_DIR>/devices.json`. */
export interface DeviceHistoryEntry {
    udid: string;
    alias: string;
    manufacturer: string;
    model: string;
    release: string;
    sdk: string;
    firstSeen: number;
    lastSeen: number;
}

export interface DeviceHistoryEvent {
    list: DeviceHistoryEntry[];
}
