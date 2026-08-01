import { describe, expect, it } from "vitest";
import { generateArticleDocxBlob } from "../src/export-article-docx";
import { generateCpgDocxBlob } from "../src/export-cpg-docx";
import { generateDocxBlob } from "../src/export-docx";
import { generateResearchProjectDocxBlob } from "../src/export-research-project-docx";
import { CPG_RULES, UFLA_RULES, emptyAcademicFields, type AcademicFields } from "../src/ufla-rules";
import { loadDocxParts, tocInstruction } from "./test-utils/ooxml";

type WorkTypeId = "monografia" | "dissertacao" | "tese" | "artigo" | "resumo_cpg" | "resumo_expandido_cpg" | "artigo_completo_cpg" | "projeto_pesquisa";

const baseFields: AcademicFields = {
  ...emptyAcademicFields(),
  author: "Maria Silva",
  title: "Qualidade do cafe no sul de Minas",
  location: "Lavras - MG",
  year: "2026",
  resumo: "Resumo do trabalho.",
  palavrasChave: "cafe; qualidade",
  abstractText: "Abstract text.",
  keywords: "coffee; quality",
  referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
};

function fieldsFor(workType: WorkTypeId): AcademicFields {
  if (workType === "monografia") {
    return {
      ...baseFields,
      workType,
      course: "Bacharelado em Biologia",
      workNature:
        "Monografia apresentada à Universidade Federal de Lavras, como parte das exigências do Bacharelado em Biologia, para obtenção do título de Bacharel em Biologia.",
      advisor: "Prof. Dr. João Silva",
    };
  }
  if (workType === "dissertacao" || workType === "tese") {
    return {
      ...baseFields,
      workType,
      program: "Ciência do Solo",
      workNature:
        workType === "tese"
          ? "Tese apresentada à Universidade Federal de Lavras, como parte das exigências do Programa de Pós-Graduação em Ciência do Solo, para obtenção do título de Doutor em Ciências."
          : "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do Programa de Pós-Graduação em Ciência do Solo, para obtenção do título de Mestre em Ciências.",
      advisor: "Prof. Dr. João Silva",
      indicadoresImpacto: "Impacto social: informado.",
      impactIndicators: "Social impact text.",
    };
  }
  if (workType === "artigo") {
    return { ...baseFields, workType };
  }
  if (workType === "resumo_cpg" || workType === "resumo_expandido_cpg" || workType === "artigo_completo_cpg") {
    return {
      ...baseFields,
      workType,
      program: "Universidade Federal de Lavras\nPrograma de Pos-Graduacao",
      course: "maria@ufla.br",
    };
  }
  return {
    ...baseFields,
    workType,
    problemaPesquisa: "Como melhorar a qualidade do cafe?",
    objetivoGeral: "Avaliar a qualidade do cafe no sul de Minas.",
    justificativa: "A pesquisa justifica-se pela importancia do cafe.",
    metodologia: "Metodologia quantitativa.",
    cronograma: "Quadro 1 - Cronograma de execucao da pesquisa\n1o semestre 1 a 6 Jan/2026 a Jun/2026 Revisao bibliografica\nFonte: elaborado pelo autor (2026).",
  };
}

async function documentXmlFor(workType: WorkTypeId): Promise<string> {
  const fields = fieldsFor(workType);
  const editorText = "# 1 Introducao\nTexto comum.\n## 1.1 Contexto\nTexto.\n# 2 Metodologia\nTexto.";

  if (workType === "artigo") {
    const blob = await generateArticleDocxBlob({ fields, editorText });
    return (await loadDocxParts(blob)).documentXml;
  }
  if (workType === "resumo_cpg" || workType === "resumo_expandido_cpg" || workType === "artigo_completo_cpg") {
    const blob = await generateCpgDocxBlob({ fields, editorText });
    return (await loadDocxParts(blob)).documentXml;
  }
  if (workType === "projeto_pesquisa") {
    const blob = await generateResearchProjectDocxBlob({ fields, editorText });
    return (await loadDocxParts(blob)).documentXml;
  }
  const blob = await generateDocxBlob({ fields, editorText });
  return (await loadDocxParts(blob)).documentXml;
}

function pageBreakBeforeAbstract(documentXml: string, abstractLabel: string): boolean {
  const fromText = "Palavras-chave";
  const fromIndex = documentXml.indexOf(fromText);
  const toIndex = documentXml.indexOf(abstractLabel, fromIndex + fromText.length);
  if (fromIndex === -1 || toIndex === -1) return false;
  return documentXml.slice(fromIndex, toIndex).includes('w:br w:type="page"');
}

const UFLA_STANDARD_TYPES: WorkTypeId[] = ["monografia", "dissertacao", "tese", "projeto_pesquisa"];
const CONGRESS_TYPES: WorkTypeId[] = ["artigo", "resumo_cpg", "resumo_expandido_cpg", "artigo_completo_cpg"];

describe("Matriz de formato por tipo de trabalho", () => {
  it.each(UFLA_STANDARD_TYPES)("%s tem SUMÁRIO com campo TOC real", async (workType) => {
    const documentXml = await documentXmlFor(workType);

    expect(documentXml).toContain("SUMÁRIO");
    expect(tocInstruction(documentXml)).toContain("TOC");
  });

  it.each(CONGRESS_TYPES)("%s NÃO tem SUMÁRIO (formato do congresso)", async (workType) => {
    const documentXml = await documentXmlFor(workType);

    expect(documentXml).not.toContain("SUMÁRIO");
    expect(tocInstruction(documentXml)).not.toContain("TOC");
  });

  it.each(UFLA_STANDARD_TYPES)("%s tem quebra de página antes do Abstract", async (workType) => {
    const documentXml = await documentXmlFor(workType);

    expect(pageBreakBeforeAbstract(documentXml, "ABSTRACT")).toBe(true);
  });

  it.each(CONGRESS_TYPES)("%s mantém Abstract na mesma página do resumo", async (workType) => {
    const documentXml = await documentXmlFor(workType);

    expect(pageBreakBeforeAbstract(documentXml, "Abstract")).toBe(false);
  });

  it.each([
    ["monografia", UFLA_RULES.margins],
    ["dissertacao", UFLA_RULES.margins],
    ["tese", UFLA_RULES.margins],
    ["projeto_pesquisa", UFLA_RULES.margins],
    ["artigo", UFLA_RULES.margins],
    ["resumo_cpg", CPG_RULES.margins],
    ["resumo_expandido_cpg", CPG_RULES.margins],
    ["artigo_completo_cpg", CPG_RULES.margins],
  ] as const)("%s usa as margens UFLA corretas", async (workType, margins) => {
    const documentXml = await documentXmlFor(workType);

    expect(documentXml).toContain(`w:top="${margins.topTwip}"`);
    expect(documentXml).toContain(`w:bottom="${margins.bottomTwip}"`);
    expect(documentXml).toContain(`w:left="${margins.leftTwip}"`);
    expect(documentXml).toContain(`w:right="${margins.rightTwip}"`);
  });

  it.each([
    ["monografia", "MARIA SILVA"],
    ["dissertacao", "MARIA SILVA"],
    ["tese", "MARIA SILVA"],
    ["artigo", "MARIA SILVA"],
    ["projeto_pesquisa", "MARIA SILVA"],
    ["resumo_cpg", "MARIA SILVA"],
    ["resumo_expandido_cpg", "MARIA SILVA"],
    ["artigo_completo_cpg", "MARIA SILVA"],
  ] as const)("%s mostra o autor REAL na capa/cabeçalho (sem placeholder AUTOR)", async (workType, author) => {
    const documentXml = await documentXmlFor(workType);

    expect(documentXml).toContain(author);
    expect(documentXml).not.toContain(">AUTOR<");
  });

  it.each([
    ["monografia", 1],
    ["dissertacao", 1],
    ["tese", 1],
    ["artigo", 1],
    ["resumo_expandido_cpg", 1],
    ["artigo_completo_cpg", 1],
  ] as const)("%s não duplica a seção de referências", async (workType, expectedCount) => {
    const documentXml = await documentXmlFor(workType);
    const count = (documentXml.match(/REFERÊNCIAS/g) ?? []).length;

    expect(count).toBe(expectedCount);
  });
});
