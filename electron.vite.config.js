import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        resolve: {
            alias: {
                '@shared': resolve(__dirname, 'src/shared'),
            },
        },
        build: {
            rollupOptions: {
                // node-pty is a native module; ensure it stays external
                external: ['node-pty'],
            },
        },
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        resolve: {
            alias: {
                '@shared': resolve(__dirname, 'src/shared'),
            },
        },
    },
    renderer: {
        root: '.',
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: {
                '@': resolve(__dirname, 'src/renderer/src'),
                '@shared': resolve(__dirname, 'src/shared'),
            },
        },
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'index.html'),
                },
            },
        },
    },
});
