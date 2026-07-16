import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function writeSamplePdf(): string {
  const path = join(tmpdir(), `site-abnt-accept-${Date.now()}.pdf`);
  const pdf = [
    "%PDF-1.4",
    "1 0 obj",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "endobj",
    "2 0 obj",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "endobj",
    "3 0 obj",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>",
    "endobj",
    "xref",
    "0 4",
    "0000000000 65535 f ",
    "0000000009 00000 n ",
    "0000000052 00000 n ",
    "0000000101 00000 n ",
    "trailer",
    "<< /Size 4 /Root 1 0 R >>",
    "startxref",
    "185",
    "%%EOF",
  ].join("\n");
  writeFileSync(path, pdf, "latin1");
  return path;
}

test("o seletor de importacao aceita arquivos PDF", async ({ page }) => {
  await page.goto("/#main-content");
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toHaveCount(1);
  await expect(fileInput).toHaveAttribute("accept", /(^|.*,\s*)\.pdf(,|$)/);
});

test("selecionar um PDF nao exibe mais a rejeicao de formato nao suportado", async ({ page }) => {
  const pdfPath = writeSamplePdf();
  await page.goto("/#main-content");

  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toHaveCount(1);
  await fileInput.setInputFiles(pdfPath);

  const importNote = page.locator(".import-note");
  // O produto agora suporta PDF: o erro de formato nao suportado nao deve
  // aparecer. Pode haver diagnostico de PDF ou falha de parse do PDF stub,
  // mas nunca a mensagem de formato nao suportado.
  await expect(importNote).not.toContainText("Formato nao suportado. Use .docx, .txt ou .md.", {
    timeout: 30_000,
  });
});
