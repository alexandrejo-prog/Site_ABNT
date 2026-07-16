import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function writeSamplePdf(): string {
  const path = join(tmpdir(), `site-abnt-reject-${Date.now()}.pdf`);
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

test("selecionar um PDF exibe a mensagem de formato nao suportado", async ({ page }) => {
  const pdfPath = writeSamplePdf();

  await page.goto("/#main-content");

  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toHaveCount(1);
  await fileInput.setInputFiles(pdfPath);

  const importNote = page.locator(".import-note");
  await expect(importNote).toContainText("Formato nao suportado. Use .docx, .txt ou .md.", {
    timeout: 30_000,
  });
});
