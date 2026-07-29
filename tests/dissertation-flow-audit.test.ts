import { describe, expect, it } from "vitest";
import { buildDownloadFileName } from "../src/download-filename";
import { templateForWorkType } from "../src/document-template";
import { finalVersionPendencies, projectLanguageWarning } from "../src/graduate-draft-guidance";
import { emptyAcademicFields } from "../src/ufla-rules";
import { documentText, loadDocxParts, normalizeOoxmlText, paragraphTexts, tocInstruction } from "./test-utils/ooxml";

function countOccurrences(value: string, term: string): number {
  return value.split(term).length - 1;
}

describe("fluxo real de dissertação como rascunho editável", () => {
  const fields = {
    ...emptyAcademicFields(),
    workType: "dissertacao" as const,
    title: "Métricas, trabalho e saúde dos servidores técnico-administrativos em educação da Universidade Federal de Lavras sob a perspectiva da Educação Ambiental Crítica",
    author: "Alexandre José de Oliveira",
    program: "Educação Científica e Ambiental",
    advisor: "Prof. Dr. [nome do orientador]",
    location: "Lavras - MG",
    year: "2026",
    workNature:
      "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do Programa de Pós-Graduação em Educação Científica e Ambiental, área de concentração em Educação Científica e Ambiental, para obtenção do título de Mestre.",
    resumo:
      "Este projeto de pesquisa analisa criticamente as relações entre métricas institucionais, trabalho técnico-administrativo e saúde no contexto da Universidade Federal de Lavras. A investigação será realizada por meio de análise documental e entrevistas semiestruturadas, considerando a Educação Ambiental Crítica como eixo teórico para compreender mediações entre trabalho, ambiente universitário e gestão. Pretende-se examinar como o Programa de Gestão e Desempenho reorganiza tempos, registros, entregas e responsabilidades, articulando dimensões institucionais, subjetivas e políticas do trabalho.",
    palavrasChave: "Programa de Gestão e Desempenho; trabalho; Educação Ambiental Crítica; saúde; UFLA",
    abstractText:
      "This dissertation draft critically analyzes the relations among institutional metrics, technical-administrative work and health at the Federal University of Lavras. The study examines documents and semi-structured interviews, taking Critical Environmental Education as a theoretical axis to understand mediations between work, university environment and management. It discusses how performance management reorganizes time, records, deliverables and responsibilities, articulating institutional, subjective and political dimensions of work.",
    keywords: "Performance Management Program; work; Critical Environmental Education; health; UFLA",
    referencias:
      "FREIRE, Paulo. Pedagogia da autonomia: saberes necessários à prática educativa. São Paulo: Paz e Terra, 1996.\nMARX, Karl. O capital: crítica da economia política. São Paulo: Boitempo, 2013.",
  };

  const editorText = `# 1 INTRODUÇÃO
O projeto de pesquisa parte do problema das métricas no trabalho técnico-administrativo e de seus efeitos sobre a saúde, a autonomia e a organização coletiva do cotidiano universitário.

# 2 REFERENCIAL TEÓRICO
A análise considera a categoria trabalho e a Educação Ambiental Crítica como mediações para interpretar a produção social do ambiente universitário.

## 2.1 Trabalho, gestão e ambiente universitário
A discussão articula contradições entre produtividade formal, intensificação do trabalho e saúde dos servidores.

# 3 METODOLOGIA
Serão analisadas normas institucionais, documentos do PGD e entrevistas semiestruturadas com servidores técnico-administrativos em educação.

Quadro 1 - Cronograma de execução da pesquisa
Etapa Meses Período Atividades principais
1º semestre 1 a 2 03/2026 a 04/2026 Levantamento documental e revisão bibliográfica
2º semestre 3 a 4 05/2026 a 06/2026 Entrevistas e organização do corpus
Fonte: elaborado pelo autor.

# 4 RESULTADOS E DISCUSSÃO
A dissertação discute a tensão entre controle por entregas, registros institucionais e experiência concreta do trabalho.

# 5 CONSIDERAÇÕES FINAIS
O texto será revisado para substituir a linguagem de projeto por linguagem própria de dissertação final.
`;

  it("usa template de rascunho longo e nomeia como dissertação", () => {
    expect(templateForWorkType("dissertacao").id).toBe("rascunho-longo-editavel");

    const fileName = buildDownloadFileName({
      workType: "dissertacao",
      title: fields.title,
      importedFileName: null,
    });

    expect(fileName).toMatch(/^dissertacao-/);
    expect(fileName).not.toContain("software");
    expect(fileName).not.toContain("aplicativo");
  });

  it("mantem elementos estruturais próprios de dissertação sem artefatos técnicos", async () => {
    const blob = await templateForWorkType("dissertacao").generate({ fields, editorText });
    const parts = await loadDocxParts(blob);
    const text = documentText(parts.documentXml);
    const normalizedText = normalizeOoxmlText(text);
    const toc = tocInstruction(parts.documentXml);

    expect(normalizedText).toContain(normalizeOoxmlText("Dissertação apresentada à Universidade Federal de Lavras"));
    expect(normalizedText).toContain(normalizeOoxmlText("para obtenção do título de Mestre"));
    expect(normalizedText).toContain(normalizeOoxmlText("FICHA CATALOGRAFICA DETECTADA"));
    expect(normalizedText).toContain(normalizeOoxmlText("PRESERVE OU SUBSTITUA MANUALMENTE PELA FICHA OFICIAL DA BIBLIOTECA UNIVERSITARIA DA UFLA"));
    expect(normalizedText).toContain(normalizeOoxmlText("APROVADO EM"));
    expect(normalizedText).toContain(normalizeOoxmlText("ORIENTADOR(A)"));
    expect(normalizedText).toContain("RESUMO");
    expect(normalizedText).toContain("ABSTRACT");
    expect(normalizedText).toContain("SUMARIO");

    expect(text).not.toContain("Trabalho acadêmico apresentado");
    expect(text).not.toContain("Projeto de pesquisa apresentado");
    expect(text).not.toContain("\uFFFE");
    expect(text).not.toContain("TITLE 1");
    expect(text).not.toContain("Toc");
    expect(toc).toContain("TOC");
    expect(toc).toContain("1-3");
  });

  it("mantem updateFields, Times New Roman, margens UFLA, referencias e quadros", async () => {
    const blob = await templateForWorkType("dissertacao").generate({ fields, editorText });
    const parts = await loadDocxParts(blob);
    const combinedXml = `${parts.documentXml}\n${parts.stylesXml}\n${parts.settingsXml}`;
    const text = documentText(parts.documentXml);

    expect(parts.settingsXml).toContain("updateFields");
    expect(combinedXml).toContain("Times New Roman");
    expect(parts.documentXml).toContain('w:top="1701"');
    expect(parts.documentXml).toContain('w:left="1701"');
    expect(parts.documentXml).toContain('w:bottom="1134"');
    expect(parts.documentXml).toContain('w:right="1134"');
    expect(parts.documentXml).toContain('w:hanging="283"');
    expect(parts.documentXml).toContain("<w:tbl>");
    expect(countOccurrences(text, "Fonte: elaborado pelo autor.")).toBe(1);
  });

  it("mantem pendências revisáveis e alerta linguagem de projeto sem alterar conteúdo", () => {
    expect(finalVersionPendencies(fields)).toEqual([
      "Substituir o orientador provisório pelo nome oficial do orientador.",
      "Substituir a folha de aprovação provisória pelos dados oficiais da banca.",
      "Substituir a ficha catalográfica provisória pela ficha oficial da Biblioteca Universitária da UFLA.",
    ]);
    expect(projectLanguageWarning(fields, editorText)).toContain("O tipo selecionado é Dissertação");
    expect(paragraphTexts).toBeTypeOf("function");
  });
});
