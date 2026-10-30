<script setup lang="ts">
import { Usb, Wifi } from '@lucide/vue';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import DeviceActions from '@/components/DeviceActions.vue';
import DeviceMenu from '@/components/DeviceMenu.vue';
import DeviceName from '@/components/DeviceName.vue';
import DeviceStateBadge from '@/components/DeviceStateBadge.vue';
import { androidLabel, ipv4List } from '@/lib/device';
import { isTcpUdid } from '@/lib/ws';
import type { GoogDeviceDescriptor } from '@/types/protocol';

defineProps<{ devices: GoogDeviceDescriptor[] }>();
</script>

<template>
    <div class="overflow-hidden rounded-xl border">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>裝置</TableHead>
                    <TableHead class="w-24">連線</TableHead>
                    <TableHead>Android</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead class="w-24">狀態</TableHead>
                    <TableHead class="text-right">操作</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow v-for="device in devices" :key="device.udid">
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
