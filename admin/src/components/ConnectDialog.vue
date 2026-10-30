<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import { useLocalStorage } from '@vueuse/core';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_ADB_PORT } from '@/types/protocol';
import { useDeviceTracker } from '@/composables/useDeviceTracker';

const open = defineModel<boolean>('open', { default: false });

const { adbConnect, isOpen } = useDeviceTracker();

const lastHost = useLocalStorage('ws-scrcpy-admin-last-host', '');
const host = ref(lastHost.value);
const port = ref<string | number>(DEFAULT_ADB_PORT);
const pending = ref(false);
const errorMessage = ref('');

watch(open, (value) => {
    if (value) {
        host.value = lastHost.value;
        port.value = DEFAULT_ADB_PORT;
        errorMessage.value = '';
    }
});

const trimmedHost = computed(() => host.value.trim());
const portNumber = computed(() => Number(port.value));
const valid = computed(
    () =>
        trimmedHost.value.length > 0 &&
        !/\s/.test(trimmedHost.value) &&
        Number.isInteger(portNumber.value) &&
        portNumber.value >= 1 &&
        portNumber.value <= 65535,
);

async function submit(): Promise<void> {
    if (!valid.value || pending.value) {
        return;
    }
    const targetHost = trimmedHost.value;
    const targetPort = portNumber.value;
    pending.value = true;
    errorMessage.value = '';
    try {
        const result = await adbConnect(targetHost, targetPort);
        lastHost.value = targetHost;
        toast.success(`已連線 ${targetHost}:${targetPort}`, { description: result.message });
        open.value = false;
    } catch (error) {
        errorMessage.value = (error as Error).message;
        toast.error(`連線失敗 ${targetHost}:${targetPort}`, { description: errorMessage.value });
    } finally {
        pending.value = false;
    }
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-md">
            <form class="grid gap-4" @submit.prevent="submit">
                <DialogHeader>
                    <DialogTitle>連線無線裝置</DialogTitle>
                    <DialogDescription>
                        輸入裝置的 IP 與連接埠，伺服器會執行 adb connect。裝置需先啟用無線偵錯（例如 adb tcpip 5555）。
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-2">
                    <Label for="connect-host">IP 或主機名稱</Label>
                    <Input
                        id="connect-host"
                        v-model="host"
                        placeholder="192.168.1.10"
                        autocomplete="off"
                        autocapitalize="off"
                        spellcheck="false"
                        inputmode="url"
                    />
                </div>

                <div class="grid gap-2">
                    <Label for="connect-port">連接埠</Label>
                    <Input id="connect-port" v-model="port" type="number" min="1" max="65535" inputmode="numeric" />
                </div>

                <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
                <p v-else-if="!isOpen" class="text-sm text-muted-foreground">尚未連線到伺服器，請稍候再試。</p>

                <DialogFooter class="gap-2">
                    <Button type="button" variant="outline" :disabled="pending" @click="open = false">取消</Button>
                    <Button type="submit" :disabled="!valid || !isOpen || pending">
                        {{ pending ? '連線中…' : '連線' }}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</template>
