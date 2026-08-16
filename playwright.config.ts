import { defineConfig } from "@playwright/test";

/**
 * E2E (governance-roadmap): fluxo real do app no navegador.
 *
 * O webServer compila o app (vite build) e serve em 127.0.0.1:4173 via
 * `vite preview` — mesmo artefato de produção, sem depender do Word.
 *
 * Rodar: npm run e2e  (instala o chromium na 1ª vez: npx playwright install chromium)
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
