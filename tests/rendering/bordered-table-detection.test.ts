import { expect, it } from "vitest";
import { detectBorderedTableRegions } from "../../scripts/ufla-compliance/analyze-pdf-physical";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const OPS = pdfjsLib.OPS;
const PH = 841.92;

/**
 * Monta um opList sintético imitando o que o Word exporta:
 * cada aresta de célula = constructPath([rectangle], [x,y,w,h]) + eoFill.
 * Clips de texto = rect + eoClip (não preenchidos) — não contam.
 */
function buildOpList(rects: Array<{ x: number; y: number; w: number; h: number; filled?: boolean }>) {
  const fnArray: number[] = [];
  const argsArray: unknown[] = [];
  for (const r of rects) {
    fnArray.push(OPS.constructPath);
    argsArray.push([[OPS.rectangle], [r.x, r.y, r.w, r.h]]);
    fnArray.push(r.filled === false ? OPS.eoClip : OPS.eoFill);
    argsArray.push(null);
  }
  return { fnArray, argsArray };
}

it("detecta grid 2×2 de tabela com bordas desenhadas (retângulos preenchidos)", () => {
  // grid 2 colunas × 2 linhas: células de 100×60 em x=100,200 e y=300,360 (espaço PDF, y p/ cima)
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (const cx of [100, 200]) {
    for (const cy of [300, 360]) {
      rects.push({ x: cx, y: cy, w: 100, h: 1.2 }); // borda superior
      rects.push({ x: cx, y: cy + 60, w: 100, h: 1.2 }); // borda inferior
      rects.push({ x: cx, y: cy, w: 1.2, h: 60 }); // borda esquerda
      rects.push({ x: cx + 100, y: cy, w: 1.2, h: 60 }); // borda direita
    }
  }
  const regions = detectBorderedTableRegions(buildOpList(rects), OPS, PH);
  expect(regions).toHaveLength(1);
  expect(regions[0].cols).toBeGreaterThanOrEqual(2);
  expect(regions[0].rows).toBeGreaterThanOrEqual(2);
});

it("não detecta tabela em página só com clips de texto (rect + eoClip, página inteira)", () => {
  // clips de texto do Word: rect de página inteira seguido de eoClip (NÃO preenchido)
  const rects = [
    { x: 0, y: 0, w: 595.32, h: 841.92, filled: false },
    { x: 0, y: 0, w: 595.32, h: 841.92, filled: false },
    { x: 0, y: 0, w: 595.32, h: 841.92, filled: false },
    { x: 0, y: 0, w: 595.32, h: 841.92, filled: false },
  ];
  const regions = detectBorderedTableRegions(buildOpList(rects), OPS, PH);
  expect(regions).toHaveLength(0);
});

it("não detecta caixa única (1 coluna × 1 linha) como tabela", () => {
  const rects = [
    { x: 100, y: 300, w: 200, h: 1.2 },
    { x: 100, y: 460, w: 200, h: 1.2 },
    { x: 100, y: 300, w: 1.2, h: 160 },
    { x: 300, y: 300, w: 1.2, h: 160 },
  ];
  const regions = detectBorderedTableRegions(buildOpList(rects), OPS, PH);
  expect(regions).toHaveLength(0);
});

it("não detecta em página com poucas linhas de borda (menos de 4 H e 4 V)", () => {
  const rects = [
    { x: 100, y: 300, w: 200, h: 1.2 },
    { x: 100, y: 460, w: 200, h: 1.2 },
    { x: 100, y: 300, w: 1.2, h: 160 },
  ];
  const regions = detectBorderedTableRegions(buildOpList(rects), OPS, PH);
  expect(regions).toHaveLength(0);
});

it("compõe CTM com save/restore e transform identity sem quebrar", () => {
  // transform identity + grid 2×2: mulMatrix deve compor corretamente
  const fnArray: number[] = [OPS.transform];
  const argsArray: unknown[] = [[1, 0, 0, 1, 0, 0]];
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (const cx of [100, 200]) {
    for (const cy of [300, 360]) {
      rects.push({ x: cx, y: cy, w: 100, h: 1.2 });
      rects.push({ x: cx, y: cy + 60, w: 100, h: 1.2 });
      rects.push({ x: cx, y: cy, w: 1.2, h: 60 });
      rects.push({ x: cx + 100, y: cy, w: 1.2, h: 60 });
    }
  }
  for (const r of rects) {
    fnArray.push(OPS.constructPath, OPS.eoFill);
    argsArray.push([[OPS.rectangle], [r.x, r.y, r.w, r.h]], null);
  }
  const regions = detectBorderedTableRegions({ fnArray, argsArray }, OPS, PH);
  expect(regions).toHaveLength(1);
});
