import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separa bibliotecas de geração/importação DOCX
          'docx-libs': ['docx', 'jszip'],
          // Separa ícones do lucide-react
          'icons': ['lucide-react'],
          // Separa React core (já otimizado, mas garante separação)
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
});