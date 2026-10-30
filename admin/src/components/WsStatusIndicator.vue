<script setup lang="ts">
import { computed } from 'vue';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeviceTracker } from '@/composables/useDeviceTracker';

const { status, attempt, url, lastError, reconnectNow } = useDeviceTracker();

const label = computed(() => {
    switch (status.value) {
        case 'open':
            return '已連線';
        case 'connecting':
            return '連線中…';
        case 'reconnecting':
            return `重新連線中（${attempt.value}）`;
        default:
            return '已斷線';
    }
});

const dotClass = computed(() => {
    switch (status.value) {
        case 'open':
            return 'bg-success';
        case 'connecting':
        case 'reconnecting':
            return 'bg-amber-500 animate-pulse';
        default:
            return 'bg-destructive';
    }
});
</script>

<template>
    <Tooltip>
        <TooltipTrigger as-child>
            <button
                type="button"
                class="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                :aria-label="`伺服器連線狀態：${label}`"
                @click="reconnectNow()"
            >
                <span class="size-2 shrink-0 rounded-full" :class="dotClass" />
                <span class="hidden sm:inline">{{ label }}</span>
            </button>
        </TooltipTrigger>
        <TooltipContent class="max-w-xs">
            <p>{{ label }}</p>
            <p class="font-mono text-[10px] break-all opacity-80">{{ url }}</p>
            <p v-if="lastError" class="mt-1">{{ lastError }}</p>
            <p v-if="status !== 'open'" class="mt-1 opacity-80">點一下立即重新連線</p>
        </TooltipContent>
    </Tooltip>
</template>
