import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    const target = env.VITE_WS_PROXY_TARGET || 'ws://localhost:8000';
    return {
        // Relative base: the build works no matter which PATHNAME ws-scrcpy is mounted at.
        base: './',
        plugins: [vue(), tailwindcss()],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
        },
        build: {
            outDir: '../dist/public/admin',
            emptyOutDir: true,
            sourcemap: false,
        },
        server: {
            port: 5173,
            proxy: {
                // ws-scrcpy routes WebSocket upgrades by `?action=` only (path is ignored).
                // Vite's own HMR socket has no query string, so it is not matched.
                '^/\?action=': {
                    target,
                    ws: true,
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
    };
});
