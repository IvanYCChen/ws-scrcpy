<script setup lang="ts">
import { computed, ref } from 'vue';
import { toast } from 'vue-sonner';
import { useLocalStorage } from '@vueuse/core';
import { Camera, ChevronDown, ExternalLink, MonitorPlay, Plug, Unplug } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ScreenshotDialog from '@/components/ScreenshotDialog.vue';
import StreamDialog from '@/components/StreamDialog.vue';
import { buildStreamLink, isPlayerCode, splitTcpUdid } from '@/lib/ws';
import { DeviceState, PLAYERS, type GoogDeviceDescriptor, type PlayerCode } from '@/types/protocol';
import { useDeviceTracker } from '@/composables/useDeviceTracker';

const props = defineProps<{ device: GoogDeviceDescriptor }>();

const { adbConnect, adbDisconnect, isOpen } = useDeviceTracker();

const storedPlayer = useLocalStorage<string>('ws-scrcpy-admin-player', 'mse');
const player = computed<PlayerCode>(() => (isPlayerCode(storedPlayer.value) ? storedPlayer.value : 'mse'));

const tcp = computed(() => splitTcpUdid(props.device.udid));
const canStream = computed(() => props.device.state === DeviceState.DEVICE);
const canDisconnect = computed(() => tcp.value !== null && props.device.state !== DeviceState.DISCONNECTED);
const canReconnect = computed(() => tcp.value !== null && props.device.state === DeviceState.DISCONNECTED);

const busy = ref(false);
const streamOpen = ref(false);
const screenshotOpen = ref(false);

function openStreamWith(code: PlayerCode): void {
    storedPlayer.value = code;
    streamOpen.value = true;
}

function openStreamInTab(): void {
    window.open(buildStreamLink(props.device.udid, player.value), '_blank', 'noopener,noreferrer');
}

async function disconnect(): Promise<void> {
    if (!tcp.value || busy.value) {
        return;
    }
    const { host, port } = tcp.value;
    busy.value = true;
    try {
        const result = await adbDisconnect(host, port);
        toast.success(`已斷線 ${host}:${port}`, { description: result.message });
    } catch (error) {
        toast.error(`斷線失敗 ${host}:${port}`, { description: (error as Error).message });
    } finally {
        busy.value = false;
    }
}

async function reconnect(): Promise<void> {
    if (!tcp.value || busy.value) {
        return;
    }
    const { host, port } = tcp.value;
    busy.value = true;
    try {
        const result = await adbConnect(host, port);
        toast.success(`已連線 ${host}:${port}`, { description: result.message });
    } catch (error) {
        toast.error(`連線失敗 ${host}:${port}`, { description: (error as Error).message });
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <div class="flex flex-wrap items-center gap-2">
        <template v-if="canStream">
            <div class="flex items-center">
                <Button size="sm" variant="outline" class="rounded-r-none" @click="streamOpen = true">
                    <MonitorPlay />
                    開啟串流
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                        <Button size="sm" variant="outline" class="rounded-l-none border-l-0 px-2" aria-label="選擇播放器">
                            <ChevronDown />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>以播放器開啟</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem v-for="item in PLAYERS" :key="item.code" @select="openStreamWith(item.code)">
                            {{ item.name }}
                            <span v-if="item.code === player" class="ml-auto pl-3 text-xs text-muted-foreground">預設</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem @select="openStreamInTab">
                            <ExternalLink />
                            在新分頁開啟
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <StreamDialog v-model:open="streamOpen" :device="device" :player="player" />
            <Button size="sm" variant="outline" @click="screenshotOpen = true">
                <Camera />
                截圖
            </Button>
            <ScreenshotDialog v-model:open="screenshotOpen" :device="device" />
        </template>

        <Button v-if="canReconnect" size="sm" variant="secondary" :disabled="!isOpen || busy" @click="reconnect">
            <Plug />
            {{ busy ? '連線中…' : '重新連線' }}
        </Button>

        <Button v-if="canDisconnect" size="sm" variant="destructive" :disabled="!isOpen || busy" @click="disconnect">
            <Unplug />
            {{ busy ? '斷線中…' : '斷線' }}
        </Button>
    </div>
</template>
