import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ensureTrailingPeriod, generateDocxBlob } from "../src/export-docx";
import { emptyAcademicFields, type AcademicFields } from "../src/ufla-rules";

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

async function generatedXml(editorText: string, documentFields: AcademicFields): Promise<string> {
  const blob = await generateDocxBlob({ fields: documentFields, editorText });
  return extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
}

function baseFields(overrides: Partial<AcademicFields> = {}): AcademicFields {
  return {
    ...emptyAcademicFields(),
    workType: "tese",
    author: "Maria Silva",
    title: "Titulo valido",
    location: "Lavras - MG",
    year: "2026",
    resumo: "Resumo valido.",
    abstractText: "Valid abstract.",
    palavrasChave: "UFLA; ABNT; DOCX",
    keywords: "UFLA; ABNT; DOCX",
    introducao: "Texto comum.",
    program: "Ciencia do Solo",
    advisor: "Prof. Dr. Joao Souza",
    indicadoresImpacto: "Impacto social: beneficia a comunidade.",
    impactIndicators: "Social impact text.",
    referencias: "SILVA, M. Livro. Lavras: UFLA, 2024.",
    ...overrides,
  };
}

function tocInstruction(documentXml: string): string {
  return [...documentXml.matchAll(/<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g)]
    .map((match) => match[1])
    .join(" ");
}

describe("tese e dissertacao - conformidade UFLA", () => {
  it("não gera nenhum placeholder [PREENCHER: no DOCX de tese", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ workType: "tese" }));
    expect(documentXml).not.toContain("[PREENCHER");
  });

  it("não gera nenhum placeholder [PREENCHER: no DOCX de dissertacao", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ workType: "dissertacao" }));
    expect(documentXml).not.toContain("[PREENCHER");
  });

  it("folha de rosto de tese não contém 'Curso:'", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ workType: "tese", course: "Bacharelado em Administracao Publica" }));
    expect(documentXml).not.toContain("Curso:");
  });

  it("folha de rosto de dissertacao não contém 'Curso:'", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ workType: "dissertacao", course: "Bacharelado em Administracao Publica" }));
    expect(documentXml).not.toContain("Curso:");
  });

  it("monografia mantém 'Curso:' quando preenchido", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ workType: "monografia", course: "Bacharelado em Biologia" }));
    expect(documentXml).toContain("Curso: Bacharelado em Biologia");
  });

  it("Palavras-chave termina com ponto final", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ palavrasChave: "UFLA; ABNT; DOCX" }));
    expect(documentXml).toContain("Palavras-chave: UFLA; ABNT; DOCX.");
  });

  it("Palavras-chave não duplica ponto final", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ palavrasChave: "UFLA; ABNT; DOCX." }));
    expect(documentXml).toContain("Palavras-chave: UFLA; ABNT; DOCX.");
    expect(documentXml).not.toContain("Palavras-chave: UFLA; ABNT; DOCX..");
  });

  it("Keywords termina com ponto final", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ keywords: "UFLA; ABNT; DOCX" }));
    expect(documentXml).toContain("Keywords: UFLA; ABNT; DOCX.");
  });

  it("Keywords não duplica ponto final", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ keywords: "UFLA; ABNT; DOCX." }));
    expect(documentXml).toContain("Keywords: UFLA; ABNT; DOCX.");
    expect(documentXml).not.toContain("Keywords: UFLA; ABNT; DOCX..");
  });

  it("sumário de tese usa campo TOC atualizável e não lista estática pobre", async () => {
    const editorText = "# 1 Introducao\nTexto.\n## 1.1 Contexto\nTexto.\n# 2 Metodologia\nTexto.";
    const documentXml = await generatedXml(editorText, baseFields({ workType: "tese" }));
    const toc = tocInstruction(documentXml);
    expect(toc).toContain("TOC");
    expect(toc).toMatch(/\\o\s+&quot;1-3&quot;/);
    // Tese não deve ter entradas estáticas de sumário (estilo TOC1).
    expect((documentXml.match(/w:val="TOC1"/g) ?? []).length).toBe(0);
  });

  it("sumário de monografia usa campo TOC atualizável (igual a tese/dissertação)", async () => {
    const editorText = "# 1 Introducao\nTexto.\n## 1.1 Contexto\nTexto.";
    const documentXml = await generatedXml(editorText, baseFields({ workType: "monografia", course: "Bacharelado em Biologia" }));
    const toc = tocInstruction(documentXml);
    expect(toc).toContain("TOC");
    expect(toc).toContain("1-3");
    expect(documentXml).toMatch(/<w:fldChar w:fldCharType="begin"[^>]*w:dirty="true"/);
    // Monografia não deve manter lista estática de sumário (sem entradas TOC2/TOC3).
    expect((documentXml.match(/w:val="TOC2"/g) ?? []).length).toBe(0);
    expect((documentXml.match(/w:val="TOC3"/g) ?? []).length).toBe(0);
  });

  it("cronograma em formato de tabela markdown vira tabela DOCX", async () => {
    const editorText = `# 1 INTRODUCAO
Texto.

# 5 CRONOGRAMA
Etapa | Mês 1 | Mês 2 | Mês 3
Atividade 1 | X |  | 
Atividade 2 |  | X | `;
    const documentXml = await generatedXml(editorText, baseFields({ workType: "tese" }));
    expect(documentXml).toContain("<w:tbl");
    expect(documentXml).toContain("Etapa");
    expect(documentXml).toContain("Mês 1");
    expect(documentXml).toContain("Mês 3");
    expect(documentXml).toContain("Atividade 1");
  });
});

describe("ensureTrailingPeriod", () => {
  it("adiciona ponto quando ausente", () => {
    expect(ensureTrailingPeriod("UFLA; ABNT; DOCX")).toBe("UFLA; ABNT; DOCX.");
  });
  it("adiciona ponto quando termina com ponto e vírgula", () => {
    expect(ensureTrailingPeriod("UFLA; ABNT; DOCX;")).toBe("UFLA; ABNT; DOCX.");
  });
  it("mantém ponto existente", () => {
    expect(ensureTrailingPeriod("UFLA; ABNT; DOCX.")).toBe("UFLA; ABNT; DOCX.");
  });
  it("retorna vazio para texto vazio", () => {
    expect(ensureTrailingPeriod("  ")).toBe("");
  });
});

describe("tese e dissertacao - indicadores, sumario, cronograma, referencias, aprovacao", () => {
  it("indicadores de impacto pre-textuais em paragrafo unico sem rotulos", async () => {
    const documentXml = await generatedXml(
      "# 1 Introducao\nTexto.",
      baseFields({
        workType: "tese",
        indicadoresImpacto: "",
        impactoSocial: "Beneficia a comunidade local.",
        impactoCientifico: "Avança a pesquisa em educacao.",
      }),
    );
    expect(documentXml).toContain("INDICADORES DE IMPACTO");
    expect(documentXml).not.toContain("Impacto social:");
    expect(documentXml).not.toContain("Impacto científico:");
    expect(documentXml).toContain("Beneficia a comunidade local.");
    expect(documentXml).toContain("Avança a pesquisa em educacao.");
    expect(documentXml).not.toContain("[PREENCHER:");
  });

  it("nao duplica a secao textual 'INDICADORES DE IMPACTO' no corpo para tese", async () => {
    const editorText = `# 1 INTRODUCAO
Texto introdutorio.

# 4 INDICADORES DE IMPACTO
Impacto social: beneficia a comunidade.
Impacto cientifico: avanca a pesquisa.

# 5 CONCLUSAO
Conclusao final.`;
    const documentXml = await generatedXml(
      editorText,
      baseFields({ workType: "tese", indicadoresImpacto: "Impacto social: beneficia a comunidade." }),
    );
    const count = (documentXml.match(/INDICADORES DE IMPACTO/g) ?? []).length;
    expect(count).toBe(1);
  });

  it("sumario de tese e campo TOC atualizavel (nao pagina vazia enganosa)", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.\n# 2 Metodologia\nTexto.", baseFields({ workType: "tese" }));
    const toc = tocInstruction(documentXml);
    expect(toc).toContain("TOC");
    expect(toc).toMatch(/\\o\s+&quot;1-3&quot;/);
  });

  it("cronograma em texto livre delimitado vira tabela DOCX", async () => {
    const editorText = `# 1 INTRODUCAO
Texto.

# 5 CRONOGRAMA
Etapa    Mês 1    Mês 2    Mês 3
Importar documento    X    X
Testar tese    X    X`;
    const documentXml = await generatedXml(editorText, baseFields({ workType: "tese" }));
    expect(documentXml).toContain("<w:tbl");
    expect(documentXml).toContain("Etapa");
    expect(documentXml).toContain("Mês 1");
    expect(documentXml).toContain("Mês 3");
    expect(documentXml).toContain("Importar documento");
  });

  it("cronograma 'Etapa Mes 1' em espaco simples nao sai como linha unica colada", async () => {
    const editorText = `# 1 INTRODUCAO
Texto.

# 5 CRONOGRAMA
Etapa Mês 1 Mês 2 Mês 3
Importar documento X
Testar tese X`;
    const documentXml = await generatedXml(editorText, baseFields({ workType: "tese" }));
    expect(documentXml).toContain("Importar documento X");
    expect(documentXml).toContain("Testar tese X");
    expect(documentXml).not.toContain("Importar documento XTestar tese X");
  });

  it("referencia do Manual UFLA 2024 vira 2025 no DOCX", async () => {
    const documentXml = await generatedXml(
      "# 1 Introducao\nTexto.",
      baseFields({ workType: "tese", referencias: "Manual de normalização e estrutura de trabalhos acadêmicos. Lavras: UFLA, 2024." }),
    );
    expect(documentXml).toContain("Lavras: UFLA, 2025.");
    expect(documentXml).toContain("6. ed. rev., atual. e ampl.");
    expect(documentXml).not.toContain("Lavras: UFLA, 2024.");
  });

  it("folha de aprovacao de tese contem aviso de banca a preencher", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ workType: "tese" }));
    expect(documentXml).toContain("Banca examinadora a ser preenchida na versão final.");
    expect(documentXml).toContain("Prof.(a) Dr.(a)");
  });

  it("nao exporta caractere estranho U+FFFE (TECNICO ADMINISTRATIVOS)", async () => {
    const editorText = "# 1 Introducao\nTexto com TÉCNICO\uFFFEADMINISTRATIVOS presente.";
    const documentXml = await generatedXml(editorText, baseFields({ workType: "tese" }));
    expect(documentXml).not.toContain("\uFFFE");
    expect(documentXml).toContain("TÉCNICO-ADMINISTRATIVOS");
  });

  it("cronograma nao engole secoes seguintes", async () => {
    const editorText = `# 1 INTRODUCAO
Texto.

# 5 CRONOGRAMA
Etapa Mês 1 Mês 2 Mês 3
Importar documento X

# 6 CONSIDERAÇÕES FINAIS
Texto das considerações finais.`;
    const documentXml = await generatedXml(editorText, baseFields({ workType: "tese" }));
    expect(documentXml).toContain("<w:tbl");
    expect(documentXml).toContain("CRONOGRAMA");
    expect(documentXml).toContain("Importar documento X");
    expect(documentXml).not.toContain("# 6 CONSIDERAÇÕES FINAIS");
    expect(documentXml).toContain("CONSIDERAÇÕES FINAIS");
    expect(documentXml).toContain("Texto das considerações finais.");
  });

  it("renumera secoes apos remover secao 4 INDICADORES DE IMPACTO", async () => {
    const editorText = `# 1 INTRODUCAO
Texto.

# 4 INDICADORES DE IMPACTO
Impacto.

# 5 CRONOGRAMA
Etapa X.

# 6 CONSIDERAÇÕES FINAIS
Texto.`;
    const documentXml = await generatedXml(
      editorText,
      baseFields({ workType: "tese", indicadoresImpacto: "Impacto." }),
    );
    expect(documentXml).not.toContain("4 INDICADORES DE IMPACTO");
    expect(documentXml).toContain("4 CRONOGRAMA");
    expect(documentXml).not.toContain("5 CRONOGRAMA");
    expect(documentXml).toContain("5 CONSIDERAÇÕES FINAIS");
    expect(documentXml).not.toContain("6 CONSIDERAÇÕES FINAIS");
  });

  it("indicadores pre-textuais sem nenhum rotulo com dois-pontos (campo consolidado)", async () => {
    const consolidated = [
      "Impacto social: beneficia a comunidade local.",
      "Impacto científico: avança a pesquisa em educacao.",
      "Impacto educacional: melhora o ensino.",
      "Impacto ambiental: preserva o meio ambiente.",
      "Impacto tecnológico/econômico: gera renda.",
      "Público beneficiado: estudantes e orientadores.",
      "Aderência a ODS/política institucional: alinhado ao plano.",
    ].join("\n");
    const documentXml = await generatedXml(
      "# 1 Introducao\nTexto.",
      baseFields({ workType: "tese", indicadoresImpacto: consolidated }),
    );
    expect(documentXml).toContain("INDICADORES DE IMPACTO");
    expect(documentXml).not.toContain("Impacto científico:");
    expect(documentXml).not.toContain("Impacto educacional:");
    expect(documentXml).not.toContain("Impacto ambiental:");
    expect(documentXml).not.toContain("Impacto tecnológico/econômico:");
    expect(documentXml).not.toContain("Público beneficiado:");
    expect(documentXml).not.toContain("Aderência a ODS/política institucional:");
    expect(documentXml).toContain("beneficia a comunidade local.");
    expect(documentXml).toContain("estudantes e orientadores.");
  });

    it("nao exporta caractere estranho U+2060 (TECNICO ADMINISTRATIVOS)", async () => {
    const wordJoiner = String.fromCodePoint(0x2060);
    const editorText = `# 1 Introducao\nTexto com TÉCNICO${wordJoiner}ADMINISTRATIVOS presente.`;
    const documentXml = await generatedXml(editorText, baseFields({ workType: "tese" }));
    expect(documentXml).not.toContain(wordJoiner);
    expect(documentXml).toContain("TÉCNICO-ADMINISTRATIVOS");
  });

  it("nao duplica secao final quando editor ja tem CONSIDERAÇÕES FINAIS e campos.conclusao preenchido", async () => {
    const editorText = `# 1 INTRODUCAO
Texto.

# 4 INDICADORES DE IMPACTO
Impacto.

# 5 CRONOGRAMA
Etapa X.

# 6 CONSIDERAÇÕES FINAIS
Texto.`;
    const documentXml = await generatedXml(
      editorText,
      baseFields({ workType: "tese", indicadoresImpacto: "Impacto.", conclusao: "Conclusao preenchida." }),
    );
    expect(documentXml).not.toContain("4 INDICADORES DE IMPACTO");
    expect(documentXml).toContain("4 CRONOGRAMA");
    expect(documentXml).toContain("5 CONSIDERAÇÕES FINAIS");
    expect(documentXml).not.toContain("6 CONSIDERAÇÕES FINAIS");
    expect(documentXml).not.toContain("5 CONCLUSÃO");
    expect((documentXml.match(/CONSIDERAÇÕES FINAIS/g) ?? []).length).toBe(1);
  });

  it("sumario de tese tem campo TOC real no XML", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.\n# 2 Metodologia\nTexto.", baseFields({ workType: "tese" }));
    expect(documentXml).toMatch(/<w:fldSimple[\s\S]*?TOC|w:instrText[\s\S]*?TOC/s);
  });

  it("remove caracteres invisiveis de todos os caminhos da tese", async () => {
    const documentXml = await generatedXml(
      "# 1 Introducao\nTexto com técnico￾administrativo no corpo.\n# 2 Metodologia\nTexto.",
      baseFields({
        workType: "tese",
        title: "Técnico￾Administrativos",
        resumo: "Estudo com histórico￾dialético relevante.",
        abstractText: "SGP-SRT￾SEGES/MGI relevance.",
        palavrasChave: "Técnico￾Administrativos; histórico￾dialético",
        referencias: "SILVA, M. Técnico￾Administrativos. Lavras: UFLA, 2024.",
      }),
    );
    expect(documentXml).not.toContain("￾");
    expect(documentXml).toContain("Técnico-Administrativos");
    expect(documentXml).toContain("histórico-dialético");
    expect(documentXml).toContain("SGP-SRT-SEGES/MGI");
    expect(documentXml).toContain("técnico-administrativo");
  });
});

describe("documento ideal de teste (importado)", () => {
  it("download-filename preserva importedFileName para tese", () => {
    // Documentação: o arquivo documento_ideal_teste_tipos_trabalho_ufla_abnt.docx
    // é externo (não versionado). O nome do DOCX deve usar importedFileName.
    const source = readFileSync(new URL("../src/download-filename.ts", import.meta.url), "utf8");
    expect(source).toContain("importedFileName");
  });
});
