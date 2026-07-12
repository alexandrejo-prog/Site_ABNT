import { describe, expect, it } from "vitest";
import { detectAcademicFieldsFromText } from "../src/field-detector";

const naturezaCompleta =
  "Dissertacao apresentada a Universidade Federal de Lavras, como parte das exigencias do Programa de Pos-Graduacao em Administracao Publica, area de concentracao em Gestao Publica, Tecnologias e Inovacao, para a obtencao do titulo de Mestre.";

const textoConvertidoPdfSintetico = `UNIVERSIDADE FEDERAL DE LAVRAS
AUTORA SINTETICA
TELETRABALHO E GESTAO PUBLICA

${naturezaCompleta}

Ficha catalografica
Orientador: Nome do Orientador Bibliografia.
Bibliografia.

APROVADA em 08 de julho de 2025.

Texto sintetico de resumo sobre teletrabalho, programa de gestao e desempenho e administracao publica, sem copiar documento real.
Palavras-chave: teletrabalho; programa de gestao e desempenho; administracao publica.

Synthetic abstract text about telework, management and performance program and public administration, without copying any real document.
Keywords: telework; management and performance program; public administration.

INDICADORES DE IMPACTO
Texto sintetico de indicadores.

IMPACT INDICATORS
Synthetic impact text.

LISTA DE QUADROS
Quadro 1 - Exemplo sintetico

LISTA DE GRAFICOS
Grafico 1 - Exemplo sintetico

LISTA DE SIGLAS
PGD - Programa de Gestao e Desempenho

1 INTRODUCAO
Texto introdutorio sintetico.

REFERENCIAS
SILVA, A. Referencia sintetica.`;

describe("importacao de DOCX convertido de PDF", () => {
  it("recupera campos por delimitadores e sinaliza baixa confianca estrutural", () => {
    const result = detectAcademicFieldsFromText(textoConvertidoPdfSintetico);

    expect(result.fields.resumo).toContain("Texto sintetico de resumo");
    expect(result.fields.palavrasChave).toBe("teletrabalho; programa de gestao e desempenho; administracao publica.");
    expect(result.fields.abstractText).toContain("Synthetic abstract text");
    expect(result.fields.keywords).toBe("telework; management and performance program; public administration.");

    expect(result.fields.workNature).toBe(naturezaCompleta);
    expect(result.fields.workNature).toContain("Administracao Publica");
    expect(result.fields.workNature).not.toContain("Programa de Pos-Graduacao em Administracao,");
    expect(result.fields.workNature).not.toContain("Mestre em Ciencias");

    expect(result.fields.advisor).toBe("Nome do Orientador");
    expect(result.messages).toContain("Ficha catalografica detectada no documento importado; preserve os dados reais e revise antes de gerar.");
    expect(result.messages).toContain("Folha de aprovacao detectada no documento importado; preserve os dados reais e revise antes de gerar.");
    expect(result.messages).toContain("Indicadores de impacto detectados no documento importado.");
    expect(result.messages).toContain("Listas pre-textuais detectadas no documento importado.");
    expect(result.messages).toContain(
      "Este DOCX parece ter sido convertido de PDF. Alguns títulos, caixas de texto, imagens, quadros e elementos pré-textuais podem ter sido deslocados para cabeçalhos, rodapés ou objetos ancorados. Revise os campos extraídos antes de gerar o DOCX.",
    );
    expect(result.confidence.resumo).toBe("baixa");
    expect(result.confidence.abstractText).toBe("baixa");
  });

  it("nao duplica titulos deslocados nem trata placeholders/imagens como texto academico principal", () => {
    const result = detectAcademicFieldsFromText(`${textoConvertidoPdfSintetico}

[Imagem detectada: rId9]
Placeholder: inserir resumo aqui.
`);

    expect(result.fields.resumo).not.toContain("RESUMO");
    expect(result.fields.abstractText).not.toContain("ABSTRACT");
    expect(result.fields.resumo).not.toContain("Placeholder");
    expect(result.fields.abstractText).not.toContain("[Imagem detectada");
  });
});
