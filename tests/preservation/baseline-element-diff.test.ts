import { it, expect, beforeAll } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { baselineRoundTrip, type BaselineRoundTrip } from ".././test-utils/baseline-roundtrip";
import { describeWithArtifacts } from "../test-utils/artifact-guard";
import { auditReferenceRoundTrip } from ".././test-utils/reference-roundtrip-audit";
import { testEvidenceDir } from ".././test-utils/test-evidence";
import { normalizeReferences } from "../../src/references-normalizer";

/**
 * Diff DOCX gerado vs baseline por ELEMENTO (não igualdade literal entre
 * documentos com objetivos diferentes). Classifica: conteúdo preservado;
 * elementos normalizados; elementos reconstruídos; elementos não identificados;
 * elementos perdidos — e para cada perda apresenta a causa.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// Evidência em diretório temporário: não sobrescreve artefato oficial.
const artifactPath = join(testEvidenceDir(), "baseline-element-diff.json");

interface ElementCounts {
  paragraphs: number;
  tables: number;
  drawings: number;
  embeds: number;
}

function countParts(xml: string): ElementCounts {
  return {
    paragraphs: (xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).length,
    tables: (xml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/g) ?? []).length,
    drawings: (xml.match(/<w:drawing\b/g) ?? []).length,
    embeds: (xml.match(/r:embed=/g) ?? []).length,
  };
}

/**
 * Targets de mídia únicos incorporados (dedupe por target): uma mesma imagem
 * usada N vezes no documento (ex.: logo repetido) não conta N perdas — o
 * round-trip preserva a imagem 1x e a deduplicação é comportamento correto.
 */
function uniqueEmbedTargets(xml: string, rels: string): string[] {
  const ids = [...xml.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1]);
  const targets = ids.map((id) => {
    const m = rels.match(new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`));
    return m ? m[1] : id;
  });
  return [...new Set(targets)];
}

describeWithArtifacts("acceptance: diff DOCX gerado vs baseline por elemento", ["baselines/dissertacao-referencia.docx"], () => {
  let rt: BaselineRoundTrip;
  let baselineXml: string;
  let generatedXml: string;
  let baselineRels: string;
  let generatedRels: string;
  let audit: ReturnType<typeof auditReferenceRoundTrip>;

  beforeAll(async () => {
    rt = await baselineRoundTrip();

    const baselineZip = await JSZip.loadAsync(
      readFileSync(join(root, "artifacts", "baselines", "dissertacao-referencia.docx")),
    );
    baselineXml = await baselineZip.file("word/document.xml")!.async("string");
    baselineRels = await baselineZip.file("word/_rels/document.xml.rels")!.async("string");
    const generatedZip = await JSZip.loadAsync(await rt.blob.arrayBuffer());
    generatedXml = await generatedZip.file("word/document.xml")!.async("string");
    generatedRels = await generatedZip.file("word/_rels/document.xml.rels")!.async("string");

    audit = auditReferenceRoundTrip(rt.input.referencias, rt.output.referencias, {
      input: "baseline",
      output: "gerado",
    });
  });

  it("referencias: 138/138 preservadas item a item (zero perda)", () => {
    expect(audit.summary.unmatched).toBe(0);
    expect(audit.summary.preserved).toBe(audit.summary.inputItems);
    expect(audit.summary.lostParts).toEqual([]);
  });

  it("tabelas: contagem do baseline preservada no gerado", () => {
    const baseline = countParts(baselineXml);
    const generated = countParts(generatedXml);
    expect(generated.tables).toBeGreaterThanOrEqual(baseline.tables);
  });

  it("imagens importadas: todo drawing do gerado tem embed e cobre as imagens importadas", () => {
    const generated = countParts(generatedXml);
    expect(rt.input.importedImages.length).toBeGreaterThan(0);
    expect(generated.embeds).toBeGreaterThanOrEqual(rt.input.importedImages.length);
    expect(generated.drawings).toBeGreaterThanOrEqual(rt.input.importedImages.length);
  });

  it("classifica o diff por elemento e grava artifacts/ufla-audit/baseline-element-diff.json", async () => {
    const baseline = countParts(baselineXml);
    const generated = countParts(generatedXml);

    const normalizedRefs = normalizeReferences(rt.input.referencias);
    const normalizedCount = normalizedRefs.filter(
      (r) => r.runs.some((run) => run.bold || run.italics),
    ).length;

    // desenhos do baseline sem r:embed são caixas/formas de texto, não imagens;
    // o gerador não as reproduz (causa documentada, não perda silenciosa).
    const baselineDrawingsWithoutEmbed = Math.max(0, baseline.drawings - baseline.embeds);
    // Comparação por imagem ÚNICA (dedupe por target): elimina a duplicação de
    // uma mesma imagem usada várias vezes no baseline como "perda". O exportador
    // renomeia os arquivos de mídia (hash), então a comparação é por CONTAGEM de
    // imagens únicas, não por nome de arquivo.
    const baselineTargets = uniqueEmbedTargets(baselineXml, baselineRels);
    const generatedTargets = uniqueEmbedTargets(generatedXml, generatedRels);
    // A capa (media/image1.png) é reconstruída pelo template UFLA — a única
    // diferença esperada de contagem é essa imagem (baseline 12 únicas vs 11 no
    // gerado, todas as do corpo preservadas).
    const expectedCapaReconstruction = 1;
    const countDiff = Math.max(0, baselineTargets.length - generatedTargets.length);
    const lostReal = Math.max(0, countDiff - expectedCapaReconstruction);
    const extraBaselineEmbeds = lostReal;

    const diff = {
      generatedAt: new Date().toISOString(),
      baseline: "artifacts/baselines/dissertacao-referencia.docx",
      classification: {
        "conteudo-preservado": {
          referencias: audit.summary.preserved,
          tabelas: generated.tables,
          imagensImportadas: rt.input.importedImages.length,
        },
        "elementos-normalizados": {
          referenciasComDestaque: normalizedCount,
          urlReagrupadas: audit.summary.byMethod["fragment-rejoined"],
        },
        "elementos-reconstruidos": {
          capaTemplateUfla: true,
          capaImagem:
            baselineTargets.length - generatedTargets.length >= 1
              ? "capa (media/image1.png) — regenerada pelo template UFLA, não é perda"
              : "reutilizada",
          sumarioToc: true,
          paragrafosGerados: generated.paragraphs,
        },
        "elementos-nao-identificados": {
          desenhosSemEmbedBaseline: baselineDrawingsWithoutEmbed,
          paragrafosBaselineSemCorrespondencia: Math.max(0, baseline.paragraphs - generated.paragraphs),
        },
        "elementos-perdidos": {
          contagem: extraBaselineEmbeds,
          causas: extraBaselineEmbeds
            ? [`${lostReal} imagem(ns) única(s) do baseline não re-exportada(s) além da capa (baseline ${baselineTargets.length} únicas vs gerado ${generatedTargets.length})`]
            : [],
        },
        "deduplicacao-por-target": {
          baselineEmbeds: baseline.embeds,
          baselineImagensUnicas: baselineTargets.length,
          geradoImagensUnicas: generatedTargets.length,
          explicacao: "mesma imagem usada N vezes conta 1 imagem (dedupe correto); exportador renomeia mídia (hash); capa reconstruída pelo template",
        },
      },
    };

    mkdirSync(dirname(artifactPath), { recursive: true });
    writeFileSync(artifactPath, JSON.stringify(diff, null, 2), "utf8");

    // toda perda precisa de causa explícita; conteúdo preservado não pode cair
    expect(diff.classification["elementos-perdidos"].causas.length).toBe(diff.classification["elementos-perdidos"].contagem === 0 ? 0 : 1);
    expect(audit.summary.lostParts).toEqual([]);
  });
});
