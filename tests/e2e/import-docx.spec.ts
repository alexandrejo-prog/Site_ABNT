import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";

const SAMPLE_DOCX = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "sample.docx");

test("importar um DOCX valido processa e exibe o conteudo na interface", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto("/#main-content");

  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toHaveCount(1);
  await fileInput.setInputFiles(SAMPLE_DOCX);

  await expect(page.getByText(/Arquivo importado:/i)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Gerar DOCX editável" })).toBeEnabled();

  const importNote = page.locator(".import-note");
  await expect(importNote).toContainText(/Arquivo importado/i);

  expect(pageErrors, `Erros JavaScript:\n${pageErrors.join("\n")}`).toEqual([]);
});
