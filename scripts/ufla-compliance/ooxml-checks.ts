import JSZip from "jszip";
import { classifyHeadingParagraphs } from "../../src/docx-heading-semantics";
import type { ComplianceIssue } from "./types";

const CM_3_TWIP = 1701;
const CM_2_TWIP = 1134;
const A4_W = 11906;
const A4_H = 16838;
const TNR = "Times New Roman";

export interface DocxParts {
  names: string[];
  documentXml: string;
  stylesXml: string;
  settingsXml: string;
  numberingXml: string;
  headerXmls: Record<string, string>;
  footerXmls: Record<string, string>;
  relsXml: string;
  coreXml: string;
}

export async function loadDocxPartsFromBytes(bytes: ArrayBuffer | Buffer | Uint8Array): Promise<DocxParts> {
  const zip = await JSZip.loadAsync(bytes as ArrayBuffer);
  const names = Object.keys(zip.files).sort();
  const read = async (p: string): Promise<string> => (await zip.file(p)?.async("string")) || "";
  const headerXmls: Record<string, string> = {};
  const footerXmls: Record<string, string> = {};
  for (const name of names) {
    if (/^word\/header\d+\.xml$/.test(name)) headerXmls[name] = (await zip.file(name)?.async("string")) || "";
    if (/^word\/footer\d+\.xml$/.test(name)) footerXmls[name] = (await zip.file(name)?.async("string")) || "";
  }
  return {
    names,
    documentXml: await read("word/document.xml"),
    stylesXml: await read("word/styles.xml"),
    settingsXml: await read("word/settings.xml"),
    numberingXml: await read("word/numbering.xml"),
    headerXmls,
    footerXmls,
    relsXml: await read("word/_rels/document.xml.rels"),
    coreXml: await read("docProps/core.xml"),
  };
}

export async function loadDocxPartsFromFile(filePath: string): Promise<DocxParts> {
  const { readFileSync } = await import("node:fs");
  return loadDocxPartsFromBytes(readFileSync(filePath));
}

const issue = (
  code: string,
  message: string,
  severity: ComplianceIssue["severity"],
  rule: string,
  item?: string,
  action?: string,
): ComplianceIssue => ({ code, message, severity, rule, item, action });

function paragraphsOf(xml: string): string[] {
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
}

function paragraphText(xml: string): string {
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("");
}

function normalizedParagraphs(xml: string): string[] {
  return paragraphsOf(xml)
    .map(paragraphText)
    .map((t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim());
}

function allSectPr(xml: string): string[] {
  return [...xml.matchAll(/<w:sectPr[\s\S]*?<\/w:sectPr>/g)].map((m) => m[0]);
}

export interface TableHeaderFinding {
  tableIndex: number;
  headerDetected: boolean;
  tblHeaderPresent: boolean;
  reason: string;
  status: "ok" | "gap" | "not-applicable";
}

export function analyzeTableHeaders(documentXml: string): TableHeaderFinding[] {
  const tablesXml = [...documentXml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g)].map((m) => m[0]);
  const findings: TableHeaderFinding[] = [];

  for (const [index, tbl] of tablesXml.entries()) {
    const rows = [...tbl.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((m) => m[0]);
    const nonEmptyRows = rows.filter((r) => paragraphText(r).replace(/\s+/g, "").length > 0);
    const tblHeaderPresent = rows.some((r) => /<w:tblHeader\b/i.test(r));

    if (nonEmptyRows.length <= 1) {
      findings.push({
        tableIndex: index,
        headerDetected: false,
        tblHeaderPresent,
        reason: "Tabela de linha única — sem linha de cabeçalho repetível (não exige w:tblHeader).",
        status: "not-applicable",
      });
    } else if (tblHeaderPresent) {
      findings.push({
        tableIndex: index,
        headerDetected: true,
        tblHeaderPresent: true,
        reason: "Linha de cabeçalho identificada por w:tblHeader (WCAG 1.3.1 / NBR 17225).",
        status: "ok",
      });
    } else {
      findings.push({
        tableIndex: index,
        headerDetected: false,
        tblHeaderPresent: false,
        reason: "Tabela com 2+ linhas sem w:tblHeader — cabeçalho não identificado semanticamente.",
        status: "gap",
      });
    }
  }

  return findings;
}

export function runOoxmlChecks(parts: DocxParts): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const { documentXml, stylesXml, settingsXml, headerXmls, relsXml } = parts;
  const paras = paragraphsOf(documentXml);
  const norm = normalizedParagraphs(documentXml);

  // ---------------------------------------------------------------------
  // 2.1 + 2.2/2.3/2.4/2.5 — página e margens em TODAS as seções
  // ---------------------------------------------------------------------
  const sectPrs = allSectPr(documentXml);
  if (sectPrs.length < 2) {
    issues.push(issue("page-sections-required", `Esperadas 2 seções (pré-textual e textual/pós-textual); encontradas ${sectPrs.length}.`, "error", "UFLA estrutural", "seções"));
  } else {
    for (const [i, sect] of sectPrs.entries()) {
      const w = parseInt(sect.match(/w:pgSz[^>]*w:w="(\d+)"/)?.[1] ?? "0", 10);
      const h = parseInt(sect.match(/w:pgSz[^>]*w:h="(\d+)"/)?.[1] ?? "0", 10);
      const top = parseInt(sect.match(/w:pgMar[^>]*w:top="(\d+)"/)?.[1] ?? "-1", 10);
      const bottom = parseInt(sect.match(/w:pgMar[^>]*w:bottom="(\d+)"/)?.[1] ?? "-1", 10);
      const left = parseInt(sect.match(/w:pgMar[^>]*w:left="(\d+)"/)?.[1] ?? "-1", 10);
      const right = parseInt(sect.match(/w:pgMar[^>]*w:right="(\d+)"/)?.[1] ?? "-1", 10);
      const label = `seção ${i + 1}`;
      if (w !== A4_W || h !== A4_H) issues.push(issue("page-a4", `A4 ausente na ${label} (w=${w} h=${h}).`, "error", "Manual UFLA 4.1", label));
      if (top !== CM_3_TWIP) issues.push(issue("margin-top", `Margem superior ${top} twips (esperado 1701) na ${label}.`, "error", "Manual UFLA 4.2", label));
      if (left !== CM_3_TWIP) issues.push(issue("margin-left", `Margem esquerda ${left} twips (esperado 1701) na ${label}.`, "error", "Manual UFLA 4.2", label));
      if (bottom !== CM_2_TWIP) issues.push(issue("margin-bottom", `Margem inferior ${bottom} twips (esperado 1134) na ${label}.`, "error", "Manual UFLA 4.2", label));
      if (right !== CM_2_TWIP) issues.push(issue("margin-right", `Margem direita ${right} twips (esperado 1134) na ${label}.`, "error", "Manual UFLA 4.2", label));
      if (!sect.includes('w:header="1134"')) issues.push(issue("header-distance", `Distância do cabeçalho incorreta na ${label}.`, "error", "Manual UFLA 4.2", label));
      if (!sect.includes('w:footer="1134"')) issues.push(issue("footer-distance", `Distância do rodapé incorreta na ${label}.`, "error", "Manual UFLA 4.2", label));
    }
  }

  // ---------------------------------------------------------------------
  // Cabeçalho: numeração visível apenas na seção textual (com headerReference)
  // ---------------------------------------------------------------------
  const withHeader = sectPrs.some((s) => s.includes("w:headerReference"));
  const firstSectionHasHeader = sectPrs[0]?.includes("w:headerReference") ?? false;
  if (!withHeader) issues.push(issue("header-page-number-missing", "Nenhuma seção referencia cabeçalho com número de página.", "error", "Manual UFLA 4.5", "cabeçalho"));
  if (firstSectionHasHeader) issues.push(issue("header-on-cover", "A seção pré-textual (capa) referencia cabeçalho; a capa não deve exibir numeração.", "error", "Manual UFLA 4.5", "capa"));
  const pageField = /w:instrText[^>]*>PAGE<\/w:instrText>/i.test(Object.values(headerXmls).join(" "));
  if (!pageField) issues.push(issue("page-number-field", "Campo PAGE ausente no cabeçalho (número de página não atualiza no Word).", "error", "Manual UFLA 4.5", "cabeçalho"));

  // ---------------------------------------------------------------------
  // Tipografia
  // ---------------------------------------------------------------------
  const stylesHaveTnr = stylesXml.includes('w:ascii="Times New Roman"') || stylesXml.includes("w:ascii='Times New Roman'");
  if (!stylesHaveTnr) issues.push(issue("font-times", "Times New Roman ausente nos estilos do documento.", "error", "Manual UFLA 7.1", "estilos"));
  const nonTnrFonts = new Set<string>();
  for (const m of documentXml.matchAll(/w:rFonts[^>]*w:ascii="([^"]+)"/g)) {
    if (m[1] !== TNR) nonTnrFonts.add(m[1]);
  }
  if (nonTnrFonts.size > 0) {
    issues.push(issue("font-consistency", `Fontes divergentes da Times New Roman no corpo: ${[...nonTnrFonts].join(", ")}.`, "error", "Manual UFLA 7.1", "corpo"));
  }
  if (!/w:sz w:val="24"/.test(documentXml)) issues.push(issue("body-size-12", "Nenhum run com corpo 12pt (sz=24) encontrado.", "error", "Manual UFLA 7.1", "corpo"));

  // ---------------------------------------------------------------------
  // Espaçamento e alinhamento do corpo
  // ---------------------------------------------------------------------
  const line360 = paras.filter((p) => p.includes('w:line="360"'));
  if (line360.length === 0) issues.push(issue("body-spacing-1-5", "Nenhum parágrafo de corpo com espaçamento 1,5 (w:line=360).", "error", "Manual UFLA 7.2", "corpo"));
  if (!documentXml.includes('w:firstLine="709"') && !documentXml.includes('w:firstLine="708"')) {
    issues.push(issue("body-first-line-indent", "Recuo de primeira linha de parágrafo (1,25 cm = 709 twips) ausente.", "error", "Manual UFLA 7.2", "corpo"));
  }
  if (!documentXml.includes('w:val="both"')) issues.push(issue("body-justified", "Nenhum parágrafo justificado (w:jc both) no corpo.", "error", "Manual UFLA 7.2", "corpo"));

  // ---------------------------------------------------------------------
  // Citação longa: 4 cm (2268), 11 pt (sz 22), espaço simples (240)
  // ---------------------------------------------------------------------
  const longQuotes = paras.filter((p) => p.includes('w:left="2268"') && p.includes('w:sz w:val="22"'));
  if (longQuotes.length === 0) {
    issues.push(issue("long-quote-recuo", "Nenhuma citação longa com recuo de 4 cm (w:left=2268), 11 pt (sz=22) e espaço simples detectada.", "error", "Manual UFLA 8.8 / NBR 10520", "citações longas"));
  }

  // ---------------------------------------------------------------------
  // Referências: hanging 0,5 cm (284), espaço simples, à esquerda
  // ---------------------------------------------------------------------
  const refParas = paras.filter((p) => p.includes('w:hanging="284"') || p.includes('w:hanging="283"'));
  const normRefHeadIdx = norm.findIndex((t) => /^REFER.NCIAS/i.test(t));
  if (normRefHeadIdx < 0) {
    issues.push(issue("references-section", "Seção REFERÊNCIAS ausente no DOCX.", "error", "Manual UFLA 9.1", "referências", "Inclua referências em fields.referencias ou no editor."));
  } else {
    if (refParas.length === 0) issues.push(issue("references-hanging", "Referências sem recuo deslocante de 0,5 cm (w:hanging=284).", "error", "NBR 6023", "referências"));
    const refParaXmls = paras.slice(normRefHeadIdx + 1);
    if (!refParaXmls.some((p) => p.includes('w:line="240"') && p.includes("w:val=\"left\""))) {
      // val="left" pode não vir; aceite também line 240 sozinhos
    }
    if (!refParaXmls.some((p) => p.includes('w:line="240"'))) issues.push(issue("references-single-spacing", "Referências sem espaço simples (w:line=240).", "error", "NBR 6023", "referências"));
  }

  // ---------------------------------------------------------------------
  // Sumário atualizável (TOC com \o e \h)
  // ---------------------------------------------------------------------
  const tocInstr = [
    ...documentXml.matchAll(/<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g),
  ].join(" ");
  if (!/TOC/.test(tocInstr)) {
    issues.push(issue("toc-field", "Campo SUMÁRIO (TOC) ausente — sumário não atualizável no Word.", "error", "Manual UFLA 3.3", "sumário", "O gerador deve produzir TableOfContents."));
  } else {
    if (!/\\o/.test(tocInstr)) issues.push(issue("toc-range", "Campo TOC sem faixa de níveis (\\o).", "error", "Manual UFLA 3.3", "sumário"));
    if (!/\\h/.test(tocInstr)) issues.push(issue("toc-hyperlink", "Campo TOC sem hiperlinks (\\h).", "error", "Manual UFLA 3.3", "sumário"));
  }
  if (!/w:val="TOC"/.test(documentXml) && !/w:val="TableOfContents"/.test(documentXml)) {
    issues.push(issue("toc-style", "Estilo do sumário (TOC) não referenciado no documento.", "error", "Manual UFLA 3.3", "sumário"));
  }
  // Títulos primários: classificação semântica (estilo aplicado + outlineLvl
  // resolvido em styles.xml). Reconhece ufla_titulo_* e Heading1/2/3 legados;
  // estilo inexistente/divergente gera erro; hierarquia quebrada é detectada.
  const headingClassified = classifyHeadingParagraphs(documentXml, stylesXml);
  const headingLevel1 = headingClassified.filter((h) => h.level === 1 && h.errors.length === 0);
  if (headingLevel1.length === 0) {
    issues.push(issue("headings-level-1", "Nenhum título de nível 1 (estilo de título com outlineLvl 0) no documento.", "error", "Manual UFLA 6", "títulos"));
  }
  for (const h of headingClassified.filter((c) => c.errors.length > 0)) {
    issues.push(issue("heading-style-error", `Estilo de título inválido: ${h.errors.join("; ")}.`, "error", "Manual UFLA 6", "títulos"));
  }
  let previousLevel = 0;
  for (const h of headingClassified.filter((c) => c.level !== null && c.errors.length === 0)) {
    const level = h.level as number;
    if (level > previousLevel + 1) {
      issues.push(issue("heading-hierarchy-broken", `Título de nível ${level} sem ancestral de nível ${level - 1} (hierarquia quebrada).`, "error", "Manual UFLA 6", "títulos"));
      break;
    }
    previousLevel = level;
  }

  // ---------------------------------------------------------------------
  // Tabelas e legendas/fontes
  // ---------------------------------------------------------------------
  const tableCount = (documentXml.match(/<w:tbl\b/g) || []).length;
  const imageCount = (documentXml.match(/<w:drawing\b|<wp:inline|<wp:anchor/g) || []).length;
  if (!documentXml.includes("Fonte:")) {
    issues.push(issue("table-source", "Nenhuma legenda de fonte ('Fonte:') detectada nas ilustrações/tabelas.", "error", "Manual UFLA 10", "tabelas/ilustrações"));
  }

  // ---------------------------------------------------------------------
  // Acessibilidade — identificação de linha de cabeçalho (w:tblHeader)
  // NBR 17225 / WCAG 1.3.1. Não é erro bloqueador: tabelas de linha única
  // não possuem cabeçalho repetível (not-applicable); apenas tabelas com
  // 2+ linhas sem w:tblHeader geram achado (warning, não estrutural).
  // ---------------------------------------------------------------------
  for (const finding of analyzeTableHeaders(documentXml)) {
    if (finding.status !== "gap") continue;
    issues.push(
      issue(
        "table-header-missing",
        `Tabela ${finding.tableIndex + 1} sem w:tblHeader na linha de cabeçalho — identificação semântica ausente (WCAG 1.3.1).`, "warning",
        "NBR 17225 / WCAG 1.3.1",
        `tabela ${finding.tableIndex + 1}`,
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Apêndices e anexos na ordem pós-textual
  // ---------------------------------------------------------------------
  const apIdx = norm.findIndex((t) => /^AP.NDICE/i.test(t));
  const anIdx = norm.findIndex((t) => /^ANEXO/i.test(t));
  if (apIdx >= 0 && anIdx >= 0 && anIdx < apIdx) {
    issues.push(issue("posttextual-order", "Anexo precede apêndice; a ordem pós-textual deve ser REFERÊNCIAS → APÊNDICES → ANEXOS.", "error", "Manual UFLA 3.2", "pós-textual"));
  }
  const refIdx = norm.findIndex((t) => /^REFER.NCIAS/i.test(t));
  if (apIdx >= 0 && apIdx < refIdx) issues.push(issue("appendices-after-references", "APÊNDICES antes de REFERÊNCIAS.", "error", "Manual UFLA 3.2", "pós-textual"));

  // ---------------------------------------------------------------------
  // settings.xml: atualização automática de campos
  // ---------------------------------------------------------------------
  if (settingsXml && !settingsXml.includes("w:updateFields")) {
    issues.push(issue("update-fields", "settings.xml sem <w:updateFields/> — sumário/paginação podem não ser atualizados ao abrir.", "error", "Prática DOCX", "sumário"));
  }

  // ---------------------------------------------------------------------
  // Relações e estrutura do pacote
  // ---------------------------------------------------------------------
  if (!parts.names.includes("word/numbering.xml")) issues.push(issue("numbering-part", "word/numbering.xml ausente.", "warning", "Prática DOCX", "numeração"));
  const headerRefs = [...relsXml.matchAll(/<Relationship[^>]*Target="header\d+\.xml"[^>]*>/g)];
  if (headerRefs.length === 0 && !withHeader) {
    // já reportado acima
  }

  // ---------------------------------------------------------------------
  // Paginação contínua (DECISION-010): contagem a partir da folha de rosto;
  // numeração visível na seção textual com o valor CONTADO (N ≥ 2), nunca reinício em 1.
  // ---------------------------------------------------------------------
  const textualSections = sectPrs.filter((s) => s.includes("w:headerReference"));
  const textualStart = textualSections.map((s) => s.match(/w:pgNumType[^>]*w:start="(\d+)"/)?.[1]).find((v) => v !== undefined);
  if (sectPrs.length >= 2 && textualSections.length > 0 && textualStart === "1") {
    issues.push(issue("pagination-restart-at-1", "A seção textual reinicia a numeração em 1 (w:pgNumType w:start=\"1\"); com parte pré-textual a contagem deve continuar a partir da folha de rosto — a Introdução deve exibir o valor contado (pré-textuais + 1), nunca 1 (DECISION-010).", "error", "Manual UFLA 4.5", "paginação"));
  } else if (sectPrs.length >= 2 && textualSections.length > 0 && !textualStart) {
    issues.push(issue("pagination-continuation-required", "A seção textual não define w:pgNumType w:start=\"N\" com a continuação explícita da contagem (DECISION-010); o Word pode reiniciar a numeração por conta própria.", "warning", "Manual UFLA 4.5", "paginação"));
  }

  // ---------------------------------------------------------------------
  // UFLA-023 §3.2.8 — equações/fórmulas: centralizadas, numeração à direita
  // ---------------------------------------------------------------------
  const mathParas = paras.filter((p) => p.includes("<m:oMath"));
  const malformedEquations = mathParas.filter(
    (p) => !p.includes('w:val="center"') || !p.includes('<w:tab w:val="right"'),
  );
  if (mathParas.length > 0 && malformedEquations.length > 0) {
    issues.push(issue("equation-format", "Equacoes/formulas presentes sem paragrafo centralizado com numeracao a direita (tab stop direito).", "error", "Manual UFLA 3.2.8", "equacoes"));
  }

  void tableCount;
  void imageCount;
  return issues;
}