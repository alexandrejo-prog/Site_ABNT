import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Módulos exclusivos de Node (rasterizador de figuras, Chromium, canvas nativo).
  // Nunca rodam no browser; excluídos do pre-bundle do esbuild E externalizados
  // no rollup para não quebrar o build ao seguir imports internos
  // (ex.: playwright-core -> chromium-bidi).
  optimizeDeps: {
    exclude: [
      'playwright',
      'playwright-core',
      'chromium-bidi',
      '@napi-rs/canvas',
      'canvas',
    ],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      external: [
        'playwright',
        'playwright-core',
        'chromium-bidi',
        '@napi-rs/canvas',
        'canvas',
        /^node:/,
      ],
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
