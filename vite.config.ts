import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Separa bibliotecas de geração/exportação DOCX (docx + jszip)
          if (id.includes("/node_modules/docx/") || id.includes("/node_modules/jszip/")) {
            return "docx-libs";
          }
          // mammoth é importado como "mammoth/mammoth.browser": separa por
          // prefixo de pacote para que a cadeia de importação fique num chunk
          // próprio, longe do índice (o chunk só carrega no upload do arquivo).
          if (id.includes("/node_modules/mammoth/")) {
            return "import-libs";
          }
          // Ícones do lucide-react
          if (id.includes("/node_modules/lucide-react/")) {
            return "icons";
          }
          // React core
          if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/") || id.includes("/node_modules/scheduler/")) {
            return "react-vendor";
          }
        },
      },
    },
  },
});
