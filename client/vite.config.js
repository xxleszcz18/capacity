import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules'))
                        return;
                    if (id.includes('recharts') || id.includes('d3-'))
                        return 'charts';
                    if (id.includes('xlsx') || id.includes('exceljs'))
                        return 'excel';
                    if (id.includes('jspdf') || id.includes('html2canvas'))
                        return 'pdf';
                    if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/'))
                        return 'react-vendor';
                },
            },
        },
    },
    server: {
        host: true, // dostęp z sieci LAN / zdalnie (nie tylko localhost)
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
