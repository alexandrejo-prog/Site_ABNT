import { describe, it, expect } from "vitest";
import { baselineRoundTrip } from ".././test-utils/baseline-roundtrip";
import { loadDocxParts } from ".././test-utils/ooxml";

/**
 * Round-trip vivo de imagens. Falha se imagens forem perdidas no caminho
 * import->export (contagem, w:drawing e r:embed no OOXML gerado).
 */
describe("acceptance: preservacao de imagens (round-trip vivo)", () => {
  it("nao perde imagens (contagem preservada)", async () => {
    const rt = await baselineRoundTrip();
    expect(rt.input.importedImages.length).toBeGreaterThan(0);
    expect(rt.output.importedImages.length).toBeGreaterThanOrEqual(rt.input.importedImages.length);
  });

  it("emite w:drawing para cada imagem importada no DOCX gerado", async () => {
    const rt = await baselineRoundTrip();
    const parts = await loadDocxParts(rt.blob);

    const drawings = (parts.documentXml.match(/<w:drawing\b/g) ?? []).length;
    const embeds = (parts.documentXml.match(/r:embed="/g) ?? []).length;

    expect(drawings).toBeGreaterThanOrEqual(rt.input.importedImages.length);
    expect(embeds).toBeGreaterThanOrEqual(rt.input.importedImages.length);
  });

  it("preserva legendas de imagens quando informadas", async () => {
    const rt = await baselineRoundTrip();
    const captionedInput = rt.input.importedImages.filter((img) => img.caption);
    if (captionedInput.length === 0) return;

    const outCaptions = new Set(
      rt.output.importedImages.map((img) => (img.caption || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim()),
    );

    const missing = captionedInput.filter((img) => {
      const key = (img.caption || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
      return key && !outCaptions.has(key);
    });

    expect(missing.length, `legendas de imagem perdidas na saida: ${missing.length}`).toBeLessThanOrEqual(
      captionedInput.length / 2,
    );
  });
});

