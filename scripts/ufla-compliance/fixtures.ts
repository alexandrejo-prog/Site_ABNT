import { emptyAcademicFields, type AcademicFields } from "../../src/ufla-rules";
import type { ImportedDocumentImage } from "../../src/imported-images";
import type { ImportedTable } from "../../src/imported-tables";

export interface UflaFixture {
  name: string;
  workType: string;
  fields: AcademicFields;
  editorText: string;
  importedImages?: ImportedDocumentImage[];
  importedTables?: ImportedTable[];
}

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";

export function colorFor(severity: string, message: string): string {
  if (severity === "error") return `${RED}${message}${RESET}`;
  if (severity === "warning") return `${YELLOW}${message}${RESET}`;
  return `${GREEN}${message}${RESET}`;
}

// ---------------------------------------------------------------------------
// Fixture canônica de MONOGRAFIA (usada no teste E2E de aceitação).
// Dados reais completos: autor, título, curso, resumo, abstract, palavras-chave,
// citações, referências, apêndice, anexo, tabela e imagem importada.
// ---------------------------------------------------------------------------
export function monografiaFixture(): UflaFixture {
  const fields = emptyAcademicFields();
  fields.workType = "monografia";
  fields.author = "Ana Beatriz Ferreira de Souza";
  fields.title = "Indicadores de qualidade para repositórios institucionais universitários";
  fields.subtitle = "Um estudo de caso na Universidade Federal de Lavras";
  fields.course = "Biblioteconomia";
  fields.advisor = "Prof. Dr. Ricardo Antônio de Lima";
  fields.location = "Lavras - MG";
  fields.year = "2026";
  fields.resumo =
    "O crescimento acelerado da produção científica digital impõe às universidades a necessidade de organizar, preservar e dar visibilidade aos resultados de pesquisa por intermédio de repositórios institucionais. Este trabalho teve como objetivo analisar indicadores de qualidade aplicáveis a repositórios universitários brasileiros, tomando como unidade de análise o repositório da Universidade Federal de Lavras. O percurso metodológico adotou abordagem qualitativa, com estudo de caso, coleta de dados mediante observação direta e entrevistas semiestruturadas com gestores da biblioteca, além de revisão de literatura sobre curadoria digital e preservação. Os resultados indicaram que os principais desafios envolvem padronização de metadados, políticas de depósito e adoção de boas práticas de preservação digital. A conclusão aponta a necessidade de aperfeiçoar mecanismos de avaliação contínua de qualidade e de ampliar a participação da comunidade acadêmica no depósito de documentos. Palavras-chave: Repositórios institucionais. Qualidade. Preservação digital. Biblioteca universitária.";
  fields.palavrasChave = "Repositórios institucionais; Qualidade; Preservação digital; Biblioteca universitária";
  fields.abstractText =
    "The rapid growth of digital scholarly output makes it necessary for universities to organize, preserve and give visibility to research results through institutional repositories. This study aimed to analyze quality indicators applicable to Brazilian university repositories, taking the repository of the Federal University of Lavras as its unit of analysis. The methodological path adopted a qualitative approach, with a case study, data collection through direct observation and semi-structured interviews with library managers, as well as a literature review on digital curation and preservation. The results indicated that the main challenges involve metadata standardization, deposit policies and the adoption of good digital preservation practices. The conclusion points out the need to improve continuous quality assessment mechanisms and to expand the participation of the academic community in document deposit. Keywords: Institutional repositories. Quality. Digital preservation. University library.";
  fields.keywords = "Institutional repositories; Quality; Digital preservation; University library";
  fields.introducao = "texto da introdução fornecido pelo editor";
  fields.conclusao = "texto da conclusão fornecido pelo editor";
  fields.referencias = [
    "BORGES, Maristela. Curadoria digital e repositórios universitários. Belo Horizonte: Editora UFMG, 2021. 176 p.",
    "INSTITUTO BRASILEIRO DE INFORMAÇÃO EM CIÊNCIA E TECNOLOGIA. Diretrizes para políticas de repositórios institucionais. Brasília, DF: IBICT, 2018. Disponível em: https://www.ibict.br/diretrizes-repositorios. Acesso em: 10 jan. 2026.",
    "LYNCH, Clifford A. Institutional repositories: essential infrastructure for scholarship in the digital age. Portal: Libraries and the Academy, Baltimore, v. 3, n. 2, p. 327-336, 2003.",
    "SANTOS, Paula; MOURA, Clara. Avaliação de repositórios digitais. In: CONGRESSO BRASILEIRO DE BIBLIOTECONOMIA, 28., 2020, Curitiba. Anais [...]. Curitiba: FEBAB, 2020. p. 41-58.",
    "UNIVERSIDADE FEDERAL DE LAVRAS. Manual de normalização e estrutura de trabalhos acadêmicos: TCCs, monografias, dissertações e teses. 6. ed. rev., atual. e ampl. Lavras: UFLA, 2025.",
  ].join("\n");
  fields.apendices = "APÊNDICE A - Roteiro de entrevista semiestruturada\n\n1. Há quanto tempo o repositório está em operação?\n2. Quais indicadores de qualidade são acompanhados periodicamente?";
  fields.anexos = "ANEXO A - Termo de Consentimento Livre e Esclarecido\n\nModelo oficial da Pró-Reitoria de Pesquisa da UFLA.";
  fields.listaTabelas = "Tabela 1 - Indicadores avaliados";

  const editorText = [
    "# 1 INTRODUÇÃO",
    "Os repositórios institucionais configuram-se como infraestrutura essencial para a comunicação científica na era digital, conforme argumenta Lynch (LYNCH, 2003, p. 328). A qualidade desses ambientes depende de políticas claras de depósito e de curadoria contínua dos metadados.",
    "",
    "Conforme o Manual de normalização da UFLA (UNIVERSIDADE FEDERAL DE LAVRAS, 2025, p. 15), a avaliação de repositórios deve considerar indicadores de acessibilidade, preservação e interoperabilidade.",
    "",
    "> Citação longa deve ser apresentada com recuo de quatro centímetros da margem esquerda, fonte tamanho onze e espaçamento simples, sem aspas, conforme estabelecido no manual de normalização adotado pela instituição para a elaboração de trabalhos acadêmicos.",
    "",
    "## 1.1 Problematização",
    "A literatura aponta que a ausência de indicadores objetivos dificulta a avaliação contínua da qualidade dos repositórios (BORGES, 2021, p. 45).",
    "",
    "## 1.2 Justificativa",
    "A justificativa desta pesquisa fundamenta-se na necessidade de aperfeiçoar mecanismos de avaliação institucional.",
    "",
    "# 2 REFERENCIAL TEÓRICO",
    "## 2.1 Repositórios institucionais",
    "## 2.2 Indicadores de qualidade",
    "[[Tabela importada preservada: tabela-qualidade]]",
    "Fonte: Elaborado pela autora (2026).",
    "",
    "# 3 METODOLOGIA",
    "Foram realizadas visitas técnicas e entrevistas semiestruturadas com a equipe da biblioteca.",
    "[[Imagem importada preservada: img-repositorio]]",
    "Fonte: Acervo institucional (2025).",
    "",
    "# 4 RESULTADOS",
    "Os resultados consolidados apontam avanços na padronização de metadados e desafios na política de depósito.",
    "",
    "# 5 CONSIDERAÇÕES FINAIS",
    "Conclui-se que a avaliação contínua de qualidade é essencial para a consolidação dos repositórios institucionais universitários.",
  ].join("\n");

  const importedTables: ImportedTable[] = [
    {
      id: "tabela-qualidade",
      caption: "Tabela 1 - Indicadores de qualidade avaliados",
      source: "Fonte: Elaborado pela autora (2026).",
      rowCount: 3,
      columnCount: 3,
      rows: [
        [{ text: "Indicador" }, { text: "Critério" }, { text: "Situação" }],
        [{ text: "Metadados" }, { text: "Padronização" }, { text: "Parcial" }],
        [{ text: "Preservação" }, { text: "Plano de ação" }, { text: "Iniciada" }],
      ],
      hasGridSpan: false,
      hasVerticalMerge: false,
      status: "preserved",
      position: 1,
      origin: "docx-table",
    },
  ];

  const importedImages: ImportedDocumentImage[] = [
    {
      id: "img-repositorio",
      width: 500,
      height: 300,
      position: 0,
      status: "preserved",
      data: new Uint8Array(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64",
        ),
      ),
    },
  ];

  return { name: "monografia", workType: "monografia", fields, editorText, importedTables, importedImages };
}

// ---------------------------------------------------------------------------
// Fixture canônica de DISSERTAÇÃO (usada pelo gate de conformidade para
// comparação com o documento de referência TEMPLATE_Manual - Formato padrão).
// ---------------------------------------------------------------------------
export function dissertacaoFixture(): UflaFixture {
  const fields = emptyAcademicFields();
  fields.workType = "dissertacao";
  fields.author = "Maria Silva";
  fields.title = "Educação ambiental e participação social na gestão de recursos hídricos";
  fields.subtitle = "Um estudo na bacia hidrográfica do Ribeirão Vermelho";
  fields.program = "Programa de Pós-Graduação em Educação Científica e Ambiental";
  fields.advisor = "Prof. Dr. João Santos";
  fields.coadvisor = "Profa. Dra. Fernanda Rocha";
  fields.areaConcentracao = "Educação Ambiental";
  fields.location = "Lavras - MG";
  fields.year = "2026";
  fields.resumo =
    "A gestão participativa dos recursos hídricos requer a formação crítica de sujeitos capazes de atuar em comitês de bacia e em espaços públicos de deliberação. Esta dissertação investigou como a educação ambiental contribui para a participação social na gestão da bacia hidrográfica do Ribeirão Vermelho, em Minas Gerais. O estudo de caso qualitativo combinou observação participante, análise documental e entrevistas semiestruturadas com membros do comitê local. Os resultados evidenciaram que processos educativos não formais fortalecem a compreensão sobre instrumentos de gestão e ampliam a presença de representantes da sociedade civil. Conclui-se que a educação ambiental crítica, orientada pela transversalidade e pela construção coletiva do conhecimento, potencializa a participação e a corresponsabilidade na decisão sobre o uso da água. Palavras-chave: Educação ambiental. Gestão de recursos hídricos. Participação social.";
  fields.palavrasChave = "Educação ambiental; Gestão de recursos hídricos; Participação social";
  fields.abstractText =
    "The participatory management of water resources requires the critical formation of subjects capable of acting in watershed committees and in public decision-making spaces. This dissertation investigated how environmental education contributes to social participation in the management of the Ribeirão Vermelho watershed, in Minas Gerais, Brazil. The qualitative case study combined participant observation, document analysis and semi-structured interviews with members of the local committee. The results showed that non-formal educational processes strengthen understanding of management instruments and expand the presence of civil society representatives. It is concluded that critical environmental education, guided by transversality and the collective construction of knowledge, enhances participation and co-responsibility in decisions about the use of water. Keywords: Environmental education. Water resources management. Social participation.";
  fields.keywords = "Environmental education; Water resources management; Social participation";
  fields.indicadoresImpacto =
    "Impacto social: formação de lideranças locais para atuação em comitês de bacia.\nImpacto científico: contribuição metodológica para a avaliação de processos educativos não formais.\nImpacto educacional: material de apoio para professores da educação básica.\nPúblico beneficiado: comunidades rurais e membros do Comitê de Bacia Hidrográfica.";
  fields.impactIndicators =
    "Social impact: training of local leaders for performance in watershed committees.\nScientific impact: methodological contribution for the evaluation of non-formal educational processes.\nEducational impact: support material for basic education teachers.\nBenefited public: rural communities and members of the Watershed Committee.";
  fields.referencias = [
    "FREIRE, Paulo. Pedagogia da autonomia: saberes necessários à prática educativa. 43. ed. Rio de Janeiro: Paz e Terra, 2011. 144 p.",
    "JACOBI, Pedro Roberto. Educação ambiental, cidadania e sustentabilidade. Cadernos de Pesquisa, São Paulo, n. 118, p. 189-205, 2013.",
    "LEFF, Enrique. Saber ambiental: sustentabilidade, racionalidade, complexidade, poder. 11. ed. Petrópolis: Vozes, 2010. 478 p.",
    "MORIN, Edgar. Os sete saberes necessários à educação do futuro. 3. ed. São Paulo: Cortez; Brasília, DF: UNESCO, 2011.",
    "UNIVERSIDADE FEDERAL DE LAVRAS. Manual de normalização e estrutura de trabalhos acadêmicos: TCCs, monografias, dissertações e teses. 6. ed. rev., atual. e ampl. Lavras: UFLA, 2025.",
  ].join("\n");
  fields.apendices = "APÊNDICE A - Roteiro de entrevista com membros do comitê\n\nTexto do apêndice A.";
  fields.anexos = "ANEXO A - Ofício de autorização da Agência Nacional de Águas\n\nTexto do anexo A.";

  const editorText = [
    "# 1 INTRODUÇÃO",
    "A gestão dos recursos hídricos no Brasil, instituída pela Política Nacional de Recursos Hídricos, estabelece a participação social como princípio fundamental (BRASIL, 1997, p. 3).",
    "",
    "> Citação longa deve ser apresentada com recuo de quatro centímetros, fonte onze e espaçamento simples, sem aspas, conforme o manual de normalização adotado pela universidade para trabalhos acadêmicos.",
    "",
    "## 1.1 Problema de pesquisa",
    "## 1.2 Objetivos",
    "## 1.3 Justificativa",
    "",
    "# 2 REFERENCIAL TEÓRICO",
    "## 2.1 Educação ambiental crítica",
    "## 2.2 Participação social em comitês de bacia",
    "",
    "# 3 METODOLOGIA",
    "## 3.1 Tipo de pesquisa",
    "## 3.2 Instrumentos de coleta",
    "[[Tabela importada preservada: tabela-etapas]]",
    "Fonte: Elaborado pela autora (2026).",
    "",
    "# 4 RESULTADOS E DISCUSSÃO",
    "## 4.1 Processos educativos identificados",
    "## 4.2 Indicadores de participação",
    "",
    "# 5 CONCLUSÃO",
    "A educação ambiental crítica, ancorada na transversalidade, fortalece a participação social na gestão da água.",
  ].join("\n");

  const importedTables: ImportedTable[] = [
    {
      id: "tabela-etapas",
      caption: "Tabela 1 - Etapas metodológicas da pesquisa",
      source: "Fonte: Elaborado pela autora (2026).",
      rowCount: 3,
      columnCount: 3,
      rows: [
        [{ text: "Etapa" }, { text: "Período" }, { text: "Instrumento" }],
        [{ text: "Diagnóstico" }, { text: "Mar-jun" }, { text: "Análise documental" }],
        [{ text: "Campo" }, { text: "Jul-ago" }, { text: "Entrevistas" }],
      ],
      hasGridSpan: false,
      hasVerticalMerge: false,
      status: "preserved",
      position: 1,
      origin: "docx-table",
    },
  ];

  return { name: "dissertacao", workType: "dissertacao", fields, editorText, importedTables };
}

export function fixtureByName(name: string): UflaFixture {
  if (name === "monografia" || name === "monografia-full" || name === "monografia-completa") return monografiaFixture();
  if (name === "dissertacao") return dissertacaoFixture();
  throw new Error(`Fixture desconhecida: ${name}`);
}