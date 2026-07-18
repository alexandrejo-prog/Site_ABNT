import type { ImageRun } from "docx";

// docx (8.5.0) gera o nome do arquivo de mídia e o r:embed da figura a partir de
// um id aleatório (uniqueId()), capturado como string no construtor do ImageRun
// (Blip.embed = `rId{${mediaData.fileName}}`). Isso torna o DOCX não-determinístico
// entre execuções. Forçamos um nome estável derivado do id/arquivo da figura,
// corrigindo o arquivo de mídia, a chave e o atributo r:embed congelado.
export function stabilizeImageRun(run: ImageRun, baseName: string): ImageRun {
  const stableName = baseName.replace(/[^\w.\-]/g, "_");
  const rec = run as unknown as { key: string; imageData: { fileName: string } };
  if (typeof rec.key === "string") rec.key = stableName;
  if (rec.imageData && typeof rec.imageData.fileName === "string") rec.imageData.fileName = stableName;
  const target = `rId{${stableName}}`;
  const walk = (node: unknown): void => {
    if (node == null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const obj = node as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === "string" && /^rId\{.+\}$/.test(v)) {
        obj[k] = target;
      } else if (typeof v === "object" && v !== null) {
        walk(v);
      }
    }
  };
  walk(run);
  return run;
}
