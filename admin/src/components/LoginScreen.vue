<script setup lang="ts">
import { computed, ref } from 'vue';
import { LockKeyhole } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MIN_PASSWORD_LENGTH, useAuth } from '@/composables/useAuth';

const props = defineProps<{ mode: 'setup' | 'login' }>();

const { setup, login } = useAuth();

const password = ref('');
const confirm = ref('');
const pending = ref(false);
const errorMessage = ref('');

const isSetup = computed(() => props.mode === 'setup');
const valid = computed(() =>
    isSetup.value
        ? password.value.length >= MIN_PASSWORD_LENGTH && password.value === confirm.value
        : password.value.length > 0,
);

async function submit(): Promise<void> {
    if (!valid.value || pending.value) {
        return;
    }
    pending.value = true;
    errorMessage.value = '';
    try {
        await (isSetup.value ? setup(password.value) : login(password.value));
    } catch (error) {
        errorMessage.value = (error as Error).message;
        password.value = '';
        confirm.value = '';
    } finally {
        pending.value = false;
    }
}
</script>

<template>
    <div class="flex min-h-dvh items-center justify-center px-4 py-8">
        <Card class="w-full max-w-sm">
            <CardHeader>
                <div class="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
                    <LockKeyhole class="size-5" aria-hidden="true" />
                </div>
                <CardTitle>{{ isSetup ? '設定後臺密碼' : 'ws-scrcpy 後臺' }}</CardTitle>
                <CardDescription>
                    {{
                        isSetup
                            ? `第一次使用，請設定進入後臺的密碼（至少 ${MIN_PASSWORD_LENGTH} 個字元）。`
                            : '請輸入密碼以進入後臺。'
                    }}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form class="grid gap-4" @submit.prevent="submit">
                    <div class="grid gap-2">
                        <Label for="auth-password">{{ isSetup ? '新密碼' : '密碼' }}</Label>
                        <Input
                            id="auth-password"
                            v-model="password"
                            type="password"
                            :autocomplete="isSetup ? 'new-password' : 'current-password'"
                            autofocus
                        />
                    </div>
                    <div v-if="isSetup" class="grid gap-2">
                        <Label for="auth-confirm">確認密碼</Label>
                        <Input id="auth-confirm" v-model="confirm" type="password" autocomplete="new-password" />
                        <p v-if="confirm && confirm !== password" class="text-xs text-destructive">
                            兩次輸入的密碼不一致
                        </p>
                    </div>

                    <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

                    <Button type="submit" :disabled="!valid || pending">
                        {{ pending ? '處理中…' : isSetup ? '設定並進入' : '登入' }}
                    </Button>
                </form>
            </CardContent>
        </Card>
    </div>
</template>
