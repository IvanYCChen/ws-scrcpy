<script setup lang="ts">
import { useDark, useToggle } from '@vueuse/core';
import { Moon, Sun } from '@lucide/vue';
import { Button } from '@/components/ui/button';

const isDark = useDark({ storageKey: 'ws-scrcpy-admin-theme' });
const toggleDark = useToggle(isDark);
</script>

<template>
    <Button
        variant="ghost"
        size="icon"
        :aria-label="isDark ? '切換為淺色模式' : '切換為深色模式'"
        @click="toggleDark()"
    >
        <Sun v-if="isDark" />
        <Moon v-else />
    </Button>
</template>
