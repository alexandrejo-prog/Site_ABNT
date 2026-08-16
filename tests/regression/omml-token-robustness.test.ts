import { describe, it, expect, vi, afterEach } from "vitest";
import JSZip from "jszip";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { generateDocxBlob, parseEditorContent } from "../../src/export-docx";
import {
  ommlContentToken,
  ommlContentTokenDecode,
  rawOmmlRegistrySize,
} from "../../src/docx-render-core";

// ---------------------------------------------------------------------------
// A1 — token OMML editável/corrompido não pode derrubar export/preview
// A4 — registry OMML escopado por geração (corrida em geração paralela)
// (docs/checklist-14-correcoes.md, Bloco A)
// ---------------------------------------------------------------------------

const MONOGRAFIA_FIELDS = () => ({
  ...emptyAcademicFields(),
  workType: "monografia" as const,
  author: "SILVA, J.",
  title: "Titulo",
  resumo: "Resumo.",
  palavrasChave: "palavras; chave",
});

const OMML_FRAC_AB =
  "<m:oMathPara><m:oMath><m:f><m:num><m:r><m:t>a</m:t></m:r></m:num>" +
  "<m:den><m:r><m:t>b</m:t></m:r></m:den></m:f></m:oMath></m:oMathPara>";

const OMML_FRAC_CD =
  "<m:oMathPara><m:oMath><m:f><m:num><m:r><m:t>c</m:t></m:r></m:num>" +
  "<m:den><m:r><m:t>d</m:t></m:r></m:den></m:f></m:oMath></m:oMathPara>";

async function documentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return (await zip.file("word/document.xml")?.async("string")) ?? "";
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("A1 — token OMML corrompido não derruba export/preview", () => {
  it("decodifica um token OMML válido de volta para o XML (round-trip)", () => {
    const token = ommlContentToken(OMML_FRAC_AB);
    // O decode recebe o payload base64 capturado pelo padrão (sem os
    // delimitadores \uF001OMML:...\uF001), exatamente como o parseEditorContent.
    const base64 = token.replace(/^\uF001OMML:|\uF001$/g, "");
    expect(ommlContentTokenDecode(base64)).toBe(OMML_FRAC_AB);
  });

  it("token OMML corrompido não lança: degrada para '' e emite aviso", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Comprimentos/alfabeto inválidos que o atob rejeita (mas o regex do token
    // deixa passar: [A-Za-z0-9+/=]+).
    expect(ommlContentTokenDecode("abcde")).toBe("");
    expect(ommlContentTokenDecode("a===")).toBe("");
    expect(warn).toHaveBeenCalled();
  });

  it("parseEditorContent: token corrompido em [EQ] vira bloco equation achatado (sem crash)", () => {
    const blocks = parseEditorContent(
      "[EQ] f(x) = x² \uF001OMML:abcde\uF001\n\nParagrafo normal.",
    );
    expect(blocks[0].type).toBe("equation");
    // Texto preservado (com a numeração automática por seção) e OMML degradado
    // para "" — o bloco segue para o caminho achatado, sem crash.
    expect(blocks[0].text).toContain("f(x) = x²");
    expect(blocks[0].ommlXml).toBe("");
  });

  it("gera DOCX com token OMML corrompido sem crash (sem marcador vazando)", async () => {
    const blob = await generateDocxBlob({
      fields: MONOGRAFIA_FIELDS(),
      editorText:
        "[EQ] f(x) = x² \uF001OMML:abcde\uF001\n\nIntroducao normal.",
    });
    const docXml = await documentXml(blob);
    expect(docXml).not.toContain("\uF000UFLAOMML_");
    // Degrada para o caminho achatado: equação ainda presente no OOXML.
    expect(docXml).toContain("<m:oMath>");
    expect(docXml).toContain("f(x) = x²");
  });

  it("round-trip de token válido continua re-injetando o OMML cru no DOCX", async () => {
    const token = ommlContentToken(OMML_FRAC_AB);
    const blob = await generateDocxBlob({
      fields: MONOGRAFIA_FIELDS(),
      editorText: `[EQ] f(x) = x² ${token}\n\nIntroducao normal.`,
    });
    const docXml = await documentXml(blob);
    expect(docXml).toContain("<m:oMathPara>");
    expect(docXml).toContain("<m:num><m:r><m:t>a</m:t></m:r></m:num>");
    expect(docXml).toContain("<m:den><m:r><m:t>b</m:t></m:r></m:den>");
    expect(docXml).not.toContain("\uF000UFLAOMML_");
  });
});

describe("A4 — registry OMML escopado por geração (geração paralela)", () => {
  it("gerações paralelas não colidem: cada DOCX recebe o OMML próprio", async () => {
    const tokenA = ommlContentToken(OMML_FRAC_AB);
    const tokenB = ommlContentToken(OMML_FRAC_CD);

    const [blobA, blobB] = await Promise.all([
      generateDocxBlob({
        fields: MONOGRAFIA_FIELDS(),
        editorText: `[EQ] x ${tokenA}\n\nIntroducao A.`,
      }),
      generateDocxBlob({
        fields: MONOGRAFIA_FIELDS(),
        editorText: `[EQ] y ${tokenB}\n\nIntroducao B.`,
      }),
    ]);

    const docXmlA = await documentXml(blobA);
    const docXmlB = await documentXml(blobB);

    // Cada documento carrega SOMENTE o OMML da própria geração.
    expect(docXmlA).toContain("<m:num><m:r><m:t>a</m:t></m:r></m:num>");
    expect(docXmlA).toContain("<m:den><m:r><m:t>b</m:t></m:r></m:den>");
    expect(docXmlA).not.toContain("<m:t>c</m:t>");
    expect(docXmlA).not.toContain("<m:t>d</m:t>");

    expect(docXmlB).toContain("<m:num><m:r><m:t>c</m:t></m:r></m:num>");
    expect(docXmlB).toContain("<m:den><m:r><m:t>d</m:t></m:r></m:den>");
    expect(docXmlB).not.toContain("<m:t>a</m:t>");
    expect(docXmlB).not.toContain("<m:t>b</m:t>");

    // Nenhum marcador \uF000UFLAOMML_ vazou para o XML final.
    expect(docXmlA).not.toContain("\uF000UFLAOMML_");
    expect(docXmlB).not.toContain("\uF000UFLAOMML_");

    // Entradas consumidas pelo patch pós-Packer: registry volta a 0.
    expect(rawOmmlRegistrySize()).toBe(0);
  });

  it("gerações paralelas com tipos diferentes (monografia + artigo) não interferem", async () => {
    const tokenA = ommlContentToken(OMML_FRAC_AB);
    const tokenB = ommlContentToken(OMML_FRAC_CD);

    const [blobA, blobB] = await Promise.all([
      generateDocxBlob({
        fields: MONOGRAFIA_FIELDS(),
        editorText: `[EQ] x ${tokenA}\n\nIntroducao.`,
      }),
      generateDocxBlob({
        fields: {
          ...emptyAcademicFields(),
          workType: "artigo" as const,
          author: "SILVA, J.",
          title: "Artigo",
          resumo: "Resumo.",
          palavrasChave: "a; b",
        },
        editorText: `[EQ] y ${tokenB}\n\nIntroducao.`,
      }),
    ]);

    const docXmlA = await documentXml(blobA);
    const docXmlB = await documentXml(blobB);

    expect(docXmlA).toContain("<m:t>a</m:t>");
    expect(docXmlA).not.toContain("<m:t>c</m:t>");
    expect(docXmlB).toContain("<m:t>c</m:t>");
    expect(docXmlB).not.toContain("<m:t>a</m:t>");
    expect(docXmlA).not.toContain("\uF000UFLAOMML_");
    expect(docXmlB).not.toContain("\uF000UFLAOMML_");
    expect(rawOmmlRegistrySize()).toBe(0);
  });
});
