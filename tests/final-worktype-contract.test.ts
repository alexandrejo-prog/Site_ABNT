import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { generateArticleDocxBlob } from "../src/export-article-docx";
import { generateCpgDocxBlob } from "../src/export-cpg-docx";
import { generateDocxBlob } from "../src/export-docx";
import { generateResearchProjectDocxBlob } from "../src/export-research-project-docx";
import { CPG_RULES, emptyAcademicFields, type AcademicFields } from "../src/ufla-rules";
import { templateForWorkType } from "../src/document-template";
import { validateWork } from "../src/validators";
import { repairHeadingFragments } from "../src/heading-fragment-repair";

function readUInt16(buffer: Buffer, offset: number): number {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}

function extractFileFromZip(buffer: Buffer, fileName: string): string {
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (readUInt32(buffer, offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const compression = readUInt16(buffer, offset + 8);
    const compressedSize = readUInt32(buffer, offset + 18);
    const fileNameLength = readUInt16(buffer, offset + 26);
    const extraLength = readUInt16(buffer, offset + 28);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (name === fileName) {
      const data = buffer.subarray(dataStart, dataEnd);
      if (compression === 0) return data.toString("utf8");
      if (compression === 8) return inflateRawSync(data).toString("utf8");
      throw new Error(`Compactacao nao suportada: ${compression}.`);
    }
    offset = dataEnd;
  }
  throw new Error(`Arquivo nao encontrado no DOCX: ${fileName}.`);
}

async function generatedXml(
  editorText = "# 1 Introducao\nTexto comum.",
  documentFields: AcademicFields = baseFields,
) {
  const blob = await generateDocxBlob({ fields: documentFields, editorText });
  return extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
}

async function generatedArticleXml(
  editorText = "# 1 Introducao\nTexto comum.",
  documentFields: AcademicFields = articleFields,
) {
  const blob = await generateArticleDocxBlob({ fields: documentFields, editorText });
  return extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
}

async function generatedCpgXml(
  editorText = "# Introducao\nTexto comum.",
  documentFields: AcademicFields,
) {
  const blob = await generateCpgDocxBlob({ fields: documentFields, editorText });
  return extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
}

async function generatedProjectXml(
  editorText = "# 1 Introducao\nTexto comum.",
  documentFields: AcademicFields = projectFields,
) {
  const blob = await generateResearchProjectDocxBlob({ fields: documentFields, editorText });
  return extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
}

function expectNoGraduateOnlyElements(documentXml: string): void {
  for (const forbidden of [
    "FICHA CATALOGR",
    "FOLHA DE APROVA",
    "INDICADORES DE IMPACTO",
    "IMPACT INDICATORS",
    "Trabalho acadêmico apresentado",
  ]) {
    expect(documentXml).not.toContain(forbidden);
  }
}

const baseFields: AcademicFields = {
  ...emptyAcademicFields(),
  workType: "outro",
  author: "Maria Silva",
  title: "Qualidade do cafe no sul de Minas",
  location: "Lavras - MG",
  year: "2026",
  resumo: "Resumo do trabalho.",
  palavrasChave: "cafe; qualidade",
  abstractText: "Abstract text.",
  keywords: "coffee; quality",
  introducao: "Texto da introducao.",
  referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
};

const articleFields: AcademicFields = {
  ...baseFields,
  workType: "artigo",
};

const monographFields: AcademicFields = {
  ...baseFields,
  workType: "monografia",
  course: "Bacharelado em Biologia",
  workNature: "Monografia apresentada à Universidade Federal de Lavras, como parte das exigências do Bacharelado em Biologia, para obtenção do título de Bacharel em Biologia.",
  advisor: "Prof. Dr. João Silva",
};

const dissertationFields: AcademicFields = {
  ...baseFields,
  workType: "dissertacao",
  program: "Ciência do Solo",
  workNature: "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do Programa de Pós-Graduação em Ciência do Solo, para obtenção do título de Mestre em Ciências.",
  advisor: "Prof. Dr. João Silva",
  indicadoresImpacto: "Impacto social: informado.",
  impactIndicators: "Social impact text.",
};

const thesisFields: AcademicFields = {
  ...baseFields,
  workType: "tese",
  program: "Ciência do Solo",
  workNature: "Tese apresentada à Universidade Federal de Lavras, como parte das exigências do Programa de Pós-Graduação em Ciência do Solo, para obtenção do título de Doutor em Ciências.",
  advisor: "Prof. Dr. João Silva",
  indicadoresImpacto: "Impacto social: informado.",
  impactIndicators: "Social impact text.",
};

const projectFields: AcademicFields = {
  ...baseFields,
  workType: "projeto_pesquisa",
  problemaPesquisa: "Como melhorar a qualidade do cafe?",
  objetivoGeral: "Avaliar a qualidade do cafe no sul de Minas.",
  justificativa: "A pesquisa justifica-se pela importancia do cafe.",
  metodologia: "Metodologia quantitativa.",
  cronograma: "Quadro 1 - Cronograma de execucao da pesquisa\n1o semestre 1 a 6 Jan/2026 a Jun/2026 Revisao bibliografica\nFonte: elaborado pelo autor (2026).",
  referencias: "SILVA, M. Projeto de pesquisa. Lavras: UFLA, 2024.",
};

const cpgFields: AcademicFields = {
  ...baseFields,
  workType: "resumo_expandido_cpg",
  program: "Universidade Federal de Lavras\nPrograma de Pos-Graduacao",
  course: "maria@ufla.br",
};

describe("Contrato final por tipo de trabalho", () => {
  describe("Artigo acadêmico simples", () => {
    it("exporta sem pre-textuais de graduacao", async () => {
      const documentXml = await generatedArticleXml("# Introducao\nTexto do artigo.\n[REF] SOUZA, J. Texto. Lavras: UFLA, 2025.");

      expect(documentXml).toContain("QUALIDADE DO CAFE NO SUL DE MINAS");
      expect(documentXml).toContain("MARIA SILVA");
      expect(documentXml).toContain("Resumo do trabalho.");
      expect(documentXml).toContain("Palavras-chave");
      expect(documentXml).toContain("Abstract text.");
      expect(documentXml).toContain("Keywords");
      expect(documentXml).toContain("REFERÊNCIAS");
      expectNoGraduateOnlyElements(documentXml);
    });

    it("nao emite program-conflict por metadados institucionais", () => {
      const issues = validateWork(
        {
          ...articleFields,
          program: "Educacao Cientifica e Ambiental",
          resumo: "Artigo vinculado ao PPGECA.",
          workNature: "",
          advisor: "",
          course: "",
        },
        "Texto menciona UFLA.",
      );
      expect(issues.map((i) => i.code)).not.toContain("program-conflict");
      expect(issues.map((i) => i.code)).not.toContain("program-required");
      expect(issues.map((i) => i.code)).not.toContain("course-required");
      expect(issues.map((i) => i.code)).not.toContain("advisor-required");
      expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
    });
  });

  describe("Monografia", () => {
    it("exporta estrutura completa com capa, ficha, aprovacao, resumo, abstract, sumario e referencias", async () => {
      const documentXml = await generatedXml("# 1 Introducao\nTexto comum.", monographFields);

      expect(documentXml).toContain("MARIA SILVA");
      expect(documentXml).toContain("QUALIDADE DO CAFE NO SUL DE MINAS");
      expect(documentXml).toContain("FICHA CATALOGR");
      expect(documentXml).toContain("APROVADO EM:");
      expect(documentXml).toContain("SUMÁRIO");
      expect(documentXml).toContain("Resumo do trabalho.");
      expect(documentXml).toContain("Abstract text.");
      expect(documentXml).toContain("REFERÊNCIAS");
      expect(documentXml).toContain("Bacharelado em Biologia");
      expect(documentXml).toContain("Prof. Dr. João Silva");
    });
  });

  describe("Dissertacao", () => {
    it("exporta natureza correta e elementos de pos-graduacao", async () => {
      const documentXml = await generatedXml("# 1 Introducao\nTexto comum.", dissertationFields);

      expect(documentXml).toContain("Dissertação apresentada à Universidade Federal de Lavras");
      expect(documentXml).toContain("Programa de Pós-Graduação em Ciência do Solo");
      expect(documentXml).toContain("Prof. Dr. João Silva");
      expect(documentXml).toContain("INDICADORES DE IMPACTO");
      expect(documentXml).toContain("IMPACT INDICATORS");
      expect(documentXml).toContain("SUMÁRIO");
      expect(documentXml).toContain("FICHA CATALOGR");
      expect(documentXml).toContain("APROVADO EM:");
      expect(documentXml).not.toContain("Trabalho acadêmico apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis");
    });
  });

  describe("Tese", () => {
    it("exporta natureza correta e elementos de pos-graduacao", async () => {
      const documentXml = await generatedXml("# 1 Introducao\nTexto comum.", thesisFields);

      expect(documentXml).toContain("Tese apresentada à Universidade Federal de Lavras");
      expect(documentXml).toContain("Programa de Pós-Graduação em Ciência do Solo");
      expect(documentXml).toContain("Prof. Dr. João Silva");
      expect(documentXml).toContain("INDICADORES DE IMPACTO");
      expect(documentXml).toContain("IMPACT INDICATORS");
      expect(documentXml).toContain("SUMÁRIO");
      expect(documentXml).toContain("FICHA CATALOGR");
      expect(documentXml).toContain("APROVADO EM:");
      expect(documentXml).not.toContain("Trabalho acadêmico apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis");
    });
  });

  describe("Projeto de pesquisa", () => {
    it("usa template proprio e exporta secoes obrigatorias", async () => {
      expect(templateForWorkType("projeto_pesquisa").id).toBe("projeto-pesquisa");

      const documentXml = await generatedProjectXml(
        `# INTRODUÇÃO
Texto da introducao.

# PROBLEMA DE PESQUISA
Descricao do problema.

# OBJETIVO GERAL
Objetivo principal.

# JUSTIFICATIVA
Justificativa da pesquisa.

# METODOLOGIA
Metodologia a ser usada.

# CRONOGRAMA
Quadro 1 - Cronograma de execucao da pesquisa
1o semestre 1 a 6 Jan/2026 a Jun/2026 Revisao bibliografica
Fonte: elaborado pelo autor (2026).

# REFERÊNCIAS
SILVA, M. Projeto de pesquisa. Lavras: UFLA, 2024.`,
        projectFields,
      );

      expect(documentXml).toContain("SUMÁRIO");
      expect(documentXml).toContain("INTRODUÇÃO");
      expect(documentXml).toContain("PROBLEMA DE PESQUISA");
      expect(documentXml).toContain("OBJETIVO GERAL");
      expect(documentXml).toContain("JUSTIFICATIVA");
      expect(documentXml).toContain("METODOLOGIA");
      expect(documentXml).toContain("CRONOGRAMA");
      expect(documentXml).toContain("REFERÊNCIAS");
      expect(documentXml).not.toContain("FICHA CATALOGR");
      expect(documentXml).not.toContain("FOLHA DE APROVA");
    });
  });

  describe("CPG/UFLA", () => {
    it("resumo CPG nao exporta estruturas proibidas", async () => {
      const documentXml = await generatedCpgXml("", {
        ...cpgFields,
        workType: "resumo_cpg",
        abstractText: "Abstract text.",
        keywords: "keyword1; keyword2",
        resumo: "Resumo texto do resumo.",
        palavrasChave: "palavra1; palavra2",
      });

      expect(documentXml).toContain("QUALIDADE DO CAFE NO SUL DE MINAS");
      expect(documentXml).toContain("MARIA SILVA");
      expect(documentXml).toContain("Resumo texto do resumo.");
      expect(documentXml).toContain("Palavras-chave");
      expect(documentXml).toContain("Abstract text.");
      expect(documentXml).toContain("Keywords");
      expect(documentXml).not.toContain("SUMÁRIO");
      expect(documentXml).not.toContain("FICHA CATALOGR");
      expect(documentXml).not.toContain("FOLHA DE APROVA");
      expect(documentXml).not.toContain("INDICADORES DE IMPACTO");
      expect(documentXml).not.toContain("IMPACT INDICATORS");
      expect(documentXml).not.toContain("PageNumber");
    });

    it("resumo expandido CPG preserva ordem e secoes permitidas", async () => {
      const documentXml = await generatedCpgXml(
        "# 1 INTRODUÇÃO\nTexto permitido.\n# 4 INDICADORES DE IMPACTO\nConteudo proibido.\n# 5 CRONOGRAMA\nCronograma permitido.",
        cpgFields,
      );

      expect(documentXml).toContain("INTRODUÇÃO");
      expect(documentXml).toContain("Texto permitido.");
      expect(documentXml).not.toContain("INDICADORES DE IMPACTO");
      expect(documentXml).not.toContain("Conteudo proibido.");
      expect(documentXml).toContain("CRONOGRAMA");
      expect(documentXml).toContain("Cronograma permitido.");
      expectCpgMargins(documentXml);
    });

    it("artigo completo CPG nao exporta estruturas proibidas", async () => {
      const documentXml = await generatedCpgXml("# Introducao\nTexto comum.", {
        ...cpgFields,
        workType: "artigo_completo_cpg",
      });

      expect(documentXml).toContain("Abstract");
      expect(documentXml).toContain("Resumo");
      expectNoGraduateOnlyElements(documentXml);
      expectCpgMargins(documentXml);
    });
  });

  describe("Reparo de titulos", () => {
    it("repara titulos quebrados comuns", () => {
      expect(repairHeadingFragments("# RESULTADOS\nE DISCUSSÃO")).toBe("# RESULTADOS E DISCUSSÃO");
      expect(repairHeadingFragments("# OBJETIVOS\nESPECIFICOS")).toBe("# OBJETIVOS ESPECIFICOS");
    });

    it("nao junta paragrafo comum apos titulo", () => {
      expect(repairHeadingFragments("# RESULTADOS\nEste texto é um parágrafo comum.")).toBe(
        "# RESULTADOS\nEste texto é um parágrafo comum.",
      );
    });
  });
});

function expectCpgMargins(documentXml: string): void {
  expect(documentXml).toContain(`w:top="${CPG_RULES.margins.topTwip}"`);
  expect(documentXml).toContain(`w:bottom="${CPG_RULES.margins.bottomTwip}"`);
  expect(documentXml).toContain(`w:left="${CPG_RULES.margins.leftTwip}"`);
  expect(documentXml).toContain(`w:right="${CPG_RULES.margins.rightTwip}"`);
}
