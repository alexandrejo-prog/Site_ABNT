import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectAcademicFieldsFromStructure } from "../src/field-detector";
import { identifyAcademicFields } from "../src/import-docx";
import { extractDocxStructure } from "../src/word-structure-extractor";

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

  it("detecta ANEXOS e APÊNDICES sem truncar após apêndice", async () => {
    const result = await detectTemplate();
    expect(result.fields.anexos).toContain("ANEXO A");
    expect(result.fields.apendices).toContain("APÊNDICE A");
    expect(result.fields.apendices).toContain("[Imagem detectada:");
  });
});
