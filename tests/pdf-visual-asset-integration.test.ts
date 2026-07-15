import { describe, expect, it } from "vitest";
import type { ImportedPdfDiagnostic, PdfLayoutSensitiveRegionDiagnostic } from "../src/imported-pdf-diagnostic";
import type { PdfVisualCropGeometry } from "../src/pdf-visual-crop-geometry";
import type { PdfTextDraftVisualAsset } from "../src/pdf-text-draft-contract";
import {
  decideLogicalVisualEmission,
  decideRegionVisualEmission,
  isRasterizablePdfRegionKind,
  pdfRegionCropKey,
  rasterizablePdfCrops,
  visualAssetEntriesForLogicalVisual,
  visualAssetEntriesForRegion,
} from "../src/pdf-visual-asset-integration";

type RegionKind = PdfLayoutSensitiveRegionDiagnostic["kind"];

function makeRegion(overrides: Partial<PdfLayoutSensitiveRegionDiagnostic> = {}): PdfLayoutSensitiveRegionDiagnostic {
  return {
    id: "layout-1",
    pageStart: 1,
    pageEnd: 1,
    startLineIndex: 0,
    endLineIndex: 2,
    kind: "quadro",
    confidence: "high",
    reasons: [],
    ...overrides,
  };
}

function crop(overrides: Partial<PdfVisualCropGeometry> = {}): PdfVisualCropGeometry {
  return {
    regionId: "layout-1",
    visualKey: "visual-1",
    pageNumber: 1,
    sourceRect: { x: 0, y: 0, width: 100, height: 100 },
    normalizedRect: { x: 0, y: 0, width: 0.5, height: 0.5 },
    pageWidth: 1000,
    pageHeight: 1000,
    confidence: "high",
    reasons: [],
    ...overrides,
  };
}

function asset(): PdfTextDraftVisualAsset {
  return { data: new Uint8Array([1, 2, 3]), width: 100, height: 100, altText: { title: "t", description: "d", name: "n" } };
}

describe("politica de regioes rasterizaveis", () => {
  it("aceita os tipos graficos permitidos", () => {
    const allowed: RegionKind[] = ["quadro", "tabela", "figura", "grafico", "imagem", "mapa", "ilustracao"];
    for (const kind of allowed) {
      expect(isRasterizablePdfRegionKind(kind)).toBe(true);
    }
  });

  it("bloqueia multicolumn", () => {
    expect(isRasterizablePdfRegionKind("multicolumn")).toBe(false);
  });

  it("bloqueia unknown", () => {
    expect(isRasterizablePdfRegionKind("unknown")).toBe(false);
  });

  it("retorna false para tipo ausente", () => {
    expect(isRasterizablePdfRegionKind(undefined)).toBe(false);
  });
});

describe("chave composta de recorte", () => {
  it("monta a chave exata", () => {
    expect(pdfRegionCropKey("visual-1", 7, "layout-1")).toBe("visual-1::p7::rlayout-1");
    expect(pdfRegionCropKey("v", 1, "r1")).toBe("v::p1::rr1");
  });
});

describe("busca de ativos por regiao", () => {
  it("recupera duas paginas e ordena por numero", () => {
    const region = makeRegion({ id: "rA", logicalVisualId: "shared", kind: "quadro" });
    const visualAssets: Record<string, PdfTextDraftVisualAsset> = {
      "shared::p2::rrA": asset(),
      "shared::p1::rrA": asset(),
    };
    const entries = visualAssetEntriesForRegion(region, visualAssets);
    expect(entries.map((entry) => entry.pageNumber)).toEqual([1, 2]);
    expect(entries.every((entry) => entry.key.endsWith("::rrA"))).toBe(true);
  });

  it("ordena numericamente mesmo com ordem embaralhada", () => {
    const region = makeRegion({ id: "rA", logicalVisualId: "shared", kind: "tabela" });
    const visualAssets: Record<string, PdfTextDraftVisualAsset> = {
      "shared::p3::rrA": asset(),
      "shared::p1::rrA": asset(),
      "shared::p2::rrA": asset(),
    };
    const entries = visualAssetEntriesForRegion(region, visualAssets);
    expect(entries.map((entry) => entry.pageNumber)).toEqual([1, 2, 3]);
  });

  it("nao mistura regioes com mesmo logicalVisualId", () => {
    const regionA = makeRegion({ id: "rA", logicalVisualId: "shared", kind: "figura" });
    const visualAssets: Record<string, PdfTextDraftVisualAsset> = {
      "shared::p1::rrA": asset(),
      "shared::p2::rrB": asset(),
    };
    const entries = visualAssetEntriesForRegion(regionA, visualAssets);
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe("shared::p1::rrA");
  });

  it("nao casa regiao por id parcial", () => {
    const region = makeRegion({ id: "1", logicalVisualId: "visual-1", kind: "figura" });
    const visualAssets: Record<string, PdfTextDraftVisualAsset> = {
      "visual-1::p1::r1-extra": asset(),
      "visual-1::p1::r10": asset(),
    };
    expect(visualAssetEntriesForRegion(region, visualAssets)).toEqual([]);
  });

  it("aceita ativo legado pela chave visualKey", () => {
    const region = makeRegion({ id: "layout-1", logicalVisualId: "quadro-1", kind: "quadro" });
    const visualAssets: Record<string, PdfTextDraftVisualAsset> = {
      "quadro-1": asset(),
    };
    const entries = visualAssetEntriesForRegion(region, visualAssets);
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe("quadro-1");
    expect(entries[0].pageNumber).toBe(1);
  });

  it("da preferencia ao composto quando ha legado tambem", () => {
    const region = makeRegion({ id: "rA", logicalVisualId: "shared", kind: "quadro" });
    const legacy = asset();
    const composite = asset();
    const visualAssets: Record<string, PdfTextDraftVisualAsset> = {
      "shared": legacy,
      "shared::p1::rrA": composite,
      "shared::p2::rrA": asset(),
    };
    const entries = visualAssetEntriesForRegion(region, visualAssets);
    expect(entries.map((entry) => entry.key)).toEqual(["shared::p1::rrA", "shared::p2::rrA"]);
    expect(entries[0].asset).toBe(composite);
  });

  it("retorna vazio quando nao ha ativo", () => {
    expect(visualAssetEntriesForRegion(makeRegion(), {})).toEqual([]);
    expect(visualAssetEntriesForRegion(undefined, { "x": asset() })).toEqual([]);
  });

  it("nao muta os objetos de ativo originais", () => {
    const original = asset();
    const visualAssets: Record<string, PdfTextDraftVisualAsset> = { "layout-1::p1::rlayout-1": original };
    const before = { ...original };
    const entries = visualAssetEntriesForRegion(makeRegion(), visualAssets);
    expect(entries[0].asset).toBe(original);
    expect(original).toEqual(before);
  });
});

describe("filtro de crops rasterizaveis", () => {
  function diagnostic(regions: PdfLayoutSensitiveRegionDiagnostic[]): ImportedPdfDiagnostic {
    return {
      fileName: "x.pdf",
      pageCount: 1,
      pages: [],
      pretextual: { warnings: [] },
      bodyStart: { found: false },
      reconstruction: {
        blocks: [],
        ignoredLines: [],
        bodyStart: { found: false },
        bodyLayoutMetrics: { dominantLeft: 0, dominantRight: 0, medianLineHeight: 0, medianLineGap: 0, probableFirstLineIndent: 0, probableBodyFontHeight: 0, confidence: "low" },
        layoutRegions: regions,
        hyphenation: [],
        alerts: [],
        statistics: {} as ImportedPdfDiagnostic["reconstruction"]["statistics"],
      },
      warnings: [],
    };
  }

  it("exclui multicolumn e unknown, mantem graficos", () => {
    const regions: PdfLayoutSensitiveRegionDiagnostic[] = [
      makeRegion({ id: "rQuadro", kind: "quadro" }),
      makeRegion({ id: "rTabela", kind: "tabela" }),
      makeRegion({ id: "rFigura", kind: "figura" }),
      makeRegion({ id: "rMulti", kind: "multicolumn" }),
      makeRegion({ id: "rUnknown", kind: "unknown" }),
    ];
    const crops = regions.map((r) => crop({ regionId: r.id, visualKey: r.logicalVisualId ?? r.id }));
    const result = rasterizablePdfCrops(diagnostic(regions), crops);
    expect(result.map((c) => c.regionId).sort()).toEqual(["rFigura", "rQuadro", "rTabela"]);
  });

  it("retorna vazio quando nao ha crops", () => {
    expect(rasterizablePdfCrops(diagnostic([]), [])).toEqual([]);
  });
});

describe("decisao atomica de emissao visual", () => {
  function keysFor(visualKey: string, regionId: string, pages: number[]): Set<string> {
    return new Set(pages.map((p) => pdfRegionCropKey(visualKey, p, regionId)));
  }

  it("I1 multipagina com todas as paginas recortadas gera todas as partes (images)", () => {
    const region = makeRegion({ id: "r1", logicalVisualId: "q1", pageStart: 1, pageEnd: 3, kind: "quadro" });
    const keys = keysFor("q1", "r1", [1, 2, 3]);
    const decision = decideRegionVisualEmission(region, keys);
    expect(decision.mode).toBe("images");
    expect(decision.pagesCovered).toBe(3);
    expect(decision.pagesTotal).toBe(3);
  });

  it("I2 multipagina com uma pagina faltando gera marcador unico (nenhuma imagem)", () => {
    const region = makeRegion({ id: "r1", logicalVisualId: "q1", pageStart: 1, pageEnd: 3, kind: "quadro" });
    const keys = keysFor("q1", "r1", [1, 3]); // pagina 2 ausente
    const decision = decideRegionVisualEmission(region, keys);
    expect(decision.mode).toBe("marker");
    expect(decision.pagesCovered).toBe(2);
    expect(decision.pagesTotal).toBe(3);
  });

  it("I3 marcador cobre o intervalo integral da regiao (pageStart-pageEnd)", () => {
    const region = makeRegion({ id: "r1", logicalVisualId: "q1", pageStart: 5, pageEnd: 8, kind: "tabela" });
    const keys = keysFor("q1", "r1", [5, 8]); // pagina 6 e 7 ausentes
    const decision = decideRegionVisualEmission(region, keys);
    expect(decision.mode).toBe("marker");
    expect(decision.pageStart).toBe(5);
    expect(decision.pageEnd).toBe(8);
  });

  it("I4 regiao com intervalo amplo contabiliza pagesTotal integral", () => {
    const region = makeRegion({ id: "r1", logicalVisualId: "q1", pageStart: 1, pageEnd: 4, kind: "quadro" });
    const keys = keysFor("q1", "r1", [1, 2, 3, 4]);
    const decision = decideRegionVisualEmission(region, keys);
    expect(decision.pagesTotal).toBe(4);
    expect(decision.pagesCovered).toBe(4);
    expect(decision.mode).toBe("images");
  });

  it("I5 duas regioes com mesmo logicalVisualId (continuacoes) emitem todas as partes quando todas as paginas existem", () => {
    const a = makeRegion({ id: "rA", logicalVisualId: "q1", pageStart: 1, pageEnd: 2, kind: "quadro" });
    const b = makeRegion({ id: "rB", logicalVisualId: "q1", pageStart: 3, pageEnd: 4, kind: "quadro" });
    const keys = new Set([...keysFor("q1", "rA", [1, 2]), ...keysFor("q1", "rB", [3, 4])]);
    const decisionA = decideRegionVisualEmission(a, keys);
    const decisionB = decideRegionVisualEmission(b, keys);
    expect(decisionA.mode).toBe("images");
    expect(decisionB.mode).toBe("images");
    expect(decisionA.pagesCovered).toBe(2);
    expect(decisionB.pagesCovered).toBe(2);
  });

  it("I6 grupo logico totalmente valido gera todas as imagens em ordem", () => {
    const a = makeRegion({ id: "rA", logicalVisualId: "q8", pageStart: 63, pageEnd: 63, kind: "quadro" });
    const b = makeRegion({ id: "rB", logicalVisualId: "q8", pageStart: 64, pageEnd: 64, kind: "quadro" });
    const keys = new Set([...keysFor("q8", "rA", [63]), ...keysFor("q8", "rB", [64])]);
    const decision = decideLogicalVisualEmission([a, b], keys);
    expect(decision.mode).toBe("images");
    expect(decision.pagesCovered).toBe(2);
    expect(decision.pagesTotal).toBe(2);
    expect(decision.pageStart).toBe(63);
    expect(decision.pageEnd).toBe(64);
  });

  it("I7 grupo logico parcialmente valido gera marcador unico (nenhuma imagem)", () => {
    const a = makeRegion({ id: "rA", logicalVisualId: "q8", pageStart: 63, pageEnd: 63, kind: "quadro" });
    const b = makeRegion({ id: "rB", logicalVisualId: "q8", pageStart: 64, pageEnd: 64, kind: "quadro" });
    const keys = new Set(keysFor("q8", "rA", [63])); // rB ausente
    const decision = decideLogicalVisualEmission([a, b], keys);
    expect(decision.mode).toBe("marker"); // nao images+marker
    expect(decision.pagesCovered).toBe(1);
    expect(decision.pagesTotal).toBe(2);
    expect(decision.pageStart).toBe(63);
    expect(decision.pageEnd).toBe(64); // abrange o grupo completo
  });

  it("I8 grupos distintos sao decididos independentemente", () => {
    const q8a = makeRegion({ id: "rA", logicalVisualId: "q8", pageStart: 63, pageEnd: 63, kind: "quadro" });
    const q8b = makeRegion({ id: "rB", logicalVisualId: "q8", pageStart: 64, pageEnd: 64, kind: "quadro" });
    const other = makeRegion({ id: "rC", logicalVisualId: "q9", pageStart: 70, pageEnd: 70, kind: "quadro" });
    const keys = new Set([...keysFor("q8", "rA", [63]), ...keysFor("q9", "rC", [70])]);
    const q8 = decideLogicalVisualEmission([q8a, q8b], keys);
    const q9 = decideLogicalVisualEmission([other], keys);
    expect(q8.mode).toBe("marker"); // rB ausente
    expect(q9.mode).toBe("images"); // presente
  });

  it("I9 ativos do grupo logico sao ordenados por pagina e regiao", () => {
    const a = makeRegion({ id: "rA", logicalVisualId: "q8", pageStart: 63, pageEnd: 63, kind: "quadro" });
    const b = makeRegion({ id: "rB", logicalVisualId: "q8", pageStart: 64, pageEnd: 64, kind: "quadro" });
    const visualAssets: Record<string, PdfTextDraftVisualAsset> = {
      "q8::p64::rrB": asset(),
      "q8::p63::rrA": asset(),
    };
    const entries = visualAssetEntriesForLogicalVisual([a, b], visualAssets);
    expect(entries.map((entry) => entry.key)).toEqual(["q8::p63::rrA", "q8::p64::rrB"]);
  });
});
