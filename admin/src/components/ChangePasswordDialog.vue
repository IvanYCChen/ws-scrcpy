<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { toast } from 'vue-sonner';
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
import { MIN_PASSWORD_LENGTH, useAuth } from '@/composables/useAuth';

const open = defineModel<boolean>('open', { default: false });

const { changePassword } = useAuth();

const current = ref('');
const next = ref('');
const confirm = ref('');
const pending = ref(false);
const errorMessage = ref('');

watch(open, (value) => {
    if (value) {
        current.value = '';
        next.value = '';
        confirm.value = '';
        errorMessage.value = '';
    }
});

const valid = computed(
    () => current.value.length > 0 && next.value.length >= MIN_PASSWORD_LENGTH && next.value === confirm.value,
);

async function submit(): Promise<void> {
    if (!valid.value || pending.value) {
        return;
    }
    pending.value = true;
    errorMessage.value = '';
    try {
        await changePassword(current.value, next.value);
        toast.success('已變更密碼', { description: '其他已登入的瀏覽器需要重新登入。' });
        open.value = false;
    } catch (error) {
        errorMessage.value = (error as Error).message;
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
                    <DialogTitle>變更密碼</DialogTitle>
                    <DialogDescription>變更後，其他已登入的瀏覽器會被登出。</DialogDescription>
                </DialogHeader>

                <div class="grid gap-2">
                    <Label for="pw-current">目前密碼</Label>
                    <Input id="pw-current" v-model="current" type="password" autocomplete="current-password" />
                </div>
                <div class="grid gap-2">
                    <Label for="pw-next">新密碼（至少 {{ MIN_PASSWORD_LENGTH }} 個字元）</Label>
                    <Input id="pw-next" v-model="next" type="password" autocomplete="new-password" />
                </div>
                <div class="grid gap-2">
                    <Label for="pw-confirm">確認新密碼</Label>
                    <Input id="pw-confirm" v-model="confirm" type="password" autocomplete="new-password" />
                    <p v-if="confirm && confirm !== next" class="text-xs text-destructive">兩次輸入的密碼不一致</p>
                </div>

                <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

                <DialogFooter class="gap-2">
                    <Button type="button" variant="outline" :disabled="pending" @click="open = false">取消</Button>
                    <Button type="submit" :disabled="!valid || pending">
                        {{ pending ? '變更中…' : '變更' }}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</template>
