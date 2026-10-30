import type { GoogDeviceDescriptor } from '@/types/protocol';

/** "Google Pixel 7" style title, falling back to the udid when properties are not loaded yet. */
export function deviceTitle(device: GoogDeviceDescriptor): string {
    const manufacturer = (device['ro.product.manufacturer'] || '').trim();
    const model = (device['ro.product.model'] || '').trim();
    const title = [manufacturer, model].filter(Boolean).join(' ');
    return title || device.udid;
}

/** Short "3 小時前" style label for a past timestamp. */
export function timeAgo(timestamp: number, now = Date.now()): string {
    const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
    if (seconds < 60) {
        return '剛剛';
    }
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
        return `${minutes} 分鐘前`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 24) {
        return `${hours} 小時前`;
    }
    const days = Math.round(hours / 24);
    if (days < 30) {
        return `${days} 天前`;
    }
    return new Date(timestamp).toLocaleDateString('zh-TW');
}

export function androidLabel(device: GoogDeviceDescriptor): string {
    const release = (device['ro.build.version.release'] || '').trim();
    const sdk = (device['ro.build.version.sdk'] || '').trim();
    if (!release && !sdk) {
        return '';
    }
    return `Android ${release || '?'}${sdk ? ` (API ${sdk})` : ''}`;
}

export function ipv4List(device: GoogDeviceDescriptor): Array<{ name: string; ipv4: string }> {
    return (device.interfaces || []).filter((item) => item && item.ipv4);
}
