<script setup lang="ts">
import { computed } from 'vue';
import { toast } from 'vue-sonner';
import { Menu } from '@lucide/vue';
import { useDeviceTracker } from '@/composables/useDeviceTracker';

const props = defineProps<{ udid: string }>();

const { history, isOpen, reorderDevice } = useDeviceTracker();

const index = computed(() => Array.from(history.keys()).indexOf(props.udid));

// Keyboard alternative to dragging: focus the grip and press ↑ / ↓.
function move(offset: -1 | 1): void {
    const to = index.value + offset;
    if (!isOpen.value || index.value === -1 || to < 0 || to >= history.size) {
        return;
    }
    reorderDevice(props.udid, to).catch((error: Error) => toast.error('排序失敗', { description: error.message }));
}
</script>

<template>
    <button
        v-if="index !== -1"
        type="button"
        data-drag-handle
        class="flex size-7 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
        aria-label="拖曳排序（可用上下鍵移動）"
        title="拖曳排序"
        @keydown.up.prevent="move(-1)"
        @keydown.down.prevent="move(1)"
    >
        <Menu class="size-4" />
    </button>
</template>
