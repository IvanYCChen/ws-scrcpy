<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import { ArrowUp, Download, File, FileQuestion, Folder, FolderSymlink, HardDrive, LoaderCircle, RefreshCw } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deviceTitle } from '@/lib/device';
import {
    breadcrumbs,
    downloadFile,
    formatSize,
    joinPath,
    listFiles,
    parentPath,
    sortEntries,
    type FileEntry,
} from '@/lib/files';
import type { GoogDeviceDescriptor } from '@/types/protocol';
import { useDeviceTracker } from '@/composables/useDeviceTracker';

const DEFAULT_PATH = '/sdcard';
const QUICK_LINKS = [
    { name: '內部儲存', path: '/sdcard' },
    { name: '暫存', path: '/data/local/tmp' },
    { name: '根目錄', path: '/' },
];

const props = defineProps<{ device: GoogDeviceDescriptor }>();
const open = defineModel<boolean>('open', { default: false });

const { history } = useDeviceTracker();
const title = computed(() => history.get(props.device.udid)?.alias || deviceTitle(props.device));

const path = ref(DEFAULT_PATH);
const entries = ref<FileEntry[]>([]);
const loading = ref(false);
const error = ref('');
let requestId = 0;

const crumbs = computed(() => breadcrumbs(path.value));
const sorted = computed(() => sortEntries(entries.value));

async function load(target: string): Promise<void> {
    const id = ++requestId;
    loading.value = true;
    try {
        const result = await listFiles(props.device.udid, target);
        if (id !== requestId) {
            return;
        }
        path.value = result.path;
        entries.value = result.entries;
        error.value = '';
    } catch (e) {
        if (id !== requestId) {
            return;
        }
        // Keep showing the previous folder when navigation fails; only the first load has nothing to fall back to.
        if (!entries.value.length) {
            path.value = target;
            error.value = (e as Error).message;
        } else {
            toast.error(`無法開啟 ${target}`, { description: (e as Error).message });
        }
    } finally {
        if (id === requestId) {
            loading.value = false;
        }
    }
}

// Reload on every open; the last folder is kept while the page stays open.
watch(open, (value) => {
    if (value) {
        load(path.value);
    }
});

function openEntry(entry: FileEntry): void {
    const target = joinPath(path.value, entry.name);
    if (entry.type === 'dir' || entry.type === 'link') {
        load(target);
    } else if (entry.type === 'file') {
        download(entry);
    }
}

const downloading = ref(new Set<string>());

async function download(entry: FileEntry): Promise<void> {
    const target = joinPath(path.value, entry.name);
    if (downloading.value.has(target)) {
        return;
    }
    downloading.value.add(target);
    try {
        await downloadFile(props.device.udid, target);
        toast.success(`開始下載 ${entry.name}`);
    } catch (e) {
        toast.error(`無法下載 ${entry.name}`, { description: (e as Error).message });
    } finally {
        downloading.value.delete(target);
    }
}

function formatTime(mtime: number): string {
    return new Date(mtime).toLocaleString('zh-TW', { hour12: false });
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent
            class="flex h-[85dvh] max-h-[85dvh] flex-col gap-3 overflow-hidden p-4 sm:max-w-3xl sm:p-6"
        >
            <DialogHeader class="pr-6">
                <DialogTitle class="truncate">{{ title }} 的檔案</DialogTitle>
                <DialogDescription class="truncate">{{ device.udid }} · 點資料夾進入，點檔案下載</DialogDescription>
            </DialogHeader>

            <div class="flex flex-wrap items-center gap-2">
                <Button
                    v-for="link in QUICK_LINKS"
                    :key="link.path"
                    size="sm"
                    :variant="path === link.path ? 'secondary' : 'outline'"
                    @click="load(link.path)"
                >
                    <HardDrive v-if="link.path === '/sdcard'" />
                    <Folder v-else />
                    {{ link.name }}
                </Button>
                <div class="ml-auto flex items-center gap-1">
                    <Button
                        size="icon"
                        variant="ghost"
                        class="size-8"
                        aria-label="上一層"
                        :disabled="path === '/' || loading"
                        @click="load(parentPath(path))"
                    >
                        <ArrowUp />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        class="size-8"
                        aria-label="重新整理"
                        :disabled="loading"
                        @click="load(path)"
                    >
                        <RefreshCw :class="{ 'animate-spin': loading }" />
                    </Button>
                </div>
            </div>

            <nav class="flex min-w-0 flex-wrap items-center gap-0.5 font-mono text-xs" aria-label="路徑">
                <template v-for="(crumb, index) in crumbs" :key="crumb.path">
                    <span v-if="index > 1" class="text-muted-foreground">/</span>
                    <button
                        type="button"
                        class="max-w-48 truncate rounded px-1 py-0.5 hover:bg-accent"
                        :class="index === crumbs.length - 1 ? 'font-semibold' : 'text-muted-foreground'"
                        @click="load(crumb.path)"
                    >
                        {{ crumb.name }}
                    </button>
                </template>
            </nav>

            <div class="min-h-0 flex-1 overflow-auto rounded-md border">
                <div v-if="loading && !entries.length && !error" class="grid gap-2 p-3">
                    <Skeleton v-for="n in 6" :key="n" class="h-8 w-full" />
                </div>
                <div v-else-if="error" class="p-6 text-center text-sm text-destructive">{{ error }}</div>
                <div v-else-if="!sorted.length" class="p-6 text-center text-sm text-muted-foreground">
                    此資料夾是空的或沒有讀取權限
                </div>
                <Table v-else :class="{ 'opacity-60': loading }">
                    <TableHeader class="sticky top-0 z-10 bg-background">
                        <TableRow>
                            <TableHead>名稱</TableHead>
                            <TableHead class="w-24 text-right">大小</TableHead>
                            <TableHead class="hidden w-44 md:table-cell">修改時間</TableHead>
                            <TableHead class="w-12"><span class="sr-only">下載</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="entry in sorted" :key="entry.name">
                            <TableCell class="max-w-0 py-1.5">
                                <button
                                    type="button"
                                    class="flex w-full min-w-0 items-center gap-2 text-left hover:underline disabled:no-underline"
                                    :disabled="entry.type === 'other'"
                                    :title="entry.name"
                                    @click="openEntry(entry)"
                                >
                                    <Folder v-if="entry.type === 'dir'" class="size-4 shrink-0 text-sky-500" />
                                    <FolderSymlink v-else-if="entry.type === 'link'" class="size-4 shrink-0 text-sky-500" />
                                    <File v-else-if="entry.type === 'file'" class="size-4 shrink-0 text-muted-foreground" />
                                    <FileQuestion v-else class="size-4 shrink-0 text-muted-foreground" />
                                    <span class="truncate">{{ entry.name }}</span>
                                </button>
                            </TableCell>
                            <TableCell class="py-1.5 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                                {{ entry.type === 'file' ? formatSize(entry.size) : '' }}
                            </TableCell>
                            <TableCell class="hidden py-1.5 whitespace-nowrap text-muted-foreground tabular-nums md:table-cell">
                                {{ formatTime(entry.mtime) }}
                            </TableCell>
                            <TableCell class="py-1.5">
                                <Button
                                    v-if="entry.type === 'file' || entry.type === 'link'"
                                    size="icon"
                                    variant="ghost"
                                    class="size-8"
                                    :aria-label="`下載 ${entry.name}`"
                                    :disabled="downloading.has(joinPath(path, entry.name))"
                                    @click="download(entry)"
                                >
                                    <LoaderCircle v-if="downloading.has(joinPath(path, entry.name))" class="animate-spin" />
                                    <Download v-else />
                                </Button>
                                <!-- Keeps folder rows as tall as file rows. -->
                                <span v-else class="block size-8" />
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </DialogContent>
    </Dialog>
</template>
