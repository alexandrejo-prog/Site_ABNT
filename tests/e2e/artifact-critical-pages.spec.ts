import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { expect, test } from "@playwright/test";
import {
  analyzeDocx,
  assertArtifactChecks,
  baselineFileName,
  checkArtifact,
  summarizeArtifactChecks,
  writeBaselineHash,
  type ArtifactCheck,
} from "./helpers/artifact-pages";

const SAMPLE_DOCX = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "sample.docx");
const BASELINE_DIR = join(dirname(fileURLToPath(import.meta.url)), "artifact-baselines");
const UPDATE_BASELINE = process.env.UPDATE_VISUAL_BASELINE === "1";

test.describe("Fase 2D - regressao do artefato DOCX exportado", () => {
  test("gera DOCX e valida assinatura estrutural das paginas criticas", async ({ page }, testInfo) => {
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
    const workDir = await mkdtemp(join(tmpdir(), "site-abnt-2d-"));
    const docxPath = join(workDir, download.suggestedFilename());
    await download.saveAs(docxPath);
    testInfo.attach("docx-path", { body: docxPath, contentType: "text/plain" });

    const analysis = await analyzeDocx(docxPath);
    testInfo.attach("artifact-analysis", {
      body: JSON.stringify(analysis, null, 2),
      contentType: "application/json",
    });

    const check = await checkArtifact("generated-docx", analysis, BASELINE_DIR);
    if (UPDATE_BASELINE && check.baselineHash !== analysis.fingerprintHash) {
      await writeBaselineHash(join(BASELINE_DIR, baselineFileName("generated-docx")), analysis.fingerprintHash);
    }
    const checks: ArtifactCheck[] = [check];

    const summary = summarizeArtifactChecks(checks);
    testInfo.attach("artifact-summary", { body: summary, contentType: "text/plain" });
    console.log(`FASE2D artifact summary:\n${summary}`);

    expect(analysis.estimatedPages, "Documento exportado sem quebras de pagina/secao.").toBeGreaterThanOrEqual(1);

    assertArtifactChecks(checks, UPDATE_BASELINE, BASELINE_DIR, { minEstimatedPages: 1 });

    await rm(workDir, { recursive: true, force: true });
  });
});
