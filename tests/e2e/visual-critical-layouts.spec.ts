import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { expect, test, type Locator } from "@playwright/test";
import {
  assertChecks,
  baselineFileName,
  captureRegion,
  checkRegion,
  summarizeChecks,
  writeBaselineHash,
  type RegionCheck,
} from "./helpers/visual-regression";

const SAMPLE_DOCX = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "sample.docx");
const BASELINE_DIR = join(dirname(fileURLToPath(import.meta.url)), "visual-baselines");
const UPDATE_BASELINE = process.env.UPDATE_VISUAL_BASELINE === "1";

test.describe("Fase 2C - regressao visual das regioes criticas do fluxo", () => {
  test("captura e valida regioes criticas apos importar e gerar DOCX", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.goto("/#main-content");

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveCount(1);
    await fileInput.setInputFiles(SAMPLE_DOCX);

    await expect(page.getByText(/Arquivo importado:/i)).toBeVisible({ timeout: 60_000 });

    const workType = page.locator("#work-type");
    await expect(workType).toBeVisible();
    await workType.selectOption({ label: "Monografia" });

    await page.locator("#title").fill("Trabalho de conclusao de curso de exemplo");
    await page.locator("#author").fill("Autor Exemplo da Silva");
    await page.locator("#advisor").fill("Prof. Orientador Exemplo");

    await expect(page.getByRole("button", { name: "Gerar DOCX editável" })).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      page.getByRole("button", { name: "Gerar DOCX editável" }).click(),
    ]);
    const workDir = await mkdtemp(join(tmpdir(), "site-abnt-2c-"));
    const docxPath = join(workDir, download.suggestedFilename());
    await download.saveAs(docxPath);
    testInfo.attach("docx-path", { body: docxPath, contentType: "text/plain" });

    const captureDir = join(workDir, "captures");
    await import("node:fs/promises").then((m) => m.mkdir(captureDir, { recursive: true }));

    const regions: Array<{ name: string; locator: Locator; minBytes: number }> = [
      { name: "metadata-pane", locator: page.locator("section.metadata-pane"), minBytes: 4000 },
      { name: "editor-pane", locator: page.locator(".workspace"), minBytes: 4000 },
      { name: "main-content", locator: page.locator("#main-content"), minBytes: 8000 },
    ];

    const checks: RegionCheck[] = [];
    for (const region of regions) {
      await region.locator.scrollIntoViewIfNeeded().catch(() => {});
      const captured = await captureRegion(region.locator, join(captureDir, `${region.name}.png`));
      testInfo.attach(`visual-${region.name}`, { path: captured.path, contentType: "image/png" });
      const check = await checkRegion(captured, BASELINE_DIR, { minBytes: region.minBytes });
      if (UPDATE_BASELINE && check.baselineHash !== captured.hash) {
        await writeBaselineHash(join(BASELINE_DIR, baselineFileName(region.name)), captured.hash);
      }
      checks.push(check);
    }

    const summary = summarizeChecks(checks);
    testInfo.attach("visual-summary", { body: summary, contentType: "text/plain" });
    console.log(`FASE2C visual summary:\n${summary}`);

    assertChecks(checks, UPDATE_BASELINE);

    await rm(workDir, { recursive: true, force: true });
  });
});
