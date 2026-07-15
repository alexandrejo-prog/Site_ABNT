import { describe, expect, it } from "vitest";
import { buildLogicalVisualDecisions, planVisualEmissions } from "../src/export-pdf-text-draft-docx";
import type { PdfLayoutSensitiveRegionDiagnostic } from "../src/imported-pdf-diagnostic";
import type { PdfReconstructedBlockDiagnostic } from "../src/imported-pdf-diagnostic";
import type { PdfTextDraftVisualAsset } from "../src/pdf-text-draft-contract";
import type { PdfTextDraftExportInput } from "../src/pdf-text-draft-contract";
import type { PdfTextReconstructionDiagnostic } from "../src/imported-pdf-diagnostic";
import { pdfRegionCropKey } from "../src/pdf-visual-asset-integration";

const MARKER = "Elemento visual não inserido neste rascunho textual";

function region(id: string, kind: PdfLayoutSensitiveRegionDiagnostic["kind"], logicalVisualId: string, pages: number[]): PdfLayoutSensitiveRegionDiagnostic {
  return {
    id,
    pageStart: pages[0],
    pageEnd: pages[pages.length - 1],
    startLineIndex: 0,
    endLineIndex: 10,
    kind,
    caption: logicalVisualId,
    confidence: "high",
    reasons: [],
    logicalVisualId,
  };
}

function caption(layoutRegionId: string): PdfReconstructedBlockDiagnostic {
  return { type: "caption", layoutRegionId, text: "legenda", sourceLines: [], startPage: 1, endPage: 1, lines: [], style: "body" } as unknown as PdfReconstructedBlockDiagnostic;
}

function listItem(lid: string, lineIndex: number): PdfReconstructedBlockDiagnostic {
  return { type: "list-item", text: `Lista ${lid}`, sourceLines: [{ pageNumber: 1, lineIndex }], startPage: 1, endPage: 1, lines: [], style: "body" } as unknown as PdfReconstructedBlockDiagnostic;
}

function asset(): PdfTextDraftVisualAsset {
  return { data: new Uint8Array([1, 2, 3, 4]), width: 10, height: 10 };
}

function buildInput(opts: {
  regions: PdfLayoutSensitiveRegionDiagnostic[];
  blocks: PdfReconstructedBlockDiagnostic[];
  assets?: Record<string, PdfTextDraftVisualAsset>;
}): PdfTextDraftExportInput {
  return {
    sourceKind: "pdf",
    documentMode: "pdf-text-draft",
    fileName: "t.pdf",
    pageCount: 10,
    reconstruction: {
      layoutRegions: opts.regions,
      blocks: opts.blocks,
      pages: [],
      globalText: "",
    } as unknown as PdfTextReconstructionDiagnostic,
    visualAssets: opts.assets ?? {},
  };
}

describe("cobertura de ativos visuais lógicos (integração)", () => {
  it("um único recorte com ativo completo gera images e nenhum marker", async () => {
    const regions = [region("layout-a", "grafico", "grafico-a-page-1", [1])];
    const assets = { [pdfRegionCropKey("grafico-a-page-1", 1, "layout-a")]: asset() };
    const input = buildInput({ regions, blocks: [caption("layout-a")], assets });
    const decisions = buildLogicalVisualDecisions(input);
    const plan = planVisualEmissions(input, decisions);
    expect(plan.imageLids).toContain("grafico-a-page-1");
    expect(plan.markerLids).not.toContain("grafico-a-page-1");
  });

  it("um único recorte com ativo faltando gera exatamente um marker", async () => {
    const regions = [region("layout-a", "grafico", "grafico-a-page-1", [1])];
    const input = buildInput({ regions, blocks: [caption("layout-a")], assets: {} });
    const decisions = buildLogicalVisualDecisions(input);
    const plan = planVisualEmissions(input, decisions);
    expect(plan.markerLids).toContain("grafico-a-page-1");
    expect(plan.imageLids).not.toContain("grafico-a-page-1");
  });

  it("lid com região e bloco source sem legenda gera marcador de fallback com warning", async () => {
    const regions = [region("layout-a", "grafico", "grafico-a-page-1", [1])];
    const sourceBlock = { type: "source", layoutRegionId: "layout-a", text: "fonte", sourceLines: [], startPage: 1, endPage: 1, lines: [], style: "body" } as unknown as PdfReconstructedBlockDiagnostic;
    const input = buildInput({ regions, blocks: [sourceBlock], assets: {} });
    const decisions = buildLogicalVisualDecisions(input);
    const plan = planVisualEmissions(input, decisions);
    expect(plan.markerLids).toContain("grafico-a-page-1");
    expect(plan.warnings.some((w) => w.includes("grafico-a-page-1") && w.includes("marcador=sim"))).toBe(true);
  });

  it("multipágina com 2 esperados e apenas 1 ativo gera marker e nenhum ativo órfão", async () => {
    const regions = [region("layout-a", "grafico", "grafico-multi", [1, 2])];
    const assets = { [pdfRegionCropKey("grafico-multi", 1, "layout-a")]: asset() };
    const input = buildInput({ regions, blocks: [caption("layout-a")], assets });
    const decisions = buildLogicalVisualDecisions(input);
    const plan = planVisualEmissions(input, decisions);
    expect(plan.markerLids).toContain("grafico-multi");
    expect(plan.imageLids).not.toContain("grafico-multi");
  });

  it("multipágina com 2 ativos válidos gera images e nenhum marker", async () => {
    const regions = [region("layout-a", "grafico", "grafico-multi", [1, 2])];
    const assets = {
      [pdfRegionCropKey("grafico-multi", 1, "layout-a")]: asset(),
      [pdfRegionCropKey("grafico-multi", 2, "layout-a")]: asset(),
    };
    const input = buildInput({ regions, blocks: [caption("layout-a")], assets });
    const decisions = buildLogicalVisualDecisions(input);
    const plan = planVisualEmissions(input, decisions);
    expect(plan.imageLids).toContain("grafico-multi");
    expect(plan.markerLids).not.toContain("grafico-multi");
  });

  it("entrada de lista (Lista de Quadros) permanece ignorada", async () => {
    const regions = [region("r-lista", "quadro", "lista-quadros", [1])];
    const input = buildInput({ regions, blocks: [listItem("lista-quadros", 5)] });
    const decisions = buildLogicalVisualDecisions(input);
    const plan = planVisualEmissions(input, decisions);
    expect(plan.ignoredLids).toContain("lista-quadros");
    expect(plan.imageLids).not.toContain("lista-quadros");
    expect(plan.markerLids).not.toContain("lista-quadros");
  });

  it("nenhum id visual elegível fica sem estado final", async () => {
    const regions = [
      region("layout-a", "grafico", "grafico-a", [1]),
      region("layout-b", "figura", "figura-b", [2]),
      region("layout-c", "tabela", "tabela-c", [3]),
    ];
    const assets = {
      [pdfRegionCropKey("grafico-a", 1, "layout-a")]: asset(),
      [pdfRegionCropKey("tabela-c", 3, "layout-c")]: asset(),
    };
    const input = buildInput({ regions, blocks: [caption("layout-a"), caption("layout-b"), caption("layout-c")], assets });
    const decisions = buildLogicalVisualDecisions(input);
    const plan = planVisualEmissions(input, decisions);
    const resolved = new Set([...plan.imageLids, ...plan.markerLids, ...plan.ignoredLids]);
    expect(resolved.has("grafico-a")).toBe(true);
    expect(resolved.has("figura-b")).toBe(true);
    expect(resolved.has("tabela-c")).toBe(true);
  });

  it("texto do marker é o valor fixo autorizado", async () => {
    const regions = [region("layout-a", "grafico", "grafico-a-page-1", [1])];
    const input = buildInput({ regions, blocks: [caption("layout-a")], assets: {} });
    const decisions = buildLogicalVisualDecisions(input);
    const plan = planVisualEmissions(input, decisions);
    expect(plan.markerText).toBe(MARKER);
  });
});
