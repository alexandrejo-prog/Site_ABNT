import { describe, expect, it } from "vitest";
import { identifyAcademicFields } from "../../src/import-docx";
import { sanitizeImportedTitle } from "../../src/title-sanitizer";

describe("sanitizacao de titulo importado", () => {
  it("mantem titulo academico longo, mas plausivel", () => {
    const title = "A COISIFICAÇÃO DO TRABALHO NA UNIVERSIDADE GERENCIALISTA: AS CONTRADIÇÕES DO PGD E A SOBRECARGA DOS TÉCNICO-ADMINISTRATIVOS DA UFLA SOB A LENTE DA PEDAGOGIA HISTÓRICO-CRÍTICA";

    expect(sanitizeImportedTitle(title)).toBe(title);
  });

  it("remove paragrafo narrativo longo usado indevidamente como titulo", () => {
    const paragraph = "Segundo Magaña, os tarenos, do norte do Brasil, narram o mito da origem de Órion e Sírius. Segundo a lenda, uma vez Yalawale estava pescando e se feriu em uma perna, a qual finalmente teve de amputar, decidindo então ir para o céu como constelação. Aparece para anunciar a estação seca com seu nascer helíaco em junho.";

    expect(sanitizeImportedTitle(paragraph)).toBe("");
  });

  it("nao promove corpo de artigo sem capa para titulo", () => {
    const result = identifyAcademicFields(`
Segundo Magaña, os tarenos, do norte do Brasil, narram o mito da origem de Órion e Sírius. Segundo a lenda, uma vez Yalawale estava pescando e se feriu em uma perna, a qual finalmente teve de amputar, decidindo então ir para o céu como constelação. Aparece para anunciar a estação seca com seu nascer helíaco em junho.

Joykexo (O Cinturão de Orion).

A constelação do Homem Velho dos guaranis do Paraná contém três outras constelações indígenas.
`);

    expect(result.fields.title).toBe("");
    expect(result.confidence.title).toBe("nao-identificado");
  });
});
