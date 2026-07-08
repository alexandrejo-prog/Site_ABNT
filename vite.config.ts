import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Separa bibliotecas de geração/exportação DOCX
          'docx-libs': ['docx', 'jszip'],
          // Separa biblioteca de leitura/importação DOCX
          'import-libs': ['mammoth'],
          // Separa ícones do lucide-react
          'icons': ['lucide-react'],
          // Separa React core
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
});
