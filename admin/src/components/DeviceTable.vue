<script setup lang="ts">
import { computed, ref } from 'vue';
import { Usb, Wifi } from '@lucide/vue';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import DeviceActions from '@/components/DeviceActions.vue';
import DeviceMenu from '@/components/DeviceMenu.vue';
import DeviceName from '@/components/DeviceName.vue';
import DragHandle from '@/components/DragHandle.vue';
import DeviceStateBadge from '@/components/DeviceStateBadge.vue';
import { androidLabel, ipv4List } from '@/lib/device';
import { isTcpUdid } from '@/lib/ws';
import type { GoogDeviceDescriptor } from '@/types/protocol';
import { useDeviceSortable } from '@/composables/useDeviceSortable';
import { useDeviceTracker } from '@/composables/useDeviceTracker';

defineProps<{ devices: GoogDeviceDescriptor[] }>();

const { history, isOpen } = useDeviceTracker();
const root = ref<HTMLElement | null>(null);
const body = computed(() => root.value?.querySelector('tbody') ?? null);
useDeviceSortable(body, { mode: ref('handle'), disabled: computed(() => !isOpen.value) });
</script>

<template>
    <div ref="root" class="overflow-hidden rounded-xl border">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead class="w-10"><span class="sr-only">排序</span></TableHead>
                    <TableHead>裝置</TableHead>
                    <TableHead class="w-24">連線</TableHead>
                    <TableHead>Android</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead class="w-24">狀態</TableHead>
                    <TableHead class="text-right">操作</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow
                    v-for="device in devices"
                    :key="device.udid"
                    :data-udid="device.udid"
                    :data-sortable="history.has(device.udid) ? '' : undefined"
                >
                    <TableCell class="w-10 pr-0">
                        <DragHandle :udid="device.udid" />
                    </TableCell>
                    <TableCell class="max-w-72">
                        <DeviceName :device="device" />
                    </TableCell>
                    <TableCell>
                        <Badge variant="secondary">
                            <Wifi v-if="isTcpUdid(device.udid)" />
                            <Usb v-else />
                            {{ isTcpUdid(device.udid) ? '無線' : 'USB' }}
                        </Badge>
                    </TableCell>
                    <TableCell class="whitespace-nowrap text-muted-foreground">{{ androidLabel(device) || '—' }}</TableCell>
                    <TableCell class="font-mono text-xs text-muted-foreground">
                        <div v-if="ipv4List(device).length" class="flex flex-col gap-0.5">
                            <span v-for="item in ipv4List(device)" :key="item.name">{{ item.name }}: {{ item.ipv4 }}</span>
                        </div>
                        <span v-else>—</span>
                    </TableCell>
                    <TableCell><DeviceStateBadge :state="device.state" /></TableCell>
                    <TableCell class="whitespace-nowrap text-right">
                        <div class="flex items-center justify-end gap-1">
                            <DeviceActions :device="device" class="flex-nowrap! justify-end" />
                            <DeviceMenu :device="device" />
                        </div>
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
    </div>
</template>
