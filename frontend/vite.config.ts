import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, './src'),
        },
    },
    server: {
        // Dedicated ports so we don't collide with the other ONDC apps the
        // user runs (automation-frontend uses 5173/4000). strictPort makes a
        // collision fail loudly instead of silently bumping to 5174.
        port: 5190,
        strictPort: true,
        proxy: {
            // Backend aggregation/proxy API (incl. SSE log tail).
            '/api': {
                target: 'http://localhost:4090',
                changeOrigin: true,
            },
        },
    },
});
