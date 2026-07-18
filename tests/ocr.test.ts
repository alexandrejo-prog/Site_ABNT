import { describe, expect, it } from "vitest";
import { recognizePng, recognizePdfPage, ocrBackendInUse, nativeCliAvailable } from "../src/ocr";
import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";

function renderTextPng(text: string): Uint8Array {
  const cv = createCanvas(400, 120);
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 400, 120);
  ctx.fillStyle = "#000000";
  ctx.font = "36px sans-serif";
  ctx.fillText(text, 20, 70);
  return new Uint8Array(cv.toBuffer("image/png"));
}

describe("OCR — backend e degradação graciosa", () => {
  it("indica backend em uso sem quebrar quando não há binário nativo", async () => {
    const backend = await ocrBackendInUse();
    expect(["native-cli", "tesseract.js", "none"]).toContain(backend);
    // Neste ambiente não há binário Tesseract nativo.
    expect(nativeCliAvailable()).toBe(false);
  });

  it("reconhece texto de uma imagem PNG quando há backend disponível", async () => {
    const png = renderTextPng("UFLA 2026");
    const result = await recognizePng(png, { lang: "por+eng" });
    if (!result.available) {
      // Sem backend (nem nativo nem tesseract.js): degrada sem erro.
      expect(result.text).toBe("");
      expect(result.reason).toBeTruthy();
      return;
    }
    expect(result.text.toUpperCase()).toContain("UFLA");
  });

  it("aplica OCR a uma página de PDF digitalizado (sem camada de texto)", async () => {
    // Monta um PDF cuja única página é uma imagem com texto (sem texto
    // extraível pela camada de texto do PDF).
    const cv = createCanvas(400, 120);
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 400, 120);
    ctx.fillStyle = "#000000"; ctx.font = "36px sans-serif";
    ctx.fillText("RESUMO 2026", 10, 70);
    const pngBytes = cv.toBuffer("image/png");

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([400, 120]);
    const pngImage = await pdf.embedPng(pngBytes);
    page.drawImage(pngImage, { x: 0, y: 0, width: 400, height: 120 });
    const buffer = await pdf.save();

    const result = await recognizePdfPage(new Uint8Array(buffer), 0, { lang: "por+eng" });
    if (!result.available) {
      expect(result.text).toBe("");
      expect(result.reason).toBeTruthy();
      return;
    }
    expect(result.text.toUpperCase()).toContain("RESUMO");
  });
});
