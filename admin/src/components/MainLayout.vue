<script setup lang="ts">
import { ref } from 'vue';
import { Plus } from '@lucide/vue';
import logoUrl from '@/assets/logo.svg';
import { Button } from '@/components/ui/button';
import AdbServerMenu from '@/components/AdbServerMenu.vue';
import ConnectDialog from '@/components/ConnectDialog.vue';
import DeviceList from '@/components/DeviceList.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import WsStatusIndicator from '@/components/WsStatusIndicator.vue';
import { useDeviceTracker } from '@/composables/useDeviceTracker';

const { isOpen, deviceList, trackerName } = useDeviceTracker();
const connectOpen = ref(false);
</script>

<template>
    <div class="flex min-h-dvh flex-col">
        <header
            class="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70"
            style="padding-top: env(safe-area-inset-top)"
        >
            <div class="mx-auto flex h-14 w-full max-w-6xl items-center gap-1.5 px-4 sm:gap-2">
                <img :src="logoUrl" alt="" class="size-7 shrink-0" />
                <div class="min-w-0 flex-1">
                    <h1 class="truncate text-base font-semibold leading-tight">ws-scrcpy 後臺</h1>
                    <p v-if="trackerName" class="truncate text-xs text-muted-foreground">{{ trackerName }}</p>
                </div>
                <WsStatusIndicator />
                <ThemeToggle />
                <AdbServerMenu />
                <Button size="sm" :disabled="!isOpen" @click="connectOpen = true">
                    <Plus />
                    <span class="hidden sm:inline">連線裝置</span>
                    <span class="sm:hidden">連線</span>
                </Button>
            </div>
        </header>

        <main
            class="mx-auto w-full max-w-6xl flex-1 px-4 py-4"
            style="padding-bottom: calc(1rem + env(safe-area-inset-bottom))"
        >
            <div class="mb-3 flex items-center justify-between">
                <h2 class="text-sm font-medium text-muted-foreground">裝置（{{ deviceList.length }}）</h2>
            </div>
            <DeviceList />
        </main>
    </div>
    <ConnectDialog v-model:open="connectOpen" />
</template>
