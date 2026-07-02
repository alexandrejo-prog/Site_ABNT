import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectAcademicFieldsFromStructure } from "../src/field-detector";
import { identifyAcademicFields } from "../src/import-docx";
import {
  extractDocxStructure,
  type DocxStructure,
  type ImportedBlock,
} from "../src/word-structure-extractor";

function paragraph(text: string): ImportedBlock {
  return { type: "paragraph", text, rawText: text, runs: [{ text }] };
}

function heading(text: string, level = 1): ImportedBlock {
  return { type: "heading", level, text, rawText: text, runs: [{ text }] };
}

function structureFromBlocks(blocks: ImportedBlock[]): DocxStructure {
  return {
    blocks,
    paragraphs: [],
    images: [],
    relationships: {},
    styleNames: {},
    text: blocks
      .flatMap((block) => {
        if (block.type === "pageBreak") return [];
        if (block.type === "image") return [`[Imagem detectada: ${block.relationshipId ?? "sem relacao"}]`];
        if (block.type === "table") return block.rows.map((row) => row.join("\t"));
        return [block.text];
      })
      .join("\n"),
    hasNumbering: false,
  };
}

function templatePath(): string {
  const file = readdirSync(process.cwd()).find(
    (name) => name.startsWith("TEMPLATE_Manual") && name.endsWith(".docx"),
  );
  if (!file) throw new Error("Template DOCX da UFLA não encontrado.");
  return join(process.cwd(), file);
}

async function detectTemplate() {
  const structure = await extractDocxStructure(readFileSync(templatePath()));
  return detectAcademicFieldsFromStructure(structure);
}

describe("importação e identificação", () => {
  it("identifica campos acadêmicos prováveis em texto bruto", () => {
    const result = identifyAcademicFields(`
Título: Produção sustentável de café
Autor: Maria Silva
Orientador: João Souza
Ano: 2026

RESUMO
Texto do resumo.

PALAVRAS-CHAVE: café; sustentabilidade

INTRODUÇÃO
Texto da introdução.

REFERÊNCIAS
SILVA, M. Produção sustentável. Lavras: UFLA, 2024.
`);

    expect(result.fields.title).toBe("Produção sustentável de café");
    expect(result.fields.author).toBe("Maria Silva");
    expect(result.fields.resumo).toContain("Texto do resumo");
    expect(result.fields.referencias).toContain("SILVA");
    expect(result.confidence.title).toBe("alta");
  });

  it("separa título, resumo e introdução em arquivo mal segmentado", () => {
    const result = identifyAcademicFields(`
A COISIFICAÇÃO DO TRABALHO NA UNIVERSIDADE GERENCIALISTA: AS CONTRADIÇÕES DO PGD E A SOBRECARGA DOS TÉCNICO-ADMINISTRATIVOS DA UFLA SOB A LENTE DA PEDAGOGIA HISTÓRICO-CRÍTICA
Resumo Este projeto de pesquisa propõe uma análise crítica sobre a cultura da sobrecarga de trabalho imposta aos Servidores Técnico-Administrativos em Educação da Universidade Federal de Lavras.
1. Introdução 1.1. Tema O estudo aborda as mudanças na administração das universidades públicas no Brasil e o impacto na rotina dos servidores.
1.2. Problema de Pesquisa De que maneira a Pedagogia Histórico-Crítica possibilita analisar criticamente a coisificação do trabalho?
REFERÊNCIAS
`);

    expect(result.fields.title).toBe(
      "A COISIFICAÇÃO DO TRABALHO NA UNIVERSIDADE GERENCIALISTA: AS CONTRADIÇÕES DO PGD E A SOBRECARGA DOS TÉCNICO-ADMINISTRATIVOS DA UFLA SOB A LENTE DA PEDAGOGIA HISTÓRICO-CRÍTICA",
    );
    expect(result.fields.title).not.toContain("Resumo");
    expect(result.fields.resumo).toContain("Este projeto de pesquisa propõe");
    expect(result.fields.resumo).not.toContain("1. Introdução");
    expect(result.fields.introducao).toContain("O estudo aborda as mudanças");
  });

  it("detecta autor no template oficial", async () => {
    const result = await detectTemplate();
    expect(result.fields.author).toBe("NOME E SOBRENOME DO AUTOR");
  });

  it("detecta título no template oficial", async () => {
    const result = await detectTemplate();
    expect(result.fields.title).toBe("EXEMPLO DE USO DO PADRÃO DA UFLA: FORMATADO EM WORD");
  });

  it("detecta RESUMO e ABSTRACT no template oficial", async () => {
    const result = await detectTemplate();
    expect(result.fields.resumo).toContain("O resumo deve conter");
    expect(result.fields.abstractText).toContain("The abstract should contain");
    expect(result.fields.palavrasChave).toContain("resumo");
    expect(result.fields.keywords).toContain("summary");
  });

  it("detecta INTRODUÇÃO e REFERÊNCIAS no template oficial", async () => {
    const result = await detectTemplate();
    expect(result.fields.introducao).toContain("O objetivo deste template");
    expect(result.fields.referencias).toContain("ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS");
    expect(result.fields.referencias).toContain("DOI:");
  });

  it("detecta o ano da capa mesmo quando referências têm anos mais recentes ou diferentes", () => {
    const result = detectAcademicFieldsFromStructure(
      structureFromBlocks([
        paragraph("UNIVERSIDADE FEDERAL DE LAVRAS"),
        paragraph("Maria Silva"),
        paragraph("Qualidade do café no sul de Minas"),
        paragraph("Lavras - MG"),
        paragraph("2026"),
        { type: "pageBreak" },
        heading("1 INTRODUÇÃO"),
        paragraph("Texto da introdução."),
        heading("REFERÊNCIAS"),
        paragraph("SILVA, M. Qualidade do café. Lavras: UFLA, 2024."),
        paragraph("SOUZA, J. Manual. Disponível em: https://exemplo.test/2025."),
      ]),
    );

    expect(result.fields.year).toBe("2026");
    expect(result.confidence.year).toBe("alta");
  });

  it("ignora APÊNDICE A no sumário antes da introdução ao coletar apêndices", () => {
    const result = detectAcademicFieldsFromStructure(
      structureFromBlocks([
        heading("SUMÁRIO"),
        paragraph("1 INTRODUÇÃO"),
        paragraph("APÊNDICE A"),
        { type: "pageBreak" },
        heading("1 INTRODUÇÃO"),
        paragraph("Corpo do trabalho que não pode virar apêndice."),
        heading("REFERÊNCIAS"),
        paragraph("SILVA, M. Qualidade do café. Lavras: UFLA, 2024."),
      ]),
    );

    expect(result.fields.apendices).toBe("");
    expect(result.fields.apendices).not.toContain("Corpo do trabalho");
  });

  it("detecta ANEXOS e APÊNDICES sem truncar após apêndice", async () => {
    const result = await detectTemplate();
    expect(result.fields.anexos).toContain("ANEXO A");
    expect(result.fields.apendices).toContain("APÊNDICE A");
    expect(result.fields.apendices).toContain("[Imagem detectada:");
  });

  it("detecta documento CPG com título, autores, afiliação, abstract, resumo e introdução", async () => {
    const cpgBlocks = [
      paragraph("PRÁXIS NO ESTÁGIO DE DOCÊNCIA"),
      paragraph("Alexandre José de Oliveira¹"),
      paragraph("Marina Battistetti Festozo²"),
      paragraph("¹ Universidade Federal de Lavras (UFLA), Programa de Pós-Graduação em Educação Científica e Ambiental."),
      paragraph("² Universidade Federal de Lavras (UFLA), Programa de Pós-Graduação em Educação Científica e Ambiental."),
      paragraph("ABSTRACT"),
      paragraph(
        "This expanded abstract analyzes the teaching internship in the context of scientific and environmental education at UFLA.",
      ),
      paragraph("Keywords: Teaching Internship; Science Education; Environmental Education; Praxis."),
      paragraph("RESUMO"),
      paragraph(
        "Este resumo expandido analisa o estágio de docência no contexto da educação científica e ambiental na UFLA.",
      ),
      paragraph("Palavras-chave: Estágio de Docência; Educação Científica; Educação Ambiental; Práxis."),
      heading("1 INTRODUÇÃO"),
      paragraph("O pensar sobre a docência como prática formativa"),
      heading("2 MATERIAIS E MÉTODOS"),
      paragraph("Metodologia do estudo."),
      heading("3 RESULTADOS E DISCUSSÃO"),
      paragraph("Resultados encontrados."),
      heading("3.1 Formação", 2),
      paragraph("Discussão da formação."),
      heading("3.2 Observação", 2),
      paragraph("Discussão da observação."),
      heading("3.3 Planejamento", 2),
      paragraph("Discussão do planejamento."),
      heading("4 CONCLUSÃO"),
      paragraph("Conclusão do trabalho."),
      heading("AGRADECIMENTOS"),
      paragraph("Agradecimentos."),
      heading("REFERÊNCIAS BIBLIOGRÁFICAS"),
      paragraph("CUNHA, M. Referência de exemplo. Lavras: UFLA, 2024."),
    ];

    const result = detectAcademicFieldsFromStructure(structureFromBlocks(cpgBlocks));

    expect(result.fields.title).toContain("PRÁXIS NO ESTÁGIO DE DOCÊNCIA");
    expect(result.fields.author).toContain("Alexandre José de Oliveira");
    expect(result.fields.author).toContain("Marina Battistetti Festozo");
    expect(result.fields.program).toContain("Universidade Federal de Lavras");
    expect(result.fields.program).toContain("Programa de Pós-Graduação em Educação Científica e Ambiental");
    expect(result.fields.abstractText).toContain("This expanded abstract analyzes");
    expect(result.fields.keywords).toContain("Teaching Internship");
    expect(result.fields.resumo).toContain("Este resumo expandido analisa");
    expect(result.fields.palavrasChave).toContain("Estágio de Docência");
    expect(result.fields.introducao).toContain("O pensar sobre a docência");
    expect(result.fields.referencias).toContain("CUNHA");
    expect(result.editorText).toContain("# 1 INTRODUÇÃO");
    expect(result.editorText).toContain("# 2 MATERIAIS E MÉTODOS");
    expect(result.editorText).toContain("# 3 RESULTADOS E DISCUSSÃO");
    expect(result.editorText).toContain("## 3.1");
    expect(result.editorText).toContain("# 4 CONCLUSÃO");
  });
});
