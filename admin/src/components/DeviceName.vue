<script setup lang="ts">
import { computed } from 'vue';
import { useNow } from '@vueuse/core';
import { deviceTitle, timeAgo } from '@/lib/device';
import { DeviceState, type GoogDeviceDescriptor } from '@/types/protocol';
import { useDeviceTracker } from '@/composables/useDeviceTracker';

const props = defineProps<{ device: GoogDeviceDescriptor; titleClass?: string }>();

const { history } = useDeviceTracker();
const now = useNow({ interval: 60_000 });

const entry = computed(() => history.get(props.device.udid));
const model = computed(() => deviceTitle(props.device));
const alias = computed(() => entry.value?.alias || '');
const lastSeen = computed(() =>
    entry.value && props.device.state !== DeviceState.DEVICE ? timeAgo(entry.value.lastSeen, now.value.getTime()) : '',
);
</script>

<template>
    <div class="min-w-0">
        <div :class="['truncate font-medium', titleClass]" :title="alias || model">{{ alias || model }}</div>
        <div v-if="alias && model !== device.udid" class="mt-0.5 truncate text-xs text-muted-foreground">{{ model }}</div>
        <div class="mt-0.5 font-mono text-xs break-all whitespace-normal text-muted-foreground">{{ device.udid }}</div>
        <div v-if="lastSeen" class="mt-0.5 text-xs text-muted-foreground">上次連線：{{ lastSeen }}</div>
    </div>
</template>
