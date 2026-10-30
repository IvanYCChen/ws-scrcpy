<script setup lang="ts">
import { computed } from 'vue';
import { Usb, Wifi } from '@lucide/vue';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import DeviceActions from '@/components/DeviceActions.vue';
import DeviceMenu from '@/components/DeviceMenu.vue';
import DeviceName from '@/components/DeviceName.vue';
import DeviceStateBadge from '@/components/DeviceStateBadge.vue';
import { androidLabel, ipv4List } from '@/lib/device';
import { isTcpUdid } from '@/lib/ws';
import type { GoogDeviceDescriptor } from '@/types/protocol';

const props = defineProps<{ device: GoogDeviceDescriptor }>();

const android = computed(() => androidLabel(props.device));
const ips = computed(() => ipv4List(props.device));
const tcp = computed(() => isTcpUdid(props.device.udid));
</script>

<template>
    <Card class="gap-3 py-4">
        <CardHeader class="px-4">
            <div class="flex items-start justify-between gap-2">
                <DeviceName :device="device" title-class="text-base leading-tight" />
                <div class="-mt-1 -mr-2 flex shrink-0 items-center gap-1">
                    <DeviceStateBadge :state="device.state" />
                    <DeviceMenu :device="device" />
                </div>
            </div>
        </CardHeader>
        <CardContent class="grid gap-2 px-4 text-sm">
            <div class="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                    <Wifi v-if="tcp" />
                    <Usb v-else />
                    {{ tcp ? '無線' : 'USB' }}
                </Badge>
                <span v-if="android" class="text-muted-foreground">{{ android }}</span>
            </div>
            <div v-if="ips.length" class="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
                <span v-for="item in ips" :key="item.name">{{ item.name }}: {{ item.ipv4 }}</span>
            </div>
        </CardContent>
        <CardFooter class="px-4">
            <DeviceActions :device="device" />
        </CardFooter>
    </Card>
</template>
