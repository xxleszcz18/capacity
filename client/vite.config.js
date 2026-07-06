import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                /** Duży import Excel może trwać długo — domyślny timeout proxy bywa za krótki. */
                timeout: 600000,
                proxyTimeout: 600000,
            },
        },
    },
});
