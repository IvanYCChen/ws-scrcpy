<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import { EllipsisVertical, FolderOpen, Pencil, SquareTerminal, Trash2 } from '@lucide/vue';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FileBrowserDialog from '@/components/FileBrowserDialog.vue';
import { deviceTitle } from '@/lib/device';
import { DeviceState, type GoogDeviceDescriptor } from '@/types/protocol';
import { useDeviceTracker } from '@/composables/useDeviceTracker';

// xterm is large; load it only when a shell is opened.
const ShellDialog = defineAsyncComponent(() => import('@/components/ShellDialog.vue'));

const MAX_ALIAS_LENGTH = 64;

const props = defineProps<{ device: GoogDeviceDescriptor }>();

const { history, devices, isOpen, setAlias, forgetDevice } = useDeviceTracker();

const entry = computed(() => history.get(props.device.udid));
const name = computed(() => entry.value?.alias || deviceTitle(props.device));
const online = computed(() => devices.get(props.device.udid)?.state === DeviceState.DEVICE);

const aliasOpen = ref(false);
const forgetOpen = ref(false);
const filesOpen = ref(false);
const shellOpen = ref(false);
const alias = ref('');
const pending = ref(false);

watch(aliasOpen, (value) => {
    if (value) {
        alias.value = entry.value?.alias ?? '';
    }
});

async function saveAlias(): Promise<void> {
    if (pending.value) {
        return;
    }
    pending.value = true;
    try {
        await setAlias(props.device.udid, alias.value.trim());
        toast.success(alias.value.trim() ? `已將別名設為「${alias.value.trim()}」` : '已清除別名');
        aliasOpen.value = false;
    } catch (error) {
        toast.error('儲存別名失敗', { description: (error as Error).message });
    } finally {
        pending.value = false;
    }
}

async function forget(): Promise<void> {
    if (pending.value) {
        return;
    }
    pending.value = true;
    try {
        await forgetDevice(props.device.udid);
        toast.success(`已從記錄移除 ${name.value}`);
        forgetOpen.value = false;
    } catch (error) {
        toast.error('移除失敗', { description: (error as Error).message });
    } finally {
        pending.value = false;
    }
}
</script>

<template>
    <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <Button size="icon" variant="ghost" class="size-8" aria-label="裝置選項">
                <EllipsisVertical />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuLabel class="max-w-56 truncate">{{ name }}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem :disabled="!online" @select="filesOpen = true">
                <FolderOpen />
                瀏覽檔案
            </DropdownMenuItem>
            <DropdownMenuItem :disabled="!online" @select="shellOpen = true">
                <SquareTerminal />
                ADB Shell
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem :disabled="!entry || !isOpen" @select="aliasOpen = true">
                <Pencil />
                編輯別名
            </DropdownMenuItem>
            <DropdownMenuItem :disabled="!entry || !isOpen" variant="destructive" @select="forgetOpen = true">
                <Trash2 />
                從記錄移除
            </DropdownMenuItem>
            <p v-if="!entry" class="max-w-56 px-2 py-1.5 text-xs text-muted-foreground">
                此裝置不在記錄中，下次連線時會重新記錄。
            </p>
        </DropdownMenuContent>
    </DropdownMenu>

    <FileBrowserDialog v-model:open="filesOpen" :device="device" />
    <ShellDialog v-if="shellOpen" v-model:open="shellOpen" :device="device" />

    <Dialog v-model:open="aliasOpen">
        <DialogContent class="sm:max-w-md">
            <form class="grid gap-4" @submit.prevent="saveAlias">
                <DialogHeader>
                    <DialogTitle>編輯別名</DialogTitle>
                    <DialogDescription>
                        {{ deviceTitle(device) }}（{{ device.udid }}）。留白則顯示裝置型號。
                    </DialogDescription>
                </DialogHeader>
                <div class="grid gap-2">
                    <Label for="device-alias">別名</Label>
                    <Input
                        id="device-alias"
                        v-model="alias"
                        :maxlength="MAX_ALIAS_LENGTH"
                        :placeholder="deviceTitle(device)"
                        autocomplete="off"
                    />
                </div>
                <DialogFooter class="gap-2">
                    <Button type="button" variant="outline" :disabled="pending" @click="aliasOpen = false">取消</Button>
                    <Button type="submit" :disabled="pending || !isOpen">{{ pending ? '儲存中…' : '儲存' }}</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>

    <Dialog v-model:open="forgetOpen">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>從記錄移除「{{ name }}」？</DialogTitle>
                <DialogDescription>
                    會刪除這台裝置的連線記錄與別名。
                    <template v-if="online">裝置目前仍連線中，不會被斷線；下次重新連線時會再被記錄。</template>
                </DialogDescription>
            </DialogHeader>
            <DialogFooter class="gap-2">
                <Button variant="outline" :disabled="pending" @click="forgetOpen = false">取消</Button>
                <Button variant="destructive" :disabled="pending || !isOpen" @click="forget">
                    {{ pending ? '移除中…' : '移除' }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
