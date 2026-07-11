import { describe, expect, it } from "vitest";
import { detectAcademicFieldsFromText } from "../src/field-detector";

describe("ordem e isolamento de blocos importados", () => {
  const textoCompleto = `UNIVERSIDADE FEDERAL DE LAVRAS
AUTORA SINTETICA
TELETRABALHO E GESTAO PUBLICA

Dissertacao apresentada a Universidade Federal de Lavras, como parte das exigencias do Programa de Pos-Graduacao em Administracao Publica, area de concentracao em Gestao Publica, Tecnologias e Inovacao, para a obtencao do titulo de Mestre.

Ficha catalografica
Orientador: Nome do Orientador Bibliografia.
Bibliografia.

APROVADA em 08 de julho de 2025.
Prof.(a) Dr.(a) ______________________________
Instituicao: ________________________________

Agradecimentos
A Universidade Federal de Lavras.
Ao meu orientador.

RESUMO
Este projeto de pesquisa analisa criticamente as relacoes entre metricas institucionais, trabalho tecnico-administrativo e saude no contexto da Universidade Federal de Lavras. A investigacao sera realizada por meio de analise documental e entrevistas semiestruturadas, considerando a Educacao Ambiental Critica como eixo teorico para compreender mediacoes entre trabalho, ambiente universitario e gestao. Pretende-se examinar como o Programa de Gestao e Desempenho reorganiza tempos, registros, entregas e responsabilidades, articulando dimensoes institucionais, subjetivas e politicas do trabalho.
Palavras-chave: Programa de Gestao e Desempenho; trabalho; Educacao Ambiental Critica; saude; UFLA.

ABSTRACT
This dissertation draft critically analyzes the relations among institutional metrics, technical-administrative work and health at the Federal University of Lavras. The study examines documents and semi-structured interviews, taking Critical Environmental Education as a theoretical axis to understand mediations between work, university environment and management. It discusses how performance management reorganizes time, records, deliverables and responsibilities, articulating institutional, subjective and political dimensions of work.
Keywords: Performance Management Program; work; Critical Environmental Education; health; UFLA.

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

SUMARIO

1 INTRODUCAO
O projeto de pesquisa parte do problema das metricas no trabalho tecnico-administrativo e de seus efeitos sobre a saude, a autonomia e a organizacao coletiva do cotidiano universitario.

1.1 Objetivo geral
Analisar as relacoes entre metricas institucionais e trabalho.

1.2 Objetivos especificos
Identificar os efeitos do PGD.

1.3 Justificativas
A pesquisa justifica-se pela importancia do tema.

1.4 Organizacao do trabalho
A dissertacao esta organizada em cinco capitulos.

2 REFERENCIAL TEORICO
A analise considera a categoria trabalho e a Educacao Ambiental Critica como mediacoes para interpretar a producao social do ambiente universitario.

3 METODOLOGIA
Serao analisadas normas institucionais, documentos do PGD e entrevistas semiestruturadas com servidores tecnico-administrativos em educacao.

4 RESULTADOS E DISCUSSAO
A dissertacao discute a tensao entre controle por entregas, registros institucionais e experiencia concreta do trabalho.

5 CONSIDERACOES FINAIS
O texto sera revisado para substituir a linguagem de projeto por linguagem propria de dissertacao final.

REFERENCIAS
FREIRE, Paulo. Pedagogia da autonomia: saberes necessarios a pratica educativa. Sao Paulo: Paz e Terra, 1996.
MARX, Karl. O capital: critica da economia politica. Sao Paulo: Boitempo, 2013.`;

  it("preserva natureza do trabalho literalmente sem fallback para Mestre em Ciencias", () => {
    const result = detectAcademicFieldsFromText(textoCompleto);

    expect(result.fields.workNature).toContain("Administracao Publica");
    expect(result.fields.workNature).toContain("Gestao Publica, Tecnologias e Inovacao");
    expect(result.fields.workNature).not.toContain("Mestre em Ciencias");
  });

  it("folha de aprovacao nao e contaminada com resumo, agradecimentos ou listas", () => {
    const result = detectAcademicFieldsFromText(textoCompleto);

    const approvalContent = [
      result.fields.aprovalDate,
      ...(result.fields.approvalMembers ?? []),
    ].join(" ");

    expect(approvalContent).not.toContain("A presente pesquisa teve como objetivo");
    expect(approvalContent).not.toContain("A Universidade Federal de Lavras");
    expect(approvalContent).not.toContain("Gráfico");
    expect(approvalContent).not.toContain("Quadro");
    expect(approvalContent).not.toContain("SUMÁRIO");
    expect(approvalContent).not.toContain("Palavras-chave");
  });

  it("resumo nao duplica fora da secao RESUMO", () => {
    const result = detectAcademicFieldsFromText(textoCompleto);

    expect(result.fields.resumo).toContain("Este projeto de pesquisa analisa");
    expect(result.fields.resumo).not.toContain("This dissertation draft");
    expect(result.editorText).not.toContain("Este projeto de pesquisa analisa criticamente as relacoes entre metricas");
  });

  it("pre-textuais aparecem na ordem correta antes do sumario", () => {
    const result = detectAcademicFieldsFromText(textoCompleto);

    expect(result.fields.agradecimentos).toContain("A Universidade Federal de Lavras");
    expect(result.fields.resumo).toContain("Este projeto de pesquisa analisa");
    expect(result.fields.abstractText).toContain("This dissertation draft");
    expect(result.fields.indicadoresImpacto).toContain("Texto sintetico de indicadores");
    expect(result.fields.impactIndicators).toContain("Synthetic impact text");
    expect(result.fields.listaQuadros).toContain("Quadro 1");
    expect(result.fields.listaGraficos).toContain("Grafico 1");
    expect(result.fields.listaSiglas).toContain("PGD");
  });

  it("corpo segue ordem INTRODUCAO -> REFERENCIAL -> METODOLOGIA -> RESULTADOS -> CONCLUSÃO -> REFERENCIAS", () => {
    const result = detectAcademicFieldsFromText(textoCompleto);
    const editor = result.editorText;

    const introducaoIdx = editor.indexOf("1 INTRODUCAO");
    const referencialIdx = editor.indexOf("2 REFERENCIAL TEORICO");
    const metodologiaIdx = editor.indexOf("3 METODOLOGIA");
    const resultadosIdx = editor.indexOf("4 RESULTADOS E DISCUSSAO");
    const conclusaoIdx = editor.indexOf("5 CONSIDERACOES FINAIS");
    const referenciasIdx = editor.indexOf("REFERENCIAS");

    expect(introducaoIdx).toBeGreaterThanOrEqual(0);
    expect(referencialIdx).toBeGreaterThan(introducaoIdx);
    expect(metodologiaIdx).toBeGreaterThan(referencialIdx);
    expect(resultadosIdx).toBeGreaterThan(metodologiaIdx);
    expect(conclusaoIdx).toBeGreaterThan(resultadosIdx);
    expect(referenciasIdx).toBeGreaterThan(conclusaoIdx);
  });

  it("nao ha legenda de quadro/grafico apos Organizacao do trabalho", () => {
    const result = detectAcademicFieldsFromText(textoCompleto);
    const organizacaoIdx = result.editorText.indexOf("1.4 Organizacao do trabalho");
    const quadroIdx = result.editorText.indexOf("Quadro 1");

    if (organizacaoIdx >= 0 && quadroIdx >= 0) {
      expect(quadroIdx).toBeLessThan(organizacaoIdx);
    }
  });
});
