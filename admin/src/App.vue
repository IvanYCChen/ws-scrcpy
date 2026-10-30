<script setup lang="ts">
import { onMounted } from 'vue';
import { Loader2 } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import LoginScreen from '@/components/LoginScreen.vue';
import MainLayout from '@/components/MainLayout.vue';
import { useAuth } from '@/composables/useAuth';

const { status, errorMessage, refresh } = useAuth();

onMounted(refresh);
</script>

<template>
    <TooltipProvider>
        <!-- MainLayout owns the device tracker, so its WebSocket only opens once logged in and closes on logout. -->
        <MainLayout v-if="status === 'ok'" />
        <LoginScreen v-else-if="status === 'setup' || status === 'login'" :key="status" :mode="status" />
        <div v-else class="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
            <Loader2
                v-if="status === 'loading'"
                class="size-6 animate-spin text-muted-foreground"
                aria-label="載入中"
            />
            <template v-else>
                <p class="text-sm text-muted-foreground">無法連線到伺服器：{{ errorMessage }}</p>
                <Button size="sm" variant="outline" @click="refresh">重試</Button>
            </template>
        </div>

        <Toaster position="top-center" rich-colors close-button />
    </TooltipProvider>
</template>
