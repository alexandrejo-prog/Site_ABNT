import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { expect, test } from "@playwright/test";
import { findPowerShell, runWordValidation } from "./helpers/run-word-validation";

const SAMPLE_DOCX = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "sample.docx");

test.describe("Fase 2B - validacao do Word apos gerar DOCX", () => {
  test("gera DOCX pela interface e valida via run-docx-acceptance.ps1", async ({ page }, testInfo) => {
    const powerShell = await findPowerShell();
    test.skip(!powerShell, "PowerShell indisponivel; validacao Word requer Windows.");

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

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

    const workDir = await mkdtemp(join(tmpdir(), "site-abnt-2b-"));
    const docxPath = join(workDir, download.suggestedFilename());
    await download.saveAs(docxPath);
    testInfo.attach("docx-path", { body: docxPath, contentType: "text/plain" });

    const { stat } = await import("node:fs/promises");
    const size = (await stat(docxPath)).size;
    expect(size, `DOCX gerado ausente ou vazio: ${docxPath}`).toBeGreaterThan(0);

    const acceptanceDir = join(workDir, "acceptance");
    const result = await runWordValidation({
      powerShell: powerShell!,
      docxPath,
      outputDirectory: acceptanceDir,
      timeoutMs: 360_000,
    });

    testInfo.attach("word-validation", {
      body: JSON.stringify(
        {
          approved: result.approved,
          pdfExported: result.pdfExported,
          pages: result.pages,
          wordOpened: result.wordOpened,
          exitCode: result.exitCode,
          reportPath: result.reportPath,
        },
        null,
        2
      ),
      contentType: "application/json",
    });

    expect(result.approved, `ACEITE Word reprovado.\n${result.stderr}`).toBe(true);
    expect(result.pdfExported, "Exportacao para PDF falhou no aceite Word.").toBe(true);
    expect(result.wordOpened, "O Word nao abriu o documento durante a validacao.").toBe(true);
    expect(typeof result.pages === "number" && result.pages > 0, "Numero de paginas invalido.").toBe(true);

    expect(pageErrors, `Erros JavaScript:\n${pageErrors.join("\n")}`).toEqual([]);

    await rm(workDir, { recursive: true, force: true });
  });
});
