<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { Smartphone } from '@lucide/vue';
import { Skeleton } from '@/components/ui/skeleton';
import DeviceCard from '@/components/DeviceCard.vue';
import DeviceTable from '@/components/DeviceTable.vue';
import { useDeviceTracker } from '@/composables/useDeviceTracker';

const { deviceList, status } = useDeviceTracker();
// Table from lg up; md tablets get the two-column card grid, which fits better than a six-column table.
const isDesktop = useMediaQuery('(min-width: 1024px)');
</script>

<template>
    <div v-if="status !== 'open' && deviceList.length === 0" class="grid gap-3 sm:grid-cols-2" aria-busy="true">
        <Skeleton v-for="i in 3" :key="i" class="h-40 rounded-xl" />
    </div>

    <div
        v-else-if="deviceList.length === 0"
        class="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-16 text-center text-muted-foreground"
    >
        <Smartphone class="size-8" aria-hidden="true" />
        <p class="font-medium">目前沒有裝置</p>
        <p class="text-xs">用 USB 連接裝置，或按「連線裝置」輸入無線裝置的 IP。</p>
    </div>

    <DeviceTable v-else-if="isDesktop" :devices="deviceList" />

    <div v-else class="grid gap-3 sm:grid-cols-2">
        <DeviceCard v-for="device in deviceList" :key="device.udid" :device="device" />
    </div>
</template>
