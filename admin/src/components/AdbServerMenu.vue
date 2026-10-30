<script setup lang="ts">
import { ref } from 'vue';
import { toast } from 'vue-sonner';
import { EllipsisVertical, ExternalLink, RotateCcw } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { appBaseUrl } from '@/lib/ws';
import { useDeviceTracker } from '@/composables/useDeviceTracker';

const { adbKillServer, isOpen } = useDeviceTracker();

const confirmOpen = ref(false);
const pending = ref(false);
const mainUiUrl = appBaseUrl().toString();

async function killServer(): Promise<void> {
    if (pending.value) {
        return;
    }
    pending.value = true;
    try {
        const result = await adbKillServer();
        toast.success('已重啟 adb server', { description: result.message });
        confirmOpen.value = false;
    } catch (error) {
        toast.error('重啟 adb server 失敗', { description: (error as Error).message });
    } finally {
        pending.value = false;
    }
}
</script>

<template>
    <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" aria-label="更多操作">
                <EllipsisVertical />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuLabel>ADB</DropdownMenuLabel>
            <DropdownMenuItem :disabled="!isOpen" @select="confirmOpen = true">
                <RotateCcw />
                重啟 adb server
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem as="a" :href="mainUiUrl" target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                開啟原始介面
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>

    <Dialog v-model:open="confirmOpen">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>重啟 adb server？</DialogTitle>
                <DialogDescription>
                    會執行 adb kill-server，所有裝置會短暫斷線，伺服器接著自動重新啟動裝置追蹤；進行中的串流會中斷。
                </DialogDescription>
            </DialogHeader>
            <DialogFooter class="gap-2">
                <Button variant="outline" :disabled="pending" @click="confirmOpen = false">取消</Button>
                <Button variant="destructive" :disabled="pending" @click="killServer">
                    {{ pending ? '執行中…' : '確定重啟' }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
