<script setup lang="ts">
import { computed } from 'vue';
import { ExternalLink, X } from '@lucide/vue';
import { DialogClose } from 'reka-ui';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { deviceTitle } from '@/lib/device';
import { buildStreamLink } from '@/lib/ws';
import { PLAYERS, type GoogDeviceDescriptor, type PlayerCode } from '@/types/protocol';

const props = defineProps<{ device: GoogDeviceDescriptor; player: PlayerCode }>();
const open = defineModel<boolean>('open', { default: false });

const title = computed(() => deviceTitle(props.device));
const playerName = computed(() => PLAYERS.find((p) => p.code === props.player)?.name ?? props.player);
const streamLink = computed(() => buildStreamLink(props.device.udid, props.player));

// Moving the stream to a tab: close the embedded one first so the device isn't streamed twice.
function popOut(): void {
    window.open(streamLink.value, '_blank', 'noopener,noreferrer');
    open.value = false;
}
</script>

<template>
    <Dialog v-model:open="open">
        <!-- The iframe is unmounted on close, which unloads the player page and stops the stream. -->
        <DialogContent
            :show-close-button="false"
            class="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[92dvh] sm:w-[min(96vw,1400px)] sm:max-w-none sm:rounded-lg"
            @escape-key-down.prevent
            @pointer-down-outside.prevent
            @interact-outside.prevent
        >
            <div
                class="flex items-center gap-2 border-b px-3 py-2"
                style="padding-top: max(0.5rem, env(safe-area-inset-top))"
            >
                <div class="min-w-0 flex-1">
                    <DialogTitle class="truncate text-sm font-semibold">{{ title }}</DialogTitle>
                    <DialogDescription class="truncate text-xs">{{ device.udid }} · {{ playerName }}</DialogDescription>
                </div>
                <Button size="sm" variant="ghost" @click="popOut">
                    <ExternalLink />
                    <span class="hidden sm:inline">新分頁開啟</span>
                </Button>
                <DialogClose as-child>
                    <Button size="icon" variant="ghost" class="size-8" aria-label="關閉串流">
                        <X />
                    </Button>
                </DialogClose>
            </div>
            <iframe
                v-if="open"
                :key="streamLink"
                :src="streamLink"
                :title="`${title} 串流`"
                class="min-h-0 w-full flex-1 border-0 bg-black"
                allow="fullscreen; clipboard-read; clipboard-write; autoplay"
                allowfullscreen
            />
        </DialogContent>
    </Dialog>
</template>
