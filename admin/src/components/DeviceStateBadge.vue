<script setup lang="ts">
import { computed } from 'vue';
import { Badge, type BadgeVariants } from '@/components/ui/badge';
import { DeviceState } from '@/types/protocol';

const props = defineProps<{ state: string }>();

const info = computed<{ text: string; variant: BadgeVariants['variant']; class?: string }>(() => {
    switch (props.state) {
        case DeviceState.DEVICE:
            return { text: '已連線', variant: 'default', class: 'bg-success text-success-foreground' };
        case DeviceState.OFFLINE:
            return { text: '離線', variant: 'secondary' };
        case DeviceState.UNAUTHORIZED:
            return { text: '未授權', variant: 'destructive' };
        case DeviceState.DISCONNECTED:
            return { text: '已斷線', variant: 'outline', class: 'text-muted-foreground' };
        default:
            return { text: props.state || '未知', variant: 'secondary' };
    }
});
</script>

<template>
    <Badge :variant="info.variant" :class="info.class" :title="state">{{ info.text }}</Badge>
</template>
