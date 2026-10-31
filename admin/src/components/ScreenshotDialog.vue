<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import { Copy, Download, RefreshCw } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { deviceTitle } from '@/lib/device';
import { captureScreenshot, screenshotFileName } from '@/lib/screenshot';
import type { GoogDeviceDescriptor } from '@/types/protocol';
import { useDeviceTracker } from '@/composables/useDeviceTracker';

const props = defineProps<{ device: GoogDeviceDescriptor }>();
const open = defineModel<boolean>('open', { default: false });

const { history } = useDeviceTracker();
const title = computed(() => history.get(props.device.udid)?.alias || deviceTitle(props.device));

const blob = ref<Blob | null>(null);
const imageUrl = ref('');
const takenAt = ref<Date | null>(null);
const loading = ref(false);
const error = ref('');
let requestId = 0;

const fileName = computed(() => (takenAt.value ? screenshotFileName(title.value, takenAt.value) : 'screenshot.png'));
const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;

function setImage(value: Blob | null): void {
    if (imageUrl.value) {
        URL.revokeObjectURL(imageUrl.value);
    }
    blob.value = value;
    imageUrl.value = value ? URL.createObjectURL(value) : '';
}

async function capture(): Promise<void> {
    const id = ++requestId;
    loading.value = true;
    error.value = '';
    try {
        const result = await captureScreenshot(props.device.udid);
        if (id !== requestId) {
            return;
        }
        setImage(result);
        takenAt.value = new Date();
    } catch (e) {
        if (id !== requestId) {
            return;
        }
        // Keep the previous screenshot on a failed retake; only an empty dialog shows the error inline.
        if (blob.value) {
            toast.error('截圖失敗', { description: (e as Error).message });
        } else {
            error.value = (e as Error).message;
        }
    } finally {
        if (id === requestId) {
            loading.value = false;
        }
    }
}

// Every open takes a fresh screenshot; the image is released on close.
watch(open, (value) => {
    if (value) {
        capture();
    } else {
        requestId++;
        loading.value = false;
        setImage(null);
    }
});

onBeforeUnmount(() => setImage(null));

function download(): void {
    if (!imageUrl.value) {
        return;
    }
    const a = document.createElement('a');
    a.href = imageUrl.value;
    a.download = fileName.value;
    a.click();
}

async function copy(): Promise<void> {
    if (!blob.value) {
        return;
    }
    try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob.value })]);
        toast.success('已複製截圖');
    } catch (e) {
        toast.error('複製失敗', { description: (e as Error).message });
    }
}

function formatTime(time: Date): string {
    return time.toLocaleString('zh-TW', { hour12: false });
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="flex max-h-[92dvh] flex-col gap-3 overflow-hidden p-4 sm:max-w-3xl sm:p-6">
            <DialogHeader class="pr-6">
                <DialogTitle class="truncate">{{ title }} 的截圖</DialogTitle>
                <DialogDescription class="truncate">
                    {{ device.udid }}<template v-if="takenAt"> · {{ formatTime(takenAt) }}</template>
                </DialogDescription>
            </DialogHeader>

            <div class="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" :disabled="loading" @click="capture">
                    <RefreshCw :class="{ 'animate-spin': loading }" />
                    {{ loading ? '截圖中…' : '重新截圖' }}
                </Button>
                <div class="ml-auto flex items-center gap-2">
                    <Button v-if="canCopy" size="sm" variant="outline" :disabled="!blob" @click="copy">
                        <Copy />
                        複製
                    </Button>
                    <Button size="sm" :disabled="!blob" @click="download">
                        <Download />
                        下載
                    </Button>
                </div>
            </div>

            <div class="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border bg-muted/40 p-2">
                <img
                    v-if="imageUrl"
                    :src="imageUrl"
                    :alt="`${title} 的截圖`"
                    class="max-h-[70dvh] max-w-full rounded object-contain shadow-sm transition-opacity"
                    :class="{ 'opacity-60': loading }"
                />
                <div v-else-if="error" class="p-6 text-center text-sm text-destructive">{{ error }}</div>
                <Skeleton v-else class="h-[60dvh] w-[min(100%,34dvh)]" />
            </div>
        </DialogContent>
    </Dialog>
</template>
