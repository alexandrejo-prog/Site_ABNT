import { describe, expect, it } from "vitest";
import { templateForWorkType } from "../../src/document-template";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { loadDocxParts, paragraphTexts, tocInstruction, normalizeOoxmlText } from "../test-utils/ooxml";

async function xmlFrom(blob: Blob): Promise<string> {
  const parts = await loadDocxParts(blob);
  return parts.documentXml;
}

function hasParagraphContaining(documentXml: string, text: string): boolean {
  const target = normalizeOoxmlText(text);
  return paragraphTexts(documentXml).some((p) => normalizeOoxmlText(p).includes(target));
}

describe("auditoria formal de DOCX por XML", () => {
  describe("Projeto de pesquisa", () => {
    const researchFields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Projeto de Pesquisa",
      author: "Maria Silva",
      program: "Educação Científica e Ambiental",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo do projeto.",
      abstractText: "Abstract do projeto.",
      palavrasChave: "palavra1; palavra2",
      keywords: "keyword1; keyword2",
      referencias: "SILVA, M. Projeto. Lavras: UFLA, 2024.",
    };

    const researchEditorText = `# 1 INTRODUÇÃO
Texto da introdução.

# 2 PROBLEMA DE PESQUISA
Descrição do problema.

# 3 OBJETIVO GERAL
Objetivo principal.

# 4 METODOLOGIA
Metodologia a ser usada.

# 5 CRONOGRAMA
Cronograma de execução.

# REFERÊNCIAS
SILVA, M. Projeto de pesquisa. Lavras: UFLA, 2024.
`;

    it("roteia para template dedicado e nao para geral", async () => {
      expect(templateForWorkType("projeto_pesquisa").id).toBe("projeto-pesquisa");
    });

    it("contem capa, folha de rosto, resumo, abstract, sumario, introducao e referencias", async () => {
      const blob = await templateForWorkType("projeto_pesquisa").generate({ fields: researchFields, editorText: researchEditorText });
      const xml = await xmlFrom(blob);

      expect(hasParagraphContaining(xml, "MARIA SILVA")).toBe(true);
      expect(hasParagraphContaining(xml, "PROJETO DE PESQUISA")).toBe(true);
      expect(hasParagraphContaining(xml, "RESUMO")).toBe(true);
      expect(hasParagraphContaining(xml, "ABSTRACT")).toBe(true);
      expect(hasParagraphContaining(xml, "SUMÁRIO")).toBe(true);
      expect(hasParagraphContaining(xml, "1 INTRODUÇÃO")).toBe(true);
      expect(hasParagraphContaining(xml, "REFERENCIAS")).toBe(true);
    });

    it("nao contem ficha catalografica, banca examinadora, trabalho academico apresentado, [PREENCHER, TITLE 1, Toc numerico ou \\uFFFE", async () => {
      const blob = await templateForWorkType("projeto_pesquisa").generate({ fields: researchFields, editorText: researchEditorText });
      const xml = await xmlFrom(blob);

      expect(xml).not.toContain("FICHA CATALOGRÁFICA");
      expect(xml).not.toContain("BANCA EXAMINADORA");
      expect(xml).not.toContain("Trabalho acadêmico apresentado");
      expect(xml).not.toContain("[PREENCHER");
      expect(xml).not.toContain("TITLE 1");
      expect(xml).not.toMatch(/Toc\s+\d/);
      expect(xml).not.toContain("\uFFFE");
    });

    it("nao contem linhas com tab cru", async () => {
      const editorTextWithTabs = `# 1 INTRODUÇÃO
Coluna1\tColuna2\tColuna3`;
      const blob = await templateForWorkType("projeto_pesquisa").generate({ fields: researchFields, editorText: editorTextWithTabs });
      const xml = await xmlFrom(blob);

      const lines = xml.split("\n");
      const hasRawTab = lines.some((line) => line.includes("\t") && !line.includes("<w:tab"));
      expect(hasRawTab).toBe(false);
    });

    it("contem Times New Roman, margens ABNT/UFLA, TOC atualizavel e referencias com recuo frances", async () => {
      const blob = await templateForWorkType("projeto_pesquisa").generate({ fields: researchFields, editorText: researchEditorText });
      const xml = await xmlFrom(blob);

      expect(xml).toContain("Times New Roman");
      expect(xml).toContain('w:pgNumType w:start="1"');
      expect(tocInstruction(xml)).toContain("TOC");

      const referenceParagraphs = paragraphTexts(xml).filter((p) => normalizeOoxmlText(p).startsWith("SILVA"));
      expect(referenceParagraphs.length).toBeGreaterThan(0);
      expect(xml).toContain('w:hanging="284"');
    });

    it("citacoes longas tem recuo proprio", async () => {
      const editorTextWithQuote = `# 1 INTRODUÇÃO
> Citação longa direta que deve ter recuo de 4 cm conforme ABNT.`;
      const blob = await templateForWorkType("projeto_pesquisa").generate({ fields: researchFields, editorText: editorTextWithQuote });
      const xml = await xmlFrom(blob);

      expect(xml).toContain('w:left="2268"');
    });
  });

  describe("Tese/Dissertação", () => {
    const graduateFields = {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      title: "Dissertação de Teste",
      author: "Maria Silva",
      program: "Educação Científica e Ambiental",
      advisor: "Prof. Dr. João",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      abstractText: "Abstract.",
      referencias: "SILVA, M. Dissertação. Lavras: UFLA, 2024.",
    };

    it("contem TOC atualizavel, ficha catalografica, folha de aprovacao e referencias", async () => {
      const blob = await templateForWorkType("dissertacao").generate({ fields: graduateFields, editorText: "# 1 INTRODUÇÃO\nTexto." });
      const xml = await xmlFrom(blob);

      expect(tocInstruction(xml)).toContain("TOC");
      expect(hasParagraphContaining(xml, "FICHA CATALOGRAFICA")).toBe(true);
      expect(hasParagraphContaining(xml, "APROVADO EM")).toBe(true);
      expect(hasParagraphContaining(xml, "REFERENCIAS")).toBe(true);
      expect(xml).not.toContain("[PREENCHER");
    });

    it("tese mantem ficha catalografica e folha de aprovacao", async () => {
      const teseFields = { ...graduateFields, workType: "tese" as const };
      const blob = await templateForWorkType("tese").generate({ fields: teseFields, editorText: "# 1 INTRODUÇÃO\nTexto." });
      const xml = await xmlFrom(blob);

      expect(hasParagraphContaining(xml, "FICHA CATALOGRAFICA")).toBe(true);
      expect(hasParagraphContaining(xml, "APROVADO EM")).toBe(true);
    });
  });

  describe("Monografia", () => {
    const monoFields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      title: "Monografia de Teste",
      author: "Maria Silva",
      course: "Licenciatura em Física",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      abstractText: "Abstract.",
      referencias: "SILVA, M. Monografia. Lavras: UFLA, 2024.",
    };

    it("mantem comportamento pre-textual esperado", async () => {
      const blob = await templateForWorkType("monografia").generate({ fields: monoFields, editorText: "# 1 INTRODUÇÃO\nTexto." });
      const xml = await xmlFrom(blob);

      expect(hasParagraphContaining(xml, "FICHA CATALOGRAFICA")).toBe(true);
      expect(hasParagraphContaining(xml, "APROVADO EM")).toBe(true);
      expect(hasParagraphContaining(xml, "REFERENCIAS")).toBe(true);
    });
  });

  describe("CPG", () => {
    const cpgFields = {
      ...emptyAcademicFields(),
      workType: "resumo_cpg" as const,
      title: "Resumo CPG",
      author: "Maria Silva",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo do trabalho.",
      abstractText: "Abstract do trabalho.",
      referencias: "SILVA, M. Trabalho. Lavras: UFLA, 2024.",
    };

    it("nao mistura pre-textuais de trabalho academico longo", async () => {
      const blob = await templateForWorkType("resumo_cpg").generate({ fields: cpgFields, editorText: "Texto do resumo." });
      const xml = await xmlFrom(blob);

      expect(xml).not.toContain("FICHA CATALOGRÁFICA");
      expect(xml).not.toContain("BANCA EXAMINADORA");
      expect(xml).not.toContain("SUMÁRIO");
      expect(paragraphTexts(xml).length).toBeLessThan(20);
    });
  });

  describe("Artigo e outros tipos sem ficha", () => {
    it("artigo nao contem ficha catalografica", async () => {
      const fields = {
        ...emptyAcademicFields(),
        workType: "artigo" as const,
        title: "Artigo de Teste",
        author: "Maria Silva",
        resumo: "Resumo.",
        abstractText: "Abstract.",
        referencias: "SILVA, M. Artigo. Lavras: UFLA, 2024.",
      };

      const blob = await templateForWorkType("artigo").generate({ fields, editorText: "Texto do artigo." });
      const xml = await xmlFrom(blob);

      expect(xml).not.toContain("FICHA CATALOGRÁFICA");
      expect(xml).not.toContain("Inserir aqui a ficha catalográfica");
    });

    it("software_aplicativo_ufla nao contem ficha catalografica", async () => {
      const fields = {
        ...emptyAcademicFields(),
        workType: "software_aplicativo_ufla" as const,
        title: "Software de Teste",
        author: "Maria Silva",
        location: "Lavras - MG",
        year: "2026",
        resumo: "Resumo.",
        abstractText: "Abstract.",
        referencias: "SILVA, M. Software. Lavras: UFLA, 2024.",
      };

      const blob = await templateForWorkType("software_aplicativo_ufla").generate({ fields, editorText: "Texto do software." });
      const xml = await xmlFrom(blob);

      expect(xml).not.toContain("FICHA CATALOGRÁFICA");
      expect(xml).not.toContain("Inserir aqui a ficha catalográfica");
    });
  });
});
