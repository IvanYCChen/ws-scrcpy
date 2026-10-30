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
            // Served at the base path; shares dist/public with the webpack player (stream.html, bundle.js…),
            // so the folder must not be emptied and the assets go in their own subfolder.
            outDir: '../dist/public',
            emptyOutDir: false,
            assetsDir: 'admin-assets',
            sourcemap: false,
        },
        server: {
            port: 5173,
            proxy: {
                // Auth endpoints (same origin in dev too, so the session cookie is shared with the WebSocket).
                '^/api/': {
                    target: target.replace(/^ws/, 'http'),
                    changeOrigin: true,
                    secure: false,
                },
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
