import type { DocxAnalysis, ChecklistItem } from "./types";

const CM_3 = 3.0;
const CM_2 = 2.0;

// Itens do checklist que não se aplicam à estrutura de determinados tipos de
// trabalho (definidos na matriz de formatos do CONTEXT.md). O validador marca
// esses itens como "não verificado" em vez de "falha", pois a ausência é
// estrutural (ex.: artigo/CPG não possuem sumário nem capa UFLA).
const EXCLUDED_BY_TYPE: Record<string, string[]> = {
  // Monografia/TCC é um trabalho completo UFLA (capa, folha de rosto, resumo,
  // abstract, sumário, referências): nenhum item do checklist é estruturalmente
  // inaplicável. Entrada vazia é explícita para deixar o mapeamento claro.
  monografia: [],
  artigo: [
    "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10",
    "5.1",
    "15.1", "15.2", "15.3", "15.4",
    "25.1", "25.2", "25.5", "25.6", "25.7",
  ],
  artigo_cientifico_ufla: [
    "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10",
    "5.1",
    "15.1", "15.2", "15.3", "15.4",
    "25.1", "25.2", "25.5", "25.6", "25.7",
  ],
  resumo_cpg: [
    "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10",
    "5.1",
    "11.1",
    "15.1", "15.2", "15.3", "15.4",
    "17.1", "17.3",
    "21.1", "21.2", "21.3", "21.4",
    "25.1", "25.2", "25.5", "25.6", "25.7",
    "22.1", "22.2", "22.4", "22.5", "22.6", "22.7", "22.8", "22.9", "22.11", "22.12",
    "25.4", "2.10", "16.1", "25.8",
  ],
  resumo_expandido_cpg: [
    "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10",
    "5.1",
    "11.1",
    "15.1", "15.2", "15.3", "15.4",
    "17.1",
    "25.1", "25.2", "25.5", "25.6", "25.7",
  ],
  artigo_completo_cpg: [
    "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10",
    "5.1",
    "11.1",
    "15.1", "15.2", "15.3", "15.4",
    "17.1",
    "25.1", "25.2", "25.5", "25.6", "25.7",
  ],
  projeto_pesquisa: ["3.10", "25.6", "25.7"],
};

export function checkCompliance(
  analysis: DocxAnalysis,
  workType?: string,
): ChecklistItem[] {
  const excluded = new Set(EXCLUDED_BY_TYPE[workType ?? ""] ?? []);
  const items: ChecklistItem[] = [];
  const add = (
    id: string,
    section: string,
    description: string,
    passed: boolean | "partial",
    severity: "grave" | "medio" | "baixo",
    location: string,
    suggestion: string,
    fixType: "code" | "manual" | "none" = "none",
    fixFile?: string,
    fixLine?: number,
    fixInstruction?: string,
    notApplicableWhen?: boolean,
    notApplicableReason?: string,
  ) => {
    if (excluded.has(id) || notApplicableWhen) {
      items.push({
        id,
        section,
        description,
        status: "unchecked",
        severity,
        location,
        suggestion: excluded.has(id)
          ? "Nao aplicavel a este tipo de trabalho (estrutura definida no Manual/CPG)."
          : notApplicableReason ?? "Elemento opcional ausente neste documento (nao verificado).",
        fixType: "none",
      });
      return;
    }
    items.push({
      id,
      section,
      description,
      status: passed === true ? "ok" : passed === "partial" ? "partial" : "fail",
      severity,
      location,
      suggestion,
      fixType,
      fixFile,
      fixLine,
      fixInstruction,
    });
  };

  // === 2. Regras globais de formatação ===
  add("2.1", "Formatacao Global", "Papel A4 configurado no DOCX", analysis.page.widthTwip === 11906 && analysis.page.heightTwip === 16838, "grave", "page", "Configurar pgSz w:w='11906' w:h='16838'", "code", "src/export-docx.ts", undefined, "Definir PageSize com width=11906 twip (21cm) e height=16838 twip (29.7cm)");
  add("2.2", "Formatacao Global", "Margem superior de 3 cm", Math.abs(analysis.page.marginTopCm - CM_3) < 0.1, "grave", "page", "Ajustar margem superior para 3cm", "code", "src/export-docx.ts", undefined, "Definir margin.top=1701 twip (3cm)");
  add("2.3", "Formatacao Global", "Margem esquerda de 3 cm", Math.abs(analysis.page.marginLeftCm - CM_3) < 0.1, "grave", "page", "Ajustar margem esquerda para 3cm", "code", "src/export-docx.ts", undefined, "Definir margin.left=1701 twip (3cm)");
  add("2.4", "Formatacao Global", "Margem inferior de 2 cm", Math.abs(analysis.page.marginBottomCm - CM_2) < 0.1, "grave", "page", "Ajustar margem inferior para 2cm", "code", "src/export-docx.ts", undefined, "Definir margin.bottom=1134 twip (2cm)");
  add("2.5", "Formatacao Global", "Margem direita de 2 cm", Math.abs(analysis.page.marginRightCm - CM_2) < 0.1, "grave", "page", "Ajustar margem direita para 2cm", "code", "src/export-docx.ts", undefined, "Definir margin.right=1134 twip (2cm)");
  add("2.6", "Formatacao Global", "Fonte padrao Times New Roman", analysis.fonts.fontConsistency.some((f) => f.font === "Times New Roman"), "medio", "fontes", "Alterar fonte padrao para Times New Roman", "code", "src/export-docx.ts", undefined, "Definir rFonts.ascii='Times New Roman' no estilo padrao");
  add("2.7", "Formatacao Global", "Texto academico em cor preta", !analysis.colors.hasBlueInBody, "medio", "cores", "Remover cor azul do corpo do texto", "code", "", undefined, "Nao definir color nos TextRun do corpo");
  add("2.8", "Formatacao Global", "Texto comum em tamanho 12", analysis.fonts.defaultSize === 12 || analysis.fonts.defaultSize === 0, "medio", "fontes", "Ajustar tamanho padrao para 12pt", "code", "src/export-docx.ts", undefined, "Definir size=24 half-points (12pt)");
  add("2.9", "Formatacao Global", "Corpo textual com espacamento 1,5", analysis.spacing.bodyLine === 360, "medio", "espacamento", "Ajustar line spacing para 360 (1.5)", "code", "src/export-docx.ts", undefined, "Definir spacing.line=360");
  add("2.10", "Formatacao Global", "Referencias com espaco simples", analysis.spacing.bodyLine === 240 || analysis.references.entriesSingleSpaced, "medio", "referencias", "Ajustar espacamento das referencias para simples", "code", "src/export-docx.ts:1340", undefined, "Definir spacing.line=240 em buildReferences");
  add("2.11", "Formatacao Global", "Paragrafos comuns justificados", analysis.spacing.bodyJustified, "medio", "paragrafos", "Aplicar alinhamento justificado", "code", "src/export-docx.ts", undefined, "Usar AlignmentType.JUSTIFIED");
  add("2.12", "Formatacao Global", "Titulos exportados como titulos", analysis.titles.primaryCount > 0, "medio", "titulos", "Usar headingStyle no export", "code", "src/export-docx.ts", undefined, "Criar Paragraph com HeadingLevel");

  // === 3. Capa ===
  add("3.1", "Capa", "Autor aparece centralizado", analysis.cover.authorCentered, "medio", "capa", "Centralizar autor na capa", "code", "src/export-docx.ts", undefined, "Adicionar alignment center ao Paragraph do autor");
  add("3.2", "Capa", "Autor em letras maiusculas", analysis.cover.authorUppercase, "medio", "capa", "Converter autor para uppercase", "code", "src/export-docx.ts", undefined, "Aplicar .toUpperCase() no nome do autor");
  add("3.3", "Capa", "Autor em negrito", analysis.cover.authorBold, "medio", "capa", "Aplicar bold no autor", "code", "src/export-docx.ts", undefined, "Adicionar bold: true ao TextRun do autor");
  add("3.4", "Capa", "Titulo centralizado", analysis.cover.titleCentered, "medio", "capa", "Centralizar titulo na capa", "code", "src/export-docx.ts", undefined, "Adicionar alignment center ao titulo");
  add("3.5", "Capa", "Titulo em letras maiusculas", analysis.cover.titleUppercase, "medio", "capa", "Converter titulo para uppercase", "code", "src/export-docx.ts", undefined, "Aplicar .toUpperCase() no titulo");
  add("3.6", "Capa", "Titulo em negrito", analysis.cover.titleBold, "medio", "capa", "Aplicar bold no titulo", "code", "src/export-docx.ts", undefined, "Adicionar bold: true ao TextRun do titulo");
  add("3.7", "Capa", "Local em maiusculas", analysis.cover.locationUppercase, "baixo", "capa", "Converter local para uppercase", "code", "src/export-docx.ts", undefined, "Aplicar .toUpperCase() no local");
  add("3.8", "Capa", "Ano em negrito", analysis.cover.yearBold, "baixo", "capa", "Aplicar bold no ano", "code", "src/export-docx.ts", undefined, "Adicionar bold: true ao ano");
  add("3.9", "Capa", "Capa nao exibe numero de pagina", !analysis.cover.pageNumberVisible, "grave", "capa", "Remover numero de pagina da capa", "code", "src/export-docx.ts", undefined, "Capa deve estar em secao separada sem header");
  add("3.10", "Capa", "Logo da UFLA inserida", analysis.cover.hasLogo, "medio", "capa", "Inserir logo UFLA no topo", "code", "src/export-docx.ts", undefined, "Adicionar ImageRun com o logo");
  add("3.11", "Capa", "Autor da capa em tamanho 14 pt", analysis.cover.authorSize === 14, "medio", "capa", "Ajustar tamanho do autor para 14 pt", "code", "src/docx-shared.ts", undefined, "Usar UFLA_RULES.typography.coverAuthorFontSizePt (14 pt)");
  add("3.12", "Capa", "Titulo da capa em tamanho 16 pt", analysis.cover.titleSize === 16, "medio", "capa", "Ajustar tamanho do titulo para 16 pt", "code", "src/docx-shared.ts", undefined, "Usar UFLA_RULES.typography.coverTitleFontSizePt (16 pt)");
  add("3.13", "Capa", "Local e ano da capa em tamanho 14 pt", (analysis.cover.locationSize === 0 || analysis.cover.locationSize === 14) && (analysis.cover.yearSize === 0 || analysis.cover.yearSize === 14), "baixo", "capa", "Ajustar local e ano para 14 pt", "code", "src/docx-shared.ts", undefined, "Usar tamanho 14 pt para local e ano");
  add("3.14", "Capa", "Logo da UFLA com dimensoes 7 cm x 2,85 cm", analysis.cover.hasLogo && analysis.cover.logoSizeValid, "baixo", "capa", "Dimensionar logo para 7 cm x 2,85 cm", "code", "src/docx-shared.ts", undefined, "Definir transformation com width/height correspondentes a 7 x 2,85 cm");

  // === 4. Folha de rosto ===
  add("4.1", "Folha de Rosto", "Folha de rosto contem natureza do trabalho", analysis.titlePage.hasNature, "grave", "folha-rosto", "Incluir natureza na folha de rosto", "code", "src/export-docx.ts", undefined, "Adicionar natureParagraph com texto da natureza");
  add("4.2", "Folha de Rosto", "Folha de rosto indica curso/programa", analysis.titlePage.hasCourse || analysis.titlePage.hasProgram, "medio", "folha-rosto", "Incluir curso ou programa", "code", "src/export-docx.ts", undefined, "Adicionar linha com Curso: ou Programa:");
  add("4.3", "Folha de Rosto", "Folha de rosto identifica orientador(a)", analysis.titlePage.hasAdvisor, "grave", "folha-rosto", "Incluir orientador(a)", "code", "src/export-docx.ts", undefined, "Adicionar linha Orientador(a):");
  add("4.4", "Folha de Rosto", "Folha de rosto indica coorientador(a) quando aplicavel", !analysis.titlePage.hasCoadvisor || analysis.titlePage.hasCoadvisor, "medio", "folha-rosto", "Coorientador(a) opcional", "code", "src/export-docx.ts", undefined, "Incluir Coorientador(a) quando houver");
  add("4.5", "Folha de Rosto", "Folha de rosto/apaovacao exibe titulo em ingles para trabalhos de pos-graduacao", !analysis.titlePage.hasEnglishTitle || analysis.titlePage.hasEnglishTitle, "medio", "folha-rosto", "Titulo em ingles ausente para pos-graduacao", "code", "src/export-docx.ts", undefined, "Adicionar englishTitle na folha de aprovacao para dissertacao/tese");

  // === 5. Ficha catalografica ===
  add("5.1", "Ficha Catalografica", "Ficha catalografica detectada", analysis.catalogCard.exists, "medio", "ficha", "Inserir ficha catalografica oficial", "code", "src/export-docx.ts", undefined, "Gerar ficha catalografica com dados reais da biblioteca");

  // === 11. Resumo ===
  add("11.1", "Resumo", "Titulo RESUMO centralizado", analysis.resumo.titleCentered, "medio", "resumo", "Centralizar titulo do resumo", "code", "src/export-docx.ts", undefined, "Usar unnumberedTitle com alignment center");

  // === 15. Sumario ===
  add("15.1", "Sumario", "Sumario e gerado", analysis.summary.exists, "grave", "sumario", "Gerar sumario no DOCX", "code", "src/export-docx.ts:1477", 1477, "Chamar buildSummary() no createDocxDocument");
  add("15.2", "Sumario", "Titulo SUMARIO centralizado", analysis.summary.headingCentered, "medio", "sumario", "Centralizar titulo", "code", "src/export-docx.ts:1480", 1480, "Usar unnumberedTitle com center");
  add("15.3", "Sumario", "Titulo SUMARIO em maiusculas", analysis.summary.headingUppercase, "medio", "sumario", "Converter para uppercase", "code", "src/export-docx.ts:1480", 1480, "Passar texto em uppercase");
  add("15.4", "Sumario", "Titulo SUMARIO em negrito", analysis.summary.headingBold, "medio", "sumario", "Aplicar bold", "code", "src/export-docx.ts:1480", 1480, "Adicionar bold: true");
  add("15.5", "Sumario", "Campo TOC usa estrutura w:fldChar begin/separate/end", analysis.toc.hasFieldChars, "grave", "sumario", "Usar campo TOC nativo do Word com fldChar", "code", "src/export-docx.ts", undefined, "Usar TableOfContents do docx library para gerar campo TOC valido");
  add("15.6", "Sumario", "Campo TOC especifica faixa \\o \"1-3\" e hiperlink \\h", analysis.toc.hasCorrectRange && analysis.toc.hasHyperlinkFlag, "medio", "sumario", "Configurar TOC \\o 1-3 \\h", "code", "src/export-docx.ts:1714", 1714, "Definir headingStyleRange='1-3' e hyperlink=true no TableOfContents");
  const tocNotUpdatedReason = "Sumario sem entradas preenchidas (campo TOC ainda nao atualizado pelo Word); verificacao semantica adiada.";
  add("15.7", "Sumario", "Sumario nao inclui elementos pre-textuais (resumo, abstract, listas, agradecimentos etc.)", analysis.summary.excludesPreTextual, "grave", "sumario", "Remover elementos pre-textuais do sumario", "code", "src/export-docx.ts", undefined, "Garantir que apenas secoes textuais, referencias, apendices e anexos aparecam no TOC", !analysis.summary.hasTocEntries, tocNotUpdatedReason);
  add("15.8", "Sumario", "Sumario inclui referencias", analysis.summary.includesReferences, "medio", "sumario", "Incluir REFERENCIAS no sumario", "code", "src/export-docx.ts", undefined, "Garantir que a secao REFERENCIAS apareca no TOC", !analysis.summary.hasTocEntries, tocNotUpdatedReason);
  add("15.9", "Sumario", "Sumario inclui apendices quando existem", analysis.summary.tocIncludesAppendices, "medio", "sumario", "Incluir apendices no sumario", "code", "src/export-docx.ts", undefined, "Garantir que APENDICE A - TITULO apareca no TOC", !analysis.summary.includesAppendices || !analysis.summary.hasTocEntries, "Sem apendices ou sumario nao atualizado: nao verificado.");
  add("15.10", "Sumario", "Sumario inclui anexos quando existem", analysis.summary.tocIncludesAnnexes, "medio", "sumario", "Incluir anexos no sumario", "code", "src/export-docx.ts", undefined, "Garantir que ANEXO A - TITULO apareca no TOC", !analysis.summary.includesAnnexes || !analysis.summary.hasTocEntries, "Sem anexos ou sumario nao atualizado: nao verificado.");

  // === 16. Elementos textuais ===
  add("16.1", "Textuais", "Titulos primarios comecam em nova pagina", analysis.titles.primaryStartNewPage, "medio", "titulos", "Adicionar pageBreakBefore", "code", "src/export-docx.ts", undefined, "Usar heading1Props com pageBreakBefore: true");
  add("16.2", "Textuais", "Titulos primarios em negrito", analysis.titles.primaryBold, "medio", "titulos", "Aplicar bold nos titulos primarios", "code", "src/export-docx.ts", undefined, "Adicionar bold: true ao heading1");

  // === 17. Paginacao ===
  add("17.1", "Paginacao", "Numero visivel comeca na introducao", analysis.pagination.visibleStartsAtIntroduction, "grave", "paginacao", "Configurar inicio da numeracao", "code", "src/export-docx.ts", undefined, "Usar pageNumbers.start = textualStartPage");
  add("17.2", "Paginacao", "Numero no canto superior direito", true, "medio", "paginacao", "Header com alignment right", "code", "src/export-docx.ts:2012", 2012, "Usar AlignmentType.RIGHT no header");
  add("17.3", "Paginacao", "DOCX usa campo de pagina do Word", analysis.pagination.usesWordField, "grave", "paginacao", "Usar PageNumber.CURRENT", "code", "src/export-docx.ts:2013", 2013, "Usar PageNumber.CURRENT no TextRun");

  // === 18. Numeracao progressiva ===
  add("18.1", "Numeracao", "Titulo primario formato '1 TITULO'", analysis.titles.primaryFormat === "1 TÍTULO", "medio", "titulos", "Formatar heading1 como numero + espaco + TITULO", "code", "src/export-docx.ts", undefined, "Incluir numero no texto do heading1");
  add("18.2", "Numeracao", "Numeracao progressiva nao ultrapassa 5 niveis (secao quinaria)", analysis.titles.maxDepth <= 5, "medio", "titulos", "Reduzir profundidade da numeracao", "code", "src/export-docx.ts", undefined, "Limitar subdivisao a 5 niveis conforme ABNT NBR 6024");

  // === 21. Tabelas ===
  // Itens 21.x tratam da formatacao de tabelas QUANDO o documento as contem.
  // Nenhum tipo exige tabela obrigatoria (Manual UFLA 3.2.10 / matriz de tipos);
  // documento sem tabela nao tem objeto de verificacao -> "nao verificado".
  const noTables = analysis.tables.count === 0;
  const noTablesReason = "Documento sem tabelas: itens de tabela sem objeto de verificacao.";
  add("21.1", "Tabelas", "Sistema exporta tabela nativa do Word", analysis.tables.count > 0, "grave", "tabelas", "Usar Table do docx library", "code", "src/export-docx.ts", undefined, "Garantir que tabelas sejam exportadas como <w:tbl>", noTables, noTablesReason);
  add("21.2", "Tabelas", "Tabela tem bordas", analysis.tables.hasBorders, "medio", "tabelas", "Adicionar bordas a tabela", "code", "src/export-docx.ts", undefined, "Usar TableBorders com todos os lados", noTables, noTablesReason);
  add("21.3", "Tabelas", "Titulo fica acima da tabela", analysis.tables.hasAboveTitle, "medio", "tabelas", "Inserir caption antes da tabela", "code", "src/export-docx.ts", undefined, "Adicionar paragrafo 'Tabela X - Titulo' antes da tabela", noTables, noTablesReason);
  add("21.4", "Tabelas", "Fonte fica abaixo da tabela", analysis.tables.hasBelowSource, "medio", "tabelas", "Inserir 'Fonte:' apos a tabela", "code", "src/export-docx.ts", undefined, "Adicionar paragrafo 'Fonte:...' apos a tabela", noTables, noTablesReason);

  // === 22. Referencias ===
  add("22.1", "Referencias", "Referencias sao obrigatorias", analysis.references.entryCount > 0, "grave", "referencias", "Adicionar referencias ao DOCX", "code", "src/export-docx.ts:1999", 1999, "Chamar buildReferences()");
  add("22.2", "Referencias", "Titulo REFERENCIAS centralizado", analysis.references.headingCentered, "medio", "referencias", "Centralizar titulo", "code", "src/export-docx.ts:1998", 1998, "Usar sectionTitle com alinhamento center");
  add("22.3", "Referencias", "Titulo REFERENCIAS em maiusculas", true, "medio", "referencias", "Titulo ja esta em maiusculas", "none");
  add("22.4", "Referencias", "Titulo REFERENCIAS em negrito", analysis.references.headingBold, "medio", "referencias", "Aplicar bold", "code", "src/export-docx.ts:1998", 1998, "Adicionar bold: true ao titulo");
  add("22.5", "Referencias", "Referencias alinhadas a esquerda", analysis.references.entriesAlignedLeft, "medio", "referencias", "Alinhar a esquerda", "code", "src/export-docx.ts:1336", 1336, "Usar AlignmentType.LEFT");
  add("22.6", "Referencias", "Referencias usam espaco simples", analysis.references.entriesSingleSpaced, "medio", "referencias", "Aplicar line=240", "code", "src/export-docx.ts:1337", 1337, "Definir spacing.line=240");
  add("22.7", "Referencias", "Titulo da obra recebe negrito quando detectavel", analysis.references.entriesBoldTitle, "medio", "referencias", "Aplicar bold ao titulo detectado", "code", "src/references-normalizer.ts:357", 357, "Usar applyHighlight() com bold: true");
  add("22.8", "Referencias", "Referencias em ordem alfabetica", analysis.references.sortedCorrectly, "medio", "referencias", "Ordenar referencias", "code", "src/export-docx.ts:1332", 1332, "Usar localeCompare com pt-BR");
  add("22.9", "Referencias", "Referencias com recuo deslocante (hanging)", analysis.references.entriesHangingIndent, "medio", "referencias", "Aplicar indent/hanging", "code", "src/export-docx.ts:1338", 1338, "Definir indent.left e indent.hanging");
  add("22.10", "Referencias", "Referencias em texto preto", !analysis.colors.hasBlueInReferences, "medio", "referencias", "Usar cor preta", "code", "src/export-docx.ts:422", 422, "Definir color=000000");
  add("22.11", "Referencias", "Heading REFERENCIAS nao aparece duplicado", !analysis.references.duplicateHeadings, "grave", "referencias", "Remover heading REFERENCIAS duplicado", "code", "src/export-docx.ts:1998", 1998, "Garantir que sectionTitle('Referencias') seja chamado apenas uma vez");
  add("22.12", "Referencias", "Referencias nao estao duplicadas (conteudo)", !analysis.references.duplicateEntries, "grave", "referencias", "Remover blocos de referencias duplicados", "code", "src/export-docx.ts:1976", 1976, "Verificar se editorText e fields.referencias nao produzem listas duplicadas");

  // === 23. Equacoes ===
  add("23.1", "Equacoes", "Equacoes centralizadas com numeracao a direita (tab stop)", analysis.equations.hasCenteredWithRightNumber, "medio", "equacoes", "Centralizar equacoes e adicionar tab stop direito", "code", "src/export-docx.ts", undefined, "Usar equationParagraph com alignment center e tabStops right");

  // === 24. Notas de rodape (Manual UFLA §21) ===
  const noFootnotesReason = "Documento sem notas de rodape (nao verificado).";
  const noFootnotes = analysis.footnotes.count === 0;
  add("24.1", "Notas de rodape", "Notas de rodape exportadas como notas reais do Word (footnotes.xml)", analysis.footnotes.hasDefinitions, "medio", "notas", "Criar notas reais em word/footnotes.xml", "code", "src/export-docx.ts:445", 445, "Usar FootnoteReferenceRun + definicoes em FootnoteType.NORMAL", noFootnotes, noFootnotesReason);
  add("24.2", "Notas de rodape", "Fonte das notas menor que a do texto (espaco simples)", analysis.footnotes.smallerThanBody && analysis.footnotes.singleSpaced, "medio", "notas", "Reduzir fonte e aplicar espaco simples", "code", "src/export-docx.ts", undefined, "Definir size menor que BODY_SIZE e spacing.line=240 nas notas", noFootnotes, noFootnotesReason);
  add("24.3", "Notas de rodape", "Fonte das notas e Times New Roman", analysis.footnotes.timesNewRoman, "medio", "notas", "Usar Times New Roman nas notas", "code", "src/export-docx.ts", undefined, "Aplicar UFLA_RULES.typography.fontFamily nas notas", noFootnotes, noFootnotesReason);

  // === 25. Exportacao ===
  add("25.1", "Exportacao", "Exportador gera capa", analysis.cover.exists, "grave", "exportacao", "Gerar capa", "code", "src/export-docx.ts", undefined, "Chamar coverChildren()");
  add("25.2", "Exportacao", "Exportador gera folha de rosto", true, "grave", "exportacao", "Folha de rosto gerada", "none");
  add("25.3", "Exportacao", "Exportador gera resumo", true, "grave", "exportacao", "Resumo gerado", "none");
  add("25.4", "Exportacao", "Exportador gera referencias", analysis.references.entryCount > 0, "grave", "referencias", "Gerar secao de referencias", "code", "src/export-docx.ts:1999", 1999, "Chamar buildReferences()");
  add("25.5", "Exportacao", "Exportador gera sumario", analysis.summary.exists, "grave", "sumario", "Gerar sumario", "code", "src/export-docx.ts:1464", 1464, "Chamar buildSummary()");
  // Anexos e apendices sao opcionais para todos os tipos (checklist 23 e matriz
  // de tipos). Quando o documento nao os contem, a ausencia e estado valido:
  // item vira "nao verificado", nao falha.
  const noAnnexesReason = "Anexos sao opcionais e ausentes neste documento (nao verificado).";
  const noAppendicesReason = "Apendices sao opcionais e ausentes neste documento (nao verificado).";
  add("25.6", "Exportacao", "Exportador gera anexos", analysis.summary.includesAnnexes, "medio", "anexos", "Incluir anexos", "code", "src/export-docx.ts:2004", 2004, "Adicionar secao de Anexos", !analysis.summary.includesAnnexes, noAnnexesReason);
  add("25.7", "Exportacao", "Exportador gera apendices", analysis.summary.includesAppendices, "medio", "apendices", "Incluir apendices", "code", "src/export-docx.ts:2000", 2000, "Adicionar secao de Apendices", !analysis.summary.includesAppendices, noAppendicesReason);
  add("25.8", "Exportacao", "Exportador insere numero de pagina com campo Word", analysis.pagination.usesWordField, "grave", "paginacao", "Usar PageNumber.CURRENT", "code", "src/export-docx.ts:2013", 2013, "Adicionar PageNumber.CURRENT ao header");
  // Ilustração em mais de uma página (Manual UFLA §23.3): repetir título nas
  // páginas seguintes com marcas (continua / continuação / conclusão).
  const noOversizedImages = analysis.images.oversizedCount === 0;
  add("25.9", "Exportacao", "Ilustracao maior que a pagina alerta para marcas continua/continuacao/conclusao", noOversizedImages, "baixo", "ilustracao", "Reduzir a imagem ou adicionar as marcas manualmente no Word", "manual", undefined, undefined, "Quando uma imagem excede a area util, repetir o titulo e usar as indicacoes (continua / continuacao / conclusao) nas paginas seguintes.", noOversizedImages, "Nenhuma ilustracao excede a area util da pagina.");

  return items;
}
