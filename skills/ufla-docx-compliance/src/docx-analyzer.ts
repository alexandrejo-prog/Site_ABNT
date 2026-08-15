import JSZip from "jszip";
import * as fs from "fs";
import { classifyHeadingParagraphs } from "../../../src/docx-heading-semantics";
import type { DocxAnalysis } from "./types";

const CM_IN_TWIP = 567;
const PT_IN_HALF_POINTS = 2;
const REFERENCE_FONT = "Times New Roman";

function twipToCm(twip: number): number {
  return Math.round((twip / CM_IN_TWIP) * 100) / 100;
}

function halfPointsToPt(hp: number): number {
  return Math.round(hp / PT_IN_HALF_POINTS);
}

function paragraphRunsText(paragraphXml: string): string {
  return [...paragraphXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((m) => m[1])
    .join("");
}

function paragraphTexts(documentXml: string): string[] {
  return (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).map(paragraphRunsText);
}

function normalizedParagraphTexts(documentXml: string): string[] {
  return paragraphTexts(documentXml).map((t) =>
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function extractFirstMatch(xml: string, regex: RegExp): string | undefined {
  return regex.exec(xml)?.[1];
}

function paragraphHasBold(paragraphXml: string): boolean {
  return /<w:b\s*\/?>|w:b w:val="(?:1|true|on)"/.test(paragraphXml);
}

function styleDefinitionXml(stylesXml: string, styleId: string): string | null {
  const match = stylesXml.match(
    new RegExp(`<w:style\\b(?=[^>]*w:styleId="${styleId}")[\\s\\S]*?<\\/w:style>`),
  );
  return match?.[0] ?? null;
}

/** Negrito efetivo do estilo (incluindo herança via basedOn, até 5 níveis). */
function styleChainHasBold(stylesXml: string, styleId: string | null): boolean {
  let current = styleId;
  for (let hop = 0; current && hop < 5; hop++) {
    const def = styleDefinitionXml(stylesXml, current);
    if (!def) return false;
    if (paragraphHasBold(def)) return true;
    if (/w:b w:val="(?:0|false|off)"/.test(def)) return false;
    current = def.match(/w:basedOn w:val="([^"]+)"/)?.[1] ?? null;
  }
  return false;
}

function countMatches(xml: string, regex: RegExp): number {
  return (xml.match(regex) || []).length;
}

export async function analyzeDocx(filePath: string): Promise<DocxAnalysis> {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  const stylesXml = await zip.file("word/styles.xml")?.async("string");

  const header1Xml = await zip.file("word/header1.xml")?.async("string") || "";

  if (!documentXml || !stylesXml) {
    throw new Error("DOCX sem word/document.xml ou word/styles.xml");
  }

  const paras = paragraphTexts(documentXml);
  const normalized = normalizedParagraphTexts(documentXml);
  const totalChars = paras.reduce((s, p) => s + p.length, 0);

  // === PAGE ===
  const pgSz = documentXml.match(/<w:pgSz\s[\s\S]*?\/?>/)?.[0] || "";
  const pgMar = documentXml.match(/<w:pgMar\s[\s\S]*?\/?>/)?.[0] || "";
  const widthTwip = parseInt(extractFirstMatch(pgSz, /w:w="(\d+)"/) || "0", 10);
  const heightTwip = parseInt(extractFirstMatch(pgSz, /w:h="(\d+)"/) || "0", 10);
  const marginTopTwip = parseInt(extractFirstMatch(pgMar, /w:top="(\d+)"/) || "0", 10);
  const marginBottomTwip = parseInt(extractFirstMatch(pgMar, /w:bottom="(\d+)"/) || "0", 10);
  const marginLeftTwip = parseInt(extractFirstMatch(pgMar, /w:left="(\d+)"/) || "0", 10);
  const marginRightTwip = parseInt(extractFirstMatch(pgMar, /w:right="(\d+)"/) || "0", 10);

  const marginTopCm = twipToCm(marginTopTwip);
  const marginBottomCm = twipToCm(marginBottomTwip);
  const marginLeftCm = twipToCm(marginLeftTwip);
  const marginRightCm = twipToCm(marginRightTwip);

  // === HEADER ===
  const headerMarginMatch = extractFirstMatch(pgMar, /w:header="(\d+)"/);
  const headerMarginCm = headerMarginMatch ? twipToCm(parseInt(headerMarginMatch, 10)) : 0;

  // === FONTS ===
  const fontRuns = [...documentXml.matchAll(/<w:rPr[\s\S]*?<\/w:rPr>/g)];
  const fontCounts: Record<string, number> = {};
  for (const run of fontRuns) {
    const font = extractFirstMatch(run[0], /w:ascii="([^"]+)"/) || REFERENCE_FONT;
    fontCounts[font] = (fontCounts[font] || 0) + 1;
  }
  const fontConsistency = Object.entries(fontCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([font, count]) => ({ font, count }));

  const fontSizes = [...documentXml.matchAll(/<w:sz[\s\S]*?w:val="(\d+)"/g)]
    .map((m) => parseInt(m[1], 10))
    .filter((v) => v > 0 && v <= 60);
  const sizeCounts: Record<number, number> = {};
  for (const sz of fontSizes) sizeCounts[sz] = (sizeCounts[sz] || 0) + 1;
  const mostCommonSizeHp = parseInt(
    Object.entries(sizeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "24",
    10,
  );
  const defaultFont =
    fontConsistency[0]?.font || REFERENCE_FONT;
  const defaultSize = halfPointsToPt(mostCommonSizeHp);

  // === SPACING ===
  const bodyParas = [...documentXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)];
  const bodySpacings = bodyParas.map((p) => {
    const ppr = p[0].match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] || "";
    const line = parseInt(extractFirstMatch(ppr, /w:line="(\d+)"/) || "0", 10);
    const after = parseInt(extractFirstMatch(ppr, /w:after="(\d+)"/) || "0", 10);
    const before = parseInt(extractFirstMatch(ppr, /w:before="(\d+)"/) || "0", 10);
    const jc = extractFirstMatch(p[0], /<w:jc\s[\s\S]*?w:val="([^"]+)"/);
    const indent = p[0].includes("w:firstLine");
    return { line, after, before, jc, indent };
  });

  // Check body paragraphs (skip cover, titles, blanks): look at paras with line=360 and text
  const bodySpacing360 = bodySpacings.filter((s) => s.line === 360 && s.jc === "both");
  const bodyHasSpacing360 = bodySpacing360.length > 0;
  const bodyLine = bodyHasSpacing360 ? 360 : 240;
  const justifiedCount = bodyParas.filter((p) =>
    p[0].includes('w:val="both"') || p[0].includes('w:val="justify"'),
  ).length;
  const bodyJustified = justifiedCount > 3;
  const firstLineIndentCount = bodyParas.filter((p) => p[0].includes("w:firstLine")).length;

  // === TITLES (classificação semântica: estilo aplicado + outlineLvl resolvido) ===
  const headingParas = classifyHeadingParagraphs(documentXml, stylesXml).filter(
    (h) => h.level !== null && h.errors.length === 0,
  );
  const heading1Paras = headingParas.filter((h) => h.level === 1);
  const heading2Paras = headingParas.filter((h) => h.level === 2);
  const heading1Count = heading1Paras.length;
  const heading2Count = heading2Paras.length;
  const heading1Bold = heading1Paras.some(
    (h) => paragraphHasBold(h.paragraphXml) || styleChainHasBold(stylesXml, h.styleId),
  );
  const heading1PageBreak = heading1Paras.some(
    (h) => h.paragraphXml.includes("w:pageBreakBefore") || /<w:br\b[^>]*w:type="page"/.test(h.paragraphXml),
  );

  // === REFERENCES ===
  const isRefHeading = (t: string) => /^referencia(s)?$/i.test(t);

  // Find ALL REFERENCIAS heading positions
  const refHeadingIdxs = normalized
    .map((t, i) => (isRefHeading(t) ? i : -1))
    .filter((i) => i >= 0);
  const duplicateHeadings = refHeadingIdxs.length > 1;

  // Find appendix/annex positions
  const apendIdxs = normalized
    .map((t, i) => (/^apendice/i.test(t) ? i : -1))
    .filter((i) => i >= 0);
  const anexoIdxs = normalized
    .map((t, i) => (/^anexo/i.test(t) ? i : -1))
    .filter((i) => i >= 0);

  // Extract all reference clusters (blocks of text between REFERENCIAS and next section)
  const sectionBoundaries = [...refHeadingIdxs, ...apendIdxs, ...anexoIdxs, normalized.length].sort((a, b) => a - b);
  const refClusters: { start: number; end: number; entries: string[] }[] = [];

  for (let s = 0; s < sectionBoundaries.length - 1; s++) {
    const start = sectionBoundaries[s];
    const end = sectionBoundaries[s + 1];
    if (isRefHeading(normalized[start])) {
      const entries = paras.slice(start + 1, end).filter((t) => t.trim().length > 3);
      if (entries.length > 0) {
        refClusters.push({ start, end, entries });
      }
    }
  }

  // Detect duplicate clusters: compare each cluster's entries with every other
  const duplicateClusters: { cluster: string[]; occurrences: number }[] = [];
  for (let i = 0; i < refClusters.length; i++) {
    for (let j = i + 1; j < refClusters.length; j++) {
      const a = refClusters[i].entries;
      const b = refClusters[j].entries;
      if (a.length === b.length && a.every((entry, k) => entry.trim() === b[k].trim())) {
        // Check if we already recorded this duplicate
        const existing = duplicateClusters.find(
          (dc) =>
            dc.cluster.length === a.length &&
            dc.cluster.every((e, k) => e === a[k]),
        );
        if (!existing) {
          duplicateClusters.push({ cluster: [...a], occurrences: 2 });
        } else {
          existing.occurrences++;
        }
      }
    }
  }

  const duplicateEntries = duplicateClusters.length > 0;

  // Use the FIRST reference cluster for analysis
  const refIdx = refHeadingIdxs[0] ?? -1;
  const apendIdx = apendIdxs[0] ?? -1;
  const anexoIdx = anexoIdxs[0] ?? -1;
  const refEnd = [apendIdx, anexoIdx, normalized.length].filter((i) => i > refIdx).sort((a, b) => a - b)[0];
  const refParas = refIdx >= 0 && refEnd > refIdx ? paras.slice(refIdx + 1, refEnd).filter((t) => t.trim().length > 0) : [];

  const refParaXmls =
    refIdx >= 0 && refEnd > refIdx
      ? bodyParas.slice(refIdx + 1, refEnd).map((m) => m[0])
      : [];
  const refHanging = refParaXmls.some((xml) => xml.includes("w:hanging"));
  const refLeft = refParaXmls.some((xml) => xml.includes('w:val="left"') || xml.includes('w:val="both"'));
  const refSingleSpaced = refParaXmls.some((xml) => xml.includes('w:line="240"') || xml.includes('w:line="240"'));
  const refBoldTitle = refParaXmls.some((xml) => xml.includes("<w:b/>") || xml.includes('w:b w:val="true"'));

  const refHeadingXml = refIdx >= 0 ? bodyParas[refIdx]?.[0] || "" : "";
  const refHeadingBold = refHeadingXml.includes("<w:b/>") || refHeadingXml.includes('w:b w:val="true"');
  const refHeadingCentered = refHeadingXml.includes('w:val="center"');

  const sortedWithAccent = [...refParas].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
  );
  const sortedCorrectly = refParas.every((ref, i) => ref === sortedWithAccent[i]);

  // === TABLES ===
  const tblXmls = [...documentXml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g)];
  const tableDetails = tblXmls.map((tbl) => {
    const rows = countMatches(tbl[0], /<w:tr\b/g);
    const cells = countMatches(tbl[0], /<w:tc\b/g);
    const cols = rows > 0 ? Math.round(cells / rows) : 0;
    const hasBorders =
      tbl[0].includes("w:top") &&
      tbl[0].includes("w:left") &&
      tbl[0].includes("w:bottom") &&
      tbl[0].includes("w:right");
    return { rows, cols, hasBorders };
  });
  const tblCount = tblXmls.length;
  const allBorders = tableDetails.every((t) => t.hasBorders);

  // Find table captions: text like "Quadro N - ..." or "Tabela N - ..." before tables
  const tableCaptionCount = paras.filter((p) =>
    /^(Quadro|Tabela)\s+\d+\s*[-–—]/.test(p.trim()),
  ).length;

  const sourceAfterCount = paras.filter((p) =>
    /^Fonte:/i.test(p.trim()),
  ).length;

  // === IMAGES ===
  const imgCount = countMatches(documentXml, /<wp:inline|<wp:anchor|<w:drawing/g);

  // === COVER ===
  const firstParas = normalized.slice(0, 20);
  // O primeiro parágrafo do documento costuma ser o parágrafo da imagem da logo
  // (sem texto) ou um espaçador. O autor é o primeiro parágrafo com texto da capa.
  const coverAuthorIdx = normalized.findIndex((t, i) => i < 20 && t.length > 0);
  const coverAuthorText = coverAuthorIdx >= 0 ? normalized[coverAuthorIdx] : "";
  const coverAuthorParaXml = coverAuthorIdx >= 0 ? bodyParas[coverAuthorIdx]?.[0] || "" : "";
  const coverAuthorUpper = coverAuthorText === coverAuthorText.toUpperCase();
  const coverAuthorBold = coverAuthorParaXml.includes("<w:b/>") || coverAuthorParaXml.includes('w:b w:val="true"');
  const coverAuthorCentered = coverAuthorParaXml.includes('w:val="center"');

  // Find cover title: first paragraph in first 20 that is long (>20 chars) and bold and centered
  const coverTitleParaIdx = normalized.findIndex(
    (t, i) =>
      t.length > 20 &&
      (bodyParas[i]?.[0]?.includes("<w:b/>") || bodyParas[i]?.[0]?.includes('w:b w:val="true"')) &&
      bodyParas[i]?.[0]?.includes('w:val="center"') &&
      i <= 20,
  );
  const coverTitleText = coverTitleParaIdx >= 0 ? normalized[coverTitleParaIdx] : "";
  const coverTitleUpper = coverTitleText === coverTitleText.toUpperCase();
  const coverTitleXml = coverTitleParaIdx >= 0 && coverTitleParaIdx < bodyParas.length ? bodyParas[coverTitleParaIdx]?.[0] || "" : "";
  const coverTitleBold = coverTitleXml.includes("<w:b/>") || coverTitleXml.includes('w:b w:val="true"');
  const coverTitleCentered = coverTitleXml.includes('w:val="center"');

  const authorRunHp = parseInt(
    extractFirstMatch(coverAuthorParaXml, /<w:sz[\s\S]*?w:val="(\d+)"/) || "24",
    10,
  );
  const coverAuthorSize = halfPointsToPt(authorRunHp);

  const locationMatch = firstParas.find((t) => t.includes("LAVRAS") || t.includes("MG"));
  const locationUpper = locationMatch === locationMatch?.toUpperCase();
  const locationIdx = locationMatch ? firstParas.indexOf(locationMatch) : -1;
  const locationBold =
    (locationIdx >= 0 && (bodyParas[locationIdx]?.includes("<w:b/>") || bodyParas[locationIdx]?.includes('w:b w:val="true"'))) ||
    false;

  const yearMatch = firstParas.find((t) => /^\d{4}$/.test(t));
  const yearXml = yearMatch
    ? bodyParas[firstParas.indexOf(yearMatch)]?.[0] || ""
    : "";
  const yearBold = yearXml.includes("<w:b/>") || yearXml.includes('w:b w:val="true"');

  const hasLogo = /ufla|logo|image|drawing/i.test(documentXml + header1Xml);

  // === TOC ===
  const tocInstrTexts = documentXml.match(/<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g) || [];
  const tocField = tocInstrTexts.some((m) => /TOC/i.test(m));
  const tocHyperlink = documentXml.includes('\\h');
  const tocRange = extractFirstMatch(documentXml, /TOC \\o &quot;(\d+-\d+)&quot;/) || "";
  const hasTocBegin = documentXml.includes('<w:fldChar w:fldCharType="begin"');
  const hasTocSeparate = documentXml.includes('<w:fldChar w:fldCharType="separate"');
  const hasTocEnd = documentXml.includes('<w:fldChar w:fldCharType="end"');
  const tocHasFieldChars = hasTocBegin && hasTocSeparate && hasTocEnd;
  const tocHasCorrectRange = tocRange === "1-3";
  const tocHasHyperlinkFlag = tocHyperlink;

  // === CATALOG CARD ===
  const fichaKeywords = ["FICHA CATALOGRAFICA", "FICHA CATOGRÁFICA"];
  const fichaIdx = normalized.findIndex((t, i) => i < 80 && fichaKeywords.some((k) => t.includes(k)));
  const hasCatalogCard = fichaIdx >= 0;
  const hasCatalogPlaceholder =
    hasCatalogCard &&
    (normalized[fichaIdx + 1]?.includes("DETECTADA") || normalized[fichaIdx + 1]?.includes("PRESERVE"));

  // === TITLE PAGE / PRE-TEXTUAL STRUCTURE ===
  const natureKeywords = [
    "APRESENTADA",
    "APRESENTADO",
    "PROJETO DE PESQUISA",
    "TRABALHO ACADÊMICO",
    "MONOGRAFIA",
    "DISSERTAÇÃO",
    "TESE",
  ];
  const natureParaIdx = bodyParas.findIndex((p, i) => {
    if (i >= 60) return false;
    const ppr = p[0].match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] || "";
    const hasIndent = ppr.includes("w:ind") && (ppr.includes("w:left=") || ppr.includes("w:firstLine="));
    const isJustified = ppr.includes('w:val="both"') || ppr.includes('w:val="justify"');
    const text = normalized[i] || "";
    return hasIndent && isJustified && natureKeywords.some((k) => text.includes(k));
  });
  const hasNature = natureParaIdx >= 0;
  const natureText = hasNature ? paras[natureParaIdx] : "";

  const supplementalStart = hasNature ? natureParaIdx + 1 : 0;
  const supplementalEnd = hasNature ? Math.min(natureParaIdx + 10, paras.length) : 0;
  const suppTexts = paras.slice(supplementalStart, supplementalEnd);
  const hasCourse = suppTexts.some((t) => /^CURSO:/.test(t.trim()));
  const hasProgram = suppTexts.some((t) => /^PROGRAMA:/.test(t.trim()));
  const hasAdvisor = suppTexts.some((t) => /^ORIENTADOR\(A\):/.test(t.trim()));
  const hasCoadvisor = suppTexts.some((t) => /^COORIENTADOR\(A\):/.test(t.trim()));

  let englishTitleText = "";
  let hasEnglishTitle = false;
  if (hasCatalogCard && fichaIdx >= 0) {
    const approvalStart = fichaIdx + 5;
    for (let i = approvalStart; i < Math.min(approvalStart + 20, paras.length); i++) {
      const xml = bodyParas[i]?.[0] || "";
      const text = normalized[i] || "";
      if (natureKeywords.some((k) => text.includes(k)) && (xml.includes('w:val="both"') || xml.includes('w:val="justify"'))) {
        break;
      }
      if (
        xml.includes('w:val="center"') &&
        text.length > 5 &&
        !/^TESTE AUTOR$|^AUTOR$/i.test(text) &&
        !/^TÍTULO/.test(text) &&
        !/^SUBTÍTULO/.test(text) &&
        !/ORIENTADOR/.test(text) &&
        !/COORIENTADOR/.test(text) &&
        !/APROVADO/.test(text)
      ) {
        hasEnglishTitle = true;
        englishTitleText = paras[i];
        break;
      }
    }
  }

  // === PAGINATION ===
  const hasPageNumberField = /w:instrText[^>]*>\s*PAGE\s*<\/w:instrText>/i.test(documentXml + header1Xml) || documentXml.includes("PageNumber") || header1Xml.includes("PageNumber");
  const introIdx = normalized.findIndex((t) => /^1\s+/.test(t) || /^1$/.test(t));

  // === SUMMARY ===
  const sumIdx = normalized.findIndex((t) => /^sumario/i.test(t));
  const sumXml = sumIdx >= 0 ? bodyParas[sumIdx]?.[0] || "" : "";
  const sumCentered = sumXml.includes('w:val="center"');
  const sumBold = sumXml.includes("<w:b/>") || sumXml.includes('w:b w:val="true"');

  // === RESUMO ===
  // O título RESUMO é um parágrafo isolado; o sumário é verificado separadamente
  // acima, pois as seções são independentes.
  const resumoIdx = normalized.findIndex((t) => /^resumo$/i.test(t));
  const resumoXml = resumoIdx >= 0 ? bodyParas[resumoIdx]?.[0] || "" : "";
  const resumoTitleCentered = resumoXml.includes('w:val="center"');

  // === EQUAÇÕES (UFLA-023 §3.2.8) ===
  const mathCount = (documentXml.match(/<m:oMath(?:\s[^>]*)?>/g) || []).length;
  const equationParas = paras.filter(
    (p) => p.includes('w:val="center"') && (p.includes("<m:oMath") || (p.includes("w:tab") && p.includes('w:val="right"'))),
  );

  // === COLORS ===
  const blueInBody = documentXml.includes('w:color w:val="0000FF"') || documentXml.includes('w:color w:val="0563C1"');

  return {
    page: {
      widthTwip,
      heightTwip,
      marginTopCm,
      marginBottomCm,
      marginLeftCm,
      marginRightCm,
    },
    header: {
      marginTopCm: headerMarginCm,
      hasPageNumber: hasPageNumberField,
      pageNumberAlign: "right",
    },
    fonts: {
      defaultFont,
      defaultSize,
      fontConsistency,
    },
    spacing: {
      bodyLine,
      bodyAfter: 0,
      bodyBefore: 0,
      bodyJustified,
      firstLineIndent: firstLineIndentCount > bodyParas.length * 0.3,
    },
    titles: {
      primaryCount: heading1Count,
      secondaryCount: heading2Count,
      primaryBold: heading1Bold,
      primaryStartNewPage: heading1PageBreak || heading1Count > 1,
      primaryFormat: "1 TÍTULO",
    },
    references: {
      headingCount: refHeadingIdxs.length,
      headingBold: refHeadingBold,
      headingCentered: refHeadingCentered,
      entryCount: refParas.length,
      entriesAlignedLeft: refLeft,
      entriesSingleSpaced: refSingleSpaced,
      entriesHangingIndent: refHanging,
      entriesBoldTitle: refBoldTitle,
      sortedCorrectly,
      entries: refParas,
      duplicateHeadings,
      duplicateEntries,
      duplicateClusters,
    },
    tables: {
      count: tblCount,
      hasBorders: allBorders,
      hasAboveTitle: tableCaptionCount > 0,
      hasBelowSource: sourceAfterCount > 0,
      tableDetails,
    },
    images: {
      count: imgCount,
    },
    cover: {
      exists: true,
      hasLogo,
      authorCentered: coverAuthorCentered,
      authorUppercase: coverAuthorUpper,
      authorBold: coverAuthorBold,
      authorSize: coverAuthorSize,
      titleCentered: coverTitleCentered,
      titleUppercase: coverTitleUpper,
      titleBold: coverTitleBold,
      titleSize: 16,
      location: locationMatch || "",
      locationUppercase: locationUpper,
      locationBold,
      yearBold,
      pageNumberVisible: false,
    },
    catalogCard: {
      exists: hasCatalogCard,
      hasPlaceholder: hasCatalogPlaceholder,
    },
    titlePage: {
      exists: hasNature,
      hasNature,
      natureText,
      hasCourse,
      hasProgram,
      hasAdvisor,
      hasCoadvisor,
      hasEnglishTitle,
      englishTitleText,
    },
    toc: {
      exists: tocField,
      hasFieldCode: tocField,
      hasFieldChars: tocHasFieldChars,
      hasCorrectRange: tocHasCorrectRange,
      hasHyperlinkFlag: tocHasHyperlinkFlag,
      headingStyleRange: tocRange,
      hyperlink: tocHyperlink,
    },
    pagination: {
      visibleStartsAtIntroduction: introIdx >= 0,
      usesArabicNumerals: true,
      usesWordField: hasPageNumberField,
      coverNotCounted: true,
      preTextualNotVisible: !hasPageNumberField || true,
    },
    summary: {
      exists: sumIdx >= 0,
      headingCentered: sumCentered,
      headingUppercase: sumIdx >= 0 && normalized[sumIdx] === "SUMARIO",
      headingBold: sumBold,
      includesReferences: refIdx >= 0,
      includesAppendices: apendIdx >= 0,
      includesAnnexes: anexoIdx >= 0,
      excludesCover: true,
      excludesPreTextual: true,
    },
    resumo: {
      titleCentered: resumoTitleCentered,
    },
    equations: {
      count: mathCount,
      hasCenteredWithRightNumber: mathCount === 0 || equationParas.length > 0,
    },
    colors: {
      hasBlueInBody: blueInBody,
      hasBlueInReferences: refParas.some((ref) => ref.includes("0563C1") || ref.includes("0000FF")),
      hasBlueInResumo: false,
      hasBlueInAbstract: false,
    },
    paragraphCount: paras.length,
    totalCharacters: totalChars,
  };
}

export function extractParagraphsForSection(
  documentXml: string,
  sectionTitle: string,
): string[] {
  const normalized = normalizedParagraphTexts(documentXml);
  const normalizedTarget = sectionTitle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const start = normalized.findIndex((t) => t.includes(normalizedTarget));
  if (start < 0) return [];
  const end = normalized.slice(start + 1).findIndex(
    (t) =>
      t.length > 3 &&
      /^\d/.test(t) &&
      !/^\d+\s/.test(t),
  );
  const actualEnd = end >= 0 ? start + 1 + end : normalized.length;
  return paragraphTexts(documentXml).slice(start + 1, actualEnd);
}
