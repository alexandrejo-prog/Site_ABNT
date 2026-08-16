import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { generateDocxBlob, numberEquationsInBlocks, parseEditorContent } from "../../src/export-docx";
import { importDocumentFile } from "../../src/import-docx";
import { equationParagraph, parseLatexMath } from "../../src/docx-render-core";
import { Document, Packer, Paragraph } from "docx";

const NAMESPACES =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function minimalDocx(documentXml: string): Promise<Blob> {
  return new JSZip()
    .file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    )
    .file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    )
    .file("word/document.xml", documentXml)
    .generateAsync({ type: "blob" });
}

function oMathParagraph(runXml: string): string {
  return `<w:body><w:p><w:pPr/><w:r>${runXml}</w:r></w:p></w:body>`;
}

const DOCUMENT_TAG = `<w:document ${NAMESPACES}>`;

describe("UFLA-023 equacoes e formulas (§3.2.8 Manual UFLA): importacao OMML", () => {
  it("preserva o texto de uma equacao OMML (m:t) no rascunho como bloco [EQ]", async () => {
    const xml =
      DOCUMENT_TAG +
      oMathParagraph(
        '<m:oMath><m:r><m:t>x</m:t></m:r><m:r><m:t>²</m:t></m:r><m:r><w:t xml:space="preserve"> + 2x - 1 = 0</w:t></m:r></m:oMath>',
      ) +
      `</w:document>`;

    const imported = await importDocumentFile(new File([await (await minimalDocx(xml)).arrayBuffer()], "eq.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));

    expect(imported.editorText).toContain("[EQ]");
    expect(imported.editorText).toMatch(/x²\s*\+\s*2x\s*-\s*1\s*=\s*0/);
    expect(imported.messages.some((msg) => msg.includes("equação(ões)/fórmula(s)") && msg.includes("[EQ]"))).toBe(true);
  });

  it("detecta oMathPara (equacao em paragrafo proprio) como bloco [EQ]", async () => {
    const xml =
      DOCUMENT_TAG +
      `<w:body><w:p><m:oMathPara><m:oMath><m:r><m:t>F = ma</m:t></m:r></m:oMath></m:oMathPara></w:p></w:body>` +
      `</w:document>`;

    const imported = await importDocumentFile(new File([await (await minimalDocx(xml)).arrayBuffer()], "eq2.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));

    expect(imported.editorText).toContain("[EQ]");
    expect(imported.editorText).toMatch(/F = ma/);
  });

  it("nao gera alerta de equacao quando o documento nao contem OMML", async () => {
    const xml =
      DOCUMENT_TAG +
      `<w:body><w:p><w:r><w:t>Texto comum sem formula.</w:t></w:r></w:p></w:body>` +
      `</w:document>`;

    const imported = await importDocumentFile(new File([await (await minimalDocx(xml)).arrayBuffer()], "plain.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));

    expect(imported.editorText).not.toContain("[EQ]");
    expect(imported.messages.some((msg) => msg.includes("equação(ões)/fórmula(s)"))).toBe(false);
  });

  it("linha com [EQ] vira bloco de equacao no parseEditorContent", () => {
    const blocks = parseEditorContent("[EQ] f(x) = x² + 2x - 1 (1.1)\n\nParagrafo comum.");
    expect(blocks[0].type).toBe("equation");
    expect(blocks[0].text).toContain("f(x) = x² + 2x - 1");
  });

  it("numberEquationsInBlocks: numera equacoes por secao (secao.seq) — Manual UFLA §3.2.8", () => {
    const blocks = parseEditorContent(
      "# 1 Introducao\n\n[EQ] \\frac{a}{b}\n\n# 2 Metodologia\n\n[EQ] x^2\n[EQ] \\sqrt{x}\n",
    );
    const numbered = numberEquationsInBlocks(blocks);
    const eqs = numbered.filter((b) => b.type === "equation").map((b) => b.text);
    expect(eqs[0]).toMatch(/\(1\.1\)$/);
    expect(eqs[1]).toMatch(/\(2\.1\)$/);
    expect(eqs[2]).toMatch(/\(2\.2\)$/);
  });

  it("numberEquationsInBlocks: secao sem numero usa ordinal; antes de qualquer secao usa sequencia simples", () => {
    const blocks = parseEditorContent("[EQ] F = ma\n\n# Introducao\n\n[EQ] x^2\n");
    const numbered = numberEquationsInBlocks(blocks);
    const eqs = numbered.filter((b) => b.type === "equation").map((b) => b.text);
    expect(eqs[0]).toMatch(/\(1\)$/);
    expect(eqs[1]).toMatch(/\(1\.1\)$/);
  });

  it("numberEquationsInBlocks: equacao com numero explicito nao e renumerada", () => {
    const blocks = parseEditorContent("# 1 Introducao\n\n[EQ] y = ax + b (3.7)\n");
    const numbered = numberEquationsInBlocks(blocks);
    const eqs = numbered.filter((b) => b.type === "equation").map((b) => b.text);
    expect(eqs[0]).toMatch(/\(3\.7\)$/);
  });

  it("parseEditorContent aplica a numeracao automaticamente (preview e DOCX consistentes)", () => {
    const blocks = parseEditorContent("# 1 Introducao\n\n[EQ] \\frac{a}{b}\n");
    expect(blocks[0].type).toBe("heading1");
    expect(blocks[1].type).toBe("equation");
    expect(blocks[1].text).toMatch(/\(1\.1\)$/);
  });

  it("parseLatexMath: \\frac gera MathFraction (m:f) com numerador/denominador", () => {
    const comps = parseLatexMath("\\frac{a}{b}");
    expect(comps).not.toBeNull();
    expect(comps).toHaveLength(1);
    const json = JSON.stringify(comps);
    expect(json).toContain("\"m:f\"");
    expect(json).toContain("a");
    expect(json).toContain("b");
  });

  it("parseLatexMath: \\sqrt[3]{x} gera MathRadical (m:rad) com grau", () => {
    const comps = parseLatexMath("\\sqrt[3]{x}");
    expect(comps).not.toBeNull();
    const json = JSON.stringify(comps);
    expect(json).toContain("\"m:rad\"");
    expect(json).toContain("3");
    expect(json).toContain("x");
  });

  it("parseLatexMath: x^2 e x_i geram m:sSup e m:sSub", () => {
    const sup = parseLatexMath("x^2");
    expect(JSON.stringify(sup)).toContain("\"m:sSup\"");
    const sub = parseLatexMath("x_i");
    expect(JSON.stringify(sub)).toContain("\"m:sSub\"");
  });

  it("parseLatexMath: retorna null sem estrutura LaTeX (equacao achatada preservada)", () => {
    expect(parseLatexMath("x² + y² = z²")).toBeNull();
  });

  it("equationParagraph centraliza e alinha o numero a direita via tab stop", () => {
    const para = equationParagraph("f(x) = x² + 2x - 1 (1.1)") as unknown as {
      root: Array<{ rootKey: string; root: unknown }>;
    };
    const json = JSON.stringify(para.root);
    expect(json).toContain("\"w:jc\"");
    expect(json).toContain("\"val\":\"center\"");
    expect(json).toContain("\"w:tab\"");
    expect(json).toContain("\"val\":\"right\"");
    expect(json).toContain("\"pos\":9072");
    const paraNoNumber = equationParagraph("f(x) = ax² + bx + c") as unknown as {
      root: Array<{ rootKey: string; root: unknown }>;
    };
    expect(JSON.stringify(paraNoNumber.root)).toContain("\"w:tab\"");
  });
});

describe("UFLA-023 renderizacao no DOCX gerado", () => {
  async function builtDocument() {
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      author: "SILVA, J.",
      title: "Titulo",
      resumo: "Resumo.",
      palavrasChave: "palavras; chave",
    };
    const blob = await generateDocxBlob({
      fields,
      editorText: "[EQ] x² + y² = z² (3.1)\n\nIntroducao normal.",
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    return zip;
  }

  it("emite m:oMath real para blocos [EQ] (equação nativa OMML, UFLA-023)", async () => {
    const zip = await builtDocument();
    const docXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(docXml).toContain("<m:oMath>");
    expect(docXml).toContain("<m:t>x² + y² = z²</m:t>");
    expect(docXml).toContain("x² + y² = z²");
  });

  it("round-trip: equação OMML importada é reemitida como m:oMath no DOCX gerado", async () => {
    const xml =
      DOCUMENT_TAG +
      oMathParagraph(
        '<m:oMath><m:r><m:t>E = mc²</m:t></m:r></m:oMath>',
      ) +
      `</w:document>`;
    const imported = await importDocumentFile(
      new File([await (await minimalDocx(xml)).arrayBuffer()], "eq3.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
    );
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      author: "SILVA, J.",
      title: "Titulo",
      resumo: "Resumo.",
      palavrasChave: "palavras; chave",
    };
    const blob = await generateDocxBlob({ fields, editorText: imported.editorText });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const docXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(docXml).toContain("<m:oMath>");
    expect(docXml).toContain("<m:t>E = mc²</m:t>");
  });

  it("bloco [EQ] com LaTeX emite fracao/raiz/sobrescrito OMML reais no DOCX", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      author: "SILVA, J.",
      title: "Titulo",
      resumo: "Resumo.",
      palavrasChave: "palavras; chave",
    };
    const blob = await generateDocxBlob({
      fields,
      editorText: "[EQ] \\frac{a}{b} + \\sqrt{x} + x^2 (3.1)\n\nIntroducao normal.",
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const docXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(docXml).toContain("<m:f>");
    expect(docXml).toContain("<m:rad>");
    expect(docXml).toContain("<m:sSup>");
    expect(docXml).toContain("<m:num>");
    expect(docXml).toContain("<m:den>");
    expect(docXml).toContain("<m:t>a</m:t>");
    expect(docXml).toContain("<m:t>b</m:t>");
  });

  it("round-trip: estrutura matematica avancada (fracao m:f) do OMML cru e preservada", async () => {
    const xml =
      DOCUMENT_TAG +
      oMathParagraph(
        '<m:oMath><m:f><m:num><m:r><m:t>x+1</m:t></m:r></m:num><m:den><m:r><m:t>y-2</m:t></m:r></m:den></m:f></m:oMath>',
      ) +
      `</w:document>`;
    const imported = await importDocumentFile(
      new File([await (await minimalDocx(xml)).arrayBuffer()], "eq-frac.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
    );
    expect(imported.editorText).toContain("[EQ]");

    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      author: "SILVA, J.",
      title: "Titulo",
      resumo: "Resumo.",
      palavrasChave: "palavras; chave",
    };
    const blob = await generateDocxBlob({ fields, editorText: imported.editorText });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const docXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(docXml).toContain("<m:oMath>");
    expect(docXml).toContain("<m:f>");
    expect(docXml).toContain("<m:num>");
    expect(docXml).toContain("<m:den>");
    expect(docXml).toContain("<m:t>x+1</m:t>");
    expect(docXml).toContain("<m:t>y-2</m:t>");
  });

  it("texto do corpo sem equacao nao gera espaco OMML indevido", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      author: "SILVA, J.",
      title: "Titulo",
      resumo: "Resumo.",
      palavrasChave: "palavras; chave",
    };
    const blob = await generateDocxBlob({ fields, editorText: "Somente prosa, sem formula." });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const docXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(docXml).not.toContain("<m:oMath>");
  });
});

describe("UFLA-023 equationParagraph via docx Packer", () => {
  it("serializa com alinhamento central sem erro", async () => {
    const doc = new Document({
      sections: [
        {
          children: [new Paragraph({ children: [] }), equationParagraph("E = mc² (2.1)")],
        },
      ],
    });
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});

describe("UFLA-023 checagem OOXML (ooxml-checks)", () => {
  it("nao emite equation-format quando o DOCX nao contem equacao", async () => {
    const { runOoxmlChecks, loadDocxPartsFromBytes } = await import("../../scripts/ufla-compliance/ooxml-checks");
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      author: "SILVA, J.",
      title: "Titulo",
      resumo: "Resumo.",
      palavrasChave: "palavras; chave",
    };
    const blob = await generateDocxBlob({ fields, editorText: "Somente prosa sem formula alguma." });
    const parts = await loadDocxPartsFromBytes(await blob.arrayBuffer());
    const issues = runOoxmlChecks(parts);
    expect(issues.some((i) => i.code === "equation-format")).toBe(false);
  });

  it("nao emite equation-format quando equacao renderizada centralizada com tab direito", async () => {
    const { runOoxmlChecks, loadDocxPartsFromBytes } = await import("../../scripts/ufla-compliance/ooxml-checks");
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      author: "SILVA, J.",
      title: "Titulo",
      resumo: "Resumo.",
      palavrasChave: "palavras; chave",
    };
    const blob = await generateDocxBlob({ fields, editorText: "[EQ] E = mc² (2.1)\n\nProsa normal." });
    const parts = await loadDocxPartsFromBytes(await blob.arrayBuffer());
    const issues = runOoxmlChecks(parts);
    expect(issues.some((i) => i.code === "equation-format")).toBe(false);
  });
});

describe("UFLA-023 equações avançadas: N-ÁRIO ∫/∑/∏, lim e símbolos (Manual §3.2.8)", () => {
  it("converte int_0^1 x dx em m:nary com limites (MathIntegral)", async () => {
    const parsed = parseLatexMath("\\int_0^1 x \\, dx");
    expect(parsed).not.toBeNull();
    const { Packer, Paragraph, Document, Math: DMath } = await import("docx");
    const doc = new Document({ sections: [{ children: [new Paragraph({ children: [new DMath({ children: parsed! })] })] }] });
    const buf = await Packer.toBuffer(doc);
    const zipped = await JSZip.loadAsync(buf);
    const xml = await zipped.file("word/document.xml")!.async("string");
    expect(xml).toContain("<m:nary>");
    expect(xml).toContain("<m:sub>");
    expect(xml).toContain("<m:sup>");
  });

  it("converte sum_{i=1}^{n} i em m:nary com m:chr ∑", async () => {
    const parsed = parseLatexMath("\\sum_{i=1}^{n} i");
    expect(parsed).not.toBeNull();
    const { Packer, Paragraph, Document, Math: DMath } = await import("docx");
    const doc = new Document({ sections: [{ children: [new Paragraph({ children: [new DMath({ children: parsed! })] })] }] });
    const buf = await Packer.toBuffer(doc);
    const zipped = await JSZip.loadAsync(buf);
    const xml = await zipped.file("word/document.xml")!.async("string");
    expect(xml).toContain('m:chr m:val="∑"');
    expect(xml).toContain("<m:sub>");
    expect(xml).toContain("<m:sup>");
  });

  it("converte prod_{k=1}^{m} k em m:nary com m:chr ∏ (MathNary genérico)", async () => {
    const parsed = parseLatexMath("\\prod_{k=1}^{m} k");
    expect(parsed).not.toBeNull();
    const { Packer, Paragraph, Document, Math: DMath } = await import("docx");
    const doc = new Document({ sections: [{ children: [new Paragraph({ children: [new DMath({ children: parsed! })] })] }] });
    const buf = await Packer.toBuffer(doc);
    const zipped = await JSZip.loadAsync(buf);
    const xml = await zipped.file("word/document.xml")!.async("string");
    expect(xml).toContain('m:chr m:val="∏"');
    expect(xml).toContain("<m:sub>");
    expect(xml).toContain("<m:sup>");
  });

  it("converte lim_{x to 0} em m:func com nome lim e símbolo →", async () => {
    const parsed = parseLatexMath("\\lim_{x \\to 0} f(x)");
    expect(parsed).not.toBeNull();
    const { Packer, Paragraph, Document, Math: DMath } = await import("docx");
    const doc = new Document({ sections: [{ children: [new Paragraph({ children: [new DMath({ children: parsed! })] })] }] });
    const buf = await Packer.toBuffer(doc);
    const zipped = await JSZip.loadAsync(buf);
    const xml = await zipped.file("word/document.xml")!.async("string");
    expect(xml).toContain("<m:func>");
    expect(xml).toContain("<m:t>lim</m:t>");
    expect(xml).toContain("x→0");
  });

  it("converte símbolos comuns (pi, infty, approx) em glifos Unicode", async () => {
    const parsed = parseLatexMath("\\pi \\approx 3.14, \\infty");
    expect(parsed).not.toBeNull();
    const { Packer, Paragraph, Document, Math: DMath } = await import("docx");
    const doc = new Document({ sections: [{ children: [new Paragraph({ children: [new DMath({ children: parsed! })] })] }] });
    const buf = await Packer.toBuffer(doc);
    const zipped = await JSZip.loadAsync(buf);
    const xml = await zipped.file("word/document.xml")!.async("string");
    expect(xml).toContain("<m:t>π</m:t>");
    expect(xml).toContain("<m:t>≈</m:t>");
    expect(xml).toContain("<m:t>∞</m:t>");
  });

  it("DOCX real do editor: equação com sum recebe m:nary e numeração por seção", async () => {
    const blob = await generateDocxBlob({
      fields: {
        ...emptyAcademicFields(),
        workType: "monografia" as const,
        author: "SILVA, J.",
        title: "Titulo",
        resumo: "Resumo.",
        palavrasChave: "palavras; chave",
      },
      editorText: "# 2 Revisão de Literatura\n\n[EQ] \\sum_{i=1}^{n} i = n(n+1)/2 (2.1)\n\nProsa.",
    });
    const { loadDocxPartsFromBytes, runOoxmlChecks } = await import("../../scripts/ufla-compliance/ooxml-checks");
    const parts = await loadDocxPartsFromBytes(await blob.arrayBuffer());
    const xml = parts.documentXml;
    expect(xml).toContain('m:chr m:val="∑"');
    // numeração por seção presente no documento (o corpo da equação não contém "(2.1)")
    expect(xml).toContain("(2.1)");
    const issues = runOoxmlChecks(parts);
    expect(issues.some((i) => i.code === "equation-format")).toBe(false);
  });

  it("text{...} vira run de texto plano dentro da equação", async () => {
    const parsed = parseLatexMath("x > 0 \\text{ se } x \\in \\mathbb{R}");
    expect(parsed).not.toBeNull();
    const { Packer, Paragraph, Document, Math: DMath } = await import("docx");
    const doc = new Document({ sections: [{ children: [new Paragraph({ children: [new DMath({ children: parsed! })] })] }] });
    const buf = await Packer.toBuffer(doc);
    const zipped = await JSZip.loadAsync(buf);
    const xml = await zipped.file("word/document.xml")!.async("string");
    expect(xml).toContain("<m:t>se</m:t>");
    expect(xml).toContain("<m:t>∈</m:t>");
  });
});