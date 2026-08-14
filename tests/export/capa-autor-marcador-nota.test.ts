import { describe, expect, it } from "vitest";
import { identifyAcademicFields } from "../../src/import-docx";

const TITLE =
  "EDUCACAO MATEMATICA CRITICA E ARTE: PROPOSICAO DE UM MODELO DE ANALISE GEOMETRICO-CRITICO APLICADO A OBRA GRANDE FACHADA FESTIVA (1950), DE ALFREDO VOLPI";

const CAPA = (authorLine: string): string =>
  `UNIVERSIDADE FEDERAL DE LAVRAS
${authorLine}
${TITLE}
LAVRAS - MG
2026

Monografia apresentada a Universidade Federal de Lavras.

1 INTRODUCAO
Texto.

REFERENCIAS
SILVA, M. Titulo. Lavras: UFLA, 2024.`;

describe("importação - autor com marcador de nota sobrescrito na capa", () => {
  it.each([
    ["SEM marcador", "ALEXANDRE JOSE DE OLIVEIRA"],
    ["'1' ASCII colado", "ALEXANDRE JOSE DE OLIVEIRA1"],
    ["'¹' unicode sobrescrito", "ALEXANDRE JOSE DE OLIVEIRA\u00b9"],
    ["'12' colado", "ALEXANDRE JOSE DE OLIVEIRA12"],
  ])("%s: detecta autor sem marcador e título sem o autor", (_label, authorLine) => {
    const result = identifyAcademicFields(CAPA(authorLine));
    expect(result.fields.author).toBe("ALEXANDRE JOSE DE OLIVEIRA");
    expect(result.fields.title).toContain("EDUCACAO MATEMATICA CRITICA E ARTE");
    expect(result.fields.title).not.toContain("ALEXANDRE");
    expect(result.fields.title).not.toMatch(/OLIVEIRA\s*\d*\s*$/);
  });

  it("não remove ano (4 dígitos) nem número com espaço do título", () => {
    const result = identifyAcademicFields(CAPA("ALEXANDRE JOSE DE OLIVEIRA"));
    expect(result.fields.title).toContain("FACHADA FESTIVA (1950)");
    expect(result.fields.author).toBe("ALEXANDRE JOSE DE OLIVEIRA");
  });
});
