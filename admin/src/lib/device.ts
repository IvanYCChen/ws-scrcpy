import type { GoogDeviceDescriptor } from '@/types/protocol';

/** "Google Pixel 7" style title, falling back to the udid when properties are not loaded yet. */
export function deviceTitle(device: GoogDeviceDescriptor): string {
    const manufacturer = (device['ro.product.manufacturer'] || '').trim();
    const model = (device['ro.product.model'] || '').trim();
    const title = [manufacturer, model].filter(Boolean).join(' ');
    return title || device.udid;
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
