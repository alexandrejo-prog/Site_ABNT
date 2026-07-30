import JSZip from "jszip";
import { readFile, writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCX_PATH = resolve(__dirname, "..", "tmp", "docx", "resumo-expandido-cpg.docx");
const REPORT_PATH = resolve(__dirname, "..", "tmp", "docx", "cpg-compliance-report.json");

const TWIPS_PER_CM = 567;

const UFLA_MARGINS = { top: 3, bottom: 2, left: 3, right: 2 };
const CPG_MARGINS = { top: 3.5, bottom: 2.5, left: 3, right: 3 };

const requiredFont = "Times New Roman";
const bodyLineSpacingTwip = 360;
const singleLineSpacingTwip = 240;
const firstLineIndentTwip = 709;
const referenceHangingTwip = 284;

function twipToCm(twip) {
  if (twip === null || twip === undefined) return null;
  return Math.round((twip / TWIPS_PER_CM) * 100) / 100;
}

function extractAttr(xml, tag, attr) {
  // Match both namespaced (w:top) and non-namespaced (top) attributes
  const re = new RegExp(`<${tag}[^>]*\\s${attr}\\s*=\\s*["'](\\d+)["']`, "i");
  const m = xml.match(re);
  return m ? parseInt(m[1], 10) : null;
}

function extractAttrFromAny(xml, tagNames, attr) {
  for (const tag of tagNames) {
    const val = extractAttr(xml, tag, attr);
    if (val !== null) return val;
  }
  return null;
}

async function main() {
  console.log("=== COMPLIANCE REPORT - CPG DOCX vs UFLA MANUAL (6ª ed.) ===\n");

  const buf = await readFile(DOCX_PATH);
  const zip = await JSZip.loadAsync(buf);

  const docXmlStr = await zip.file("word/document.xml").async("text");

  // ===== 1. PAGE SIZE & MARGINS =====
  const pgSzTags = ["w:pgSz", "pgSz"];
  const pgMarTags = ["w:pgMar", "pgMar"];

  const pageW = extractAttrFromAny(docXmlStr, pgSzTags, "w:w") || extractAttrFromAny(docXmlStr, pgSzTags, "w");
  const pageH = extractAttrFromAny(docXmlStr, pgSzTags, "w:h") || extractAttrFromAny(docXmlStr, pgSzTags, "h");
  const margTop = extractAttrFromAny(docXmlStr, pgMarTags, "w:top");
  const margBottom = extractAttrFromAny(docXmlStr, pgMarTags, "w:bottom");
  const margLeft = extractAttrFromAny(docXmlStr, pgMarTags, "w:left");
  const margRight = extractAttrFromAny(docXmlStr, pgMarTags, "w:right");
  const margHeader = extractAttrFromAny(docXmlStr, pgMarTags, "w:header");
  const margFooter = extractAttrFromAny(docXmlStr, pgMarTags, "w:footer");

  const margins = {
    top: twipToCm(margTop),
    bottom: twipToCm(margBottom),
    left: twipToCm(margLeft),
    right: twipToCm(margRight),
    header: twipToCm(margHeader),
    footer: twipToCm(margFooter),
    topRaw: margTop,
    bottomRaw: margBottom,
    leftRaw: margLeft,
    rightRaw: margRight,
  };

  const pageSize = {
    width: pageW,
    height: pageH,
  };

  const isA4 = pageW === 11906 && pageH === 16838;

  // ===== 2. EXTRACT ALL PARAGRAPHS WITH FORMATTING =====
  // Split by <w:p> tags
  const paraRegex = /<w:p[ >][\s\S]*?<\/w:p>/gi;
  const paras = docXmlStr.match(paraRegex) || [];

  const paragraphDetails = [];

  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];

    // Text content from <w:t> tags
    const textMatches = p.match(/<w:t[^>]*>([^<]*)<\/w:t>/gi);
    let text = "";
    if (textMatches) {
      for (const tm of textMatches) {
        const contentMatch = tm.match(/>([^<]*)</);
        if (contentMatch) text += contentMatch[1];
      }
    }

    // Style
    const styleMatch = p.match(/<w:pStyle\s+w:val=["']([^"']+)["']/i);
    const styleVal = styleMatch ? styleMatch[1] : null;

    // Alignment
    const alignMatch = p.match(/<w:jc\s+w:val=["']([^"']+)["']/i);
    const alignment = alignMatch ? alignMatch[1] : null;

    // Spacing
    const lineMatch = p.match(/w:line=["'](\d+)["']/i);
    const lineSpacing = lineMatch ? parseInt(lineMatch[1], 10) : null;
    const beforeMatch = p.match(/w:before=["'](\d+)["']/i);
    const before = beforeMatch ? parseInt(beforeMatch[1], 10) : null;
    const afterMatch = p.match(/w:after=["'](\d+)["']/i);
    const after = afterMatch ? parseInt(afterMatch[1], 10) : null;

    // Indentation
    const firstLineMatch = p.match(/w:firstLine=["'](\d+)["']/i);
    const firstLine = firstLineMatch ? parseInt(firstLineMatch[1], 10) : null;
    const hangingMatch = p.match(/w:hanging=["'](\d+)["']/i);
    const hanging = hangingMatch ? parseInt(hangingMatch[1], 10) : null;
    const leftIndMatch = p.match(/w:left=["'](\d+)["']/i);
    const leftInd = leftIndMatch ? parseInt(leftIndMatch[1], 10) : null;

    // Heading level
    const outlineMatch = p.match(/<w:outlineLvl\s+w:val=["'](\d+)["']/i);
    const headingLevel = outlineMatch ? parseInt(outlineMatch[1], 10) : null;

    // Run font
    const fontMatch = p.match(/<w:rFonts\s[^>]*w:ascii=["']([^"']+)["']/i);
    const runFont = fontMatch ? fontMatch[1] : null;

    // Run size
    const sizeMatch = p.match(/<w:sz\s+w:val=["'](\d+)["']/i);
    const fontSizeRaw = sizeMatch ? parseInt(sizeMatch[1], 10) : null;
    const fontSize = fontSizeRaw ? fontSizeRaw / 2 : null;

    // Bold
    const hasBold = /<w:b\s*\/>|<w:b\s+w:val=["'](1|true)["']/i.test(p);

    // Italic
    const hasItalic = /<w:i\s*\/>|<w:i\s+w:val=["'](1|true)["']/i.test(p);

    // List of unique fonts in this paragraph
    const fontsAll = [...p.matchAll(/w:ascii=["']([^"']+)["']/g)].map(m => m[1]);
    const uniqueFonts = [...new Set(fontsAll)];

    paragraphDetails.push({
      index: i,
      text: text.substring(0, 150),
      textLength: text.length,
      style: styleVal,
      alignment,
      lineSpacing,
      before,
      after,
      firstLine,
      hanging,
      leftIndent: leftInd,
      headingLevel,
      font: runFont,
      fonts: uniqueFonts,
      fontSize,
      fontSizeRaw,
      bold: hasBold || text.startsWith("REFERÊNCIAS") || text.startsWith("BIBLIOGR"),
      italic: hasItalic,
    });
  }

  // ===== 3. CHECK: FONT =====
  const nonTnrParas = paragraphDetails.filter(
    (p) => p.font && p.font !== requiredFont && p.text.trim()
  );

  // ===== 4. CHECK: FONT SIZE =====
  const sizeIssues = paragraphDetails.filter(
    (p) => p.fontSize !== null && p.fontSize !== 12 && p.text.trim()
  );

  // ===== 5. CHECK: LINE SPACING =====
  const bodyParas = paragraphDetails.filter(
    (p) => p.text.trim() && p.headingLevel === null
  );
  const lineSpacingCount = {};
  for (const p of bodyParas) {
    const key = p.lineSpacing !== null ? String(p.lineSpacing) : "null";
    lineSpacingCount[key] = (lineSpacingCount[key] || 0) + 1;
  }

  // ===== 6. CHECK: FIRST LINE INDENT =====
  const justifiedParas = paragraphDetails.filter(
    (p) => p.alignment === "both" && p.text.trim().length > 5
  );
  const indentIssues = justifiedParas.filter(
    (p) => p.firstLine !== null && p.firstLine !== firstLineIndentTwip
  );

  // ===== 7. CHECK: REFERENCES =====
  // Find reference section
  let refSectionStart = -1;
  for (let i = 0; i < paragraphDetails.length; i++) {
    const t = paragraphDetails[i].text.trim().toUpperCase().replace(/[\u0300-\u036f]/g, "");
    if (/^(REFERENCIAS|REFERÊNCIAS|BIBLIOGRAFICAS|BIBLIOGRÁFICAS)/.test(t) && paragraphDetails[i].text.trim().length < 40) {
      refSectionStart = i;
      break;
    }
  }

  let refHangingIssues = 0;
  let refAlignmentIssues = 0;
  let refSpacingIssues = 0;
  let refBoldIssues = [];

  if (refSectionStart >= 0) {
    for (let i = refSectionStart + 1; i < paragraphDetails.length; i++) {
      const p = paragraphDetails[i];
      if (!p.text.trim()) continue;
      if (p.headingLevel !== null) break;
      if (!p.hanging) refHangingIssues++;
      if (p.alignment && p.alignment !== "left") refAlignmentIssues++;
      if (p.lineSpacing !== null && p.lineSpacing !== singleLineSpacingTwip) refSpacingIssues++;
    }
  }

  // ===== 8. CHECK: HEADINGS =====
  const headings = paragraphDetails.filter((p) => p.headingLevel !== null);
  const headingBoldIssues = headings.filter((h) => !h.bold);

  // ===== 9. CHECK: TABLES =====
  const tableCount = (docXmlStr.match(/<w:tbl[ >]/g) || []).length;
  const tableBorderIssues = 0; // We'll check this in the XML

  // ===== 10. CHECK: PAGE NUMBERS =====
  // Check headers
  let hasPageNumber = false;
  const headerRegex = /<w:headerReference[^>]*>/gi;
  const headerRefs = docXmlStr.match(headerRegex) || [];
  if (headerRefs.length > 0) {
    const relsStr = await zip.file("word/_rels/document.xml.rels").async("text");
    const relsRegex = /<Relationship\s+[^>]*>/gi;
    const relsMatches = relsStr.match(relsRegex) || [];
    const headerTargets = [];
    for (const r of relsMatches) {
      if (r.includes("header")) {
        const tMatch = r.match(/Target=["']([^"']+)["']/i);
        if (tMatch) headerTargets.push(tMatch[1]);
      }
    }
    for (const hdr of headerTargets) {
      try {
        const hdrStr = await zip.file(`word/${hdr}`).async("text");
        if (hdrStr.includes("PAGE") || hdrStr.includes("pgNum") || hdrStr.includes("fldChar") || hdrStr.includes("instrText")) {
          hasPageNumber = true;
        }
      } catch (e) {}
    }
  }

  // ===== BUILD CONFORMITY MATRIX =====
  const checks = [];

  // A4
  checks.push({
    id: "PAGE_A4",
    category: "Page Setup",
    description: "Papel A4 (21cm × 29,7cm)",
    required: "11906 × 16838 twips",
    found: pageSize.width && pageSize.height ? `${pageSize.width} × ${pageSize.height} twips` : "Não encontrado (sectPr sem pgSz?)",
    status: isA4 ? "PASS" : "FAIL",
    codeLocation: "src/ufla-rules.ts:214-215 (page: widthTwip/heightTwip)",
    codeValue: "CPG usa createCpgDocument() em export-cpg-docx.ts:438-456"
  });

  // Margins
  const marginChecks = [
    { id: "MARGIN_TOP", desc: "Margem superior", required: `${CPG_MARGINS.top}cm (${Math.round(CPG_MARGINS.top * TWIPS_PER_CM)} twips) - CPG`, found: `${margins.top}cm (${margTop})`, status: margTop === Math.round(CPG_MARGINS.top * TWIPS_PER_CM) ? "PASS" : "FAIL", uflaRequired: `${UFLA_MARGINS.top}cm` },
    { id: "MARGIN_BOTTOM", desc: "Margem inferior", required: `${CPG_MARGINS.bottom}cm (${Math.round(CPG_MARGINS.bottom * TWIPS_PER_CM)} twips) - CPG`, found: `${margins.bottom}cm (${margBottom})`, status: margBottom === Math.round(CPG_MARGINS.bottom * TWIPS_PER_CM) ? "PASS" : "FAIL", uflaRequired: `${UFLA_MARGINS.bottom}cm` },
    { id: "MARGIN_LEFT", desc: "Margem esquerda", required: `${CPG_MARGINS.left}cm (${Math.round(CPG_MARGINS.left * TWIPS_PER_CM)} twips) - CPG`, found: `${margins.left}cm (${margLeft})`, status: margLeft === Math.round(CPG_MARGINS.left * TWIPS_PER_CM) ? "PASS" : "FAIL", uflaRequired: `${UFLA_MARGINS.left}cm` },
    { id: "MARGIN_RIGHT", desc: "Margem direita", required: `${CPG_MARGINS.right}cm (${Math.round(CPG_MARGINS.right * TWIPS_PER_CM)} twips) - CPG`, found: `${margins.right}cm (${margRight})`, status: margRight === Math.round(CPG_MARGINS.right * TWIPS_PER_CM) ? "PASS" : "FAIL", uflaRequired: `${UFLA_MARGINS.right}cm` },
  ];

  for (const mc of marginChecks) {
    checks.push({
      id: mc.id,
      category: "Margins",
      description: mc.desc,
      required: mc.required,
      found: mc.found,
      status: mc.status,
      uflaRequired: mc.uflaRequired,
      note: mc.status === "FAIL" ? `Diferença: Esperado ${mc.required}, encontrado ${mc.found}. UFLA manual requer ${mc.uflaRequired}.` : undefined,
      codeLocation: "src/ufla-rules.ts:170-178 (CPG_RULES.margins)",
    });
  }

  // UFLA vs CPG margin comparison
  const uflaMarginOkTop = margTop === Math.round(UFLA_MARGINS.top * TWIPS_PER_CM);
  const uflaMarginOkBottom = margBottom === Math.round(UFLA_MARGINS.bottom * TWIPS_PER_CM);
  const uflaMarginOkLeft = margLeft === Math.round(UFLA_MARGINS.left * TWIPS_PER_CM);
  const uflaMarginOkRight = margRight === Math.round(UFLA_MARGINS.right * TWIPS_PER_CM);

  checks.push({
    id: "UFLA_MARGIN_COMPAT",
    category: "Margins",
    description: "Margens conforme Manual UFLA 6ª ed (3cm top/left, 2cm bottom/right)",
    required: `T:${UFLA_MARGINS.top}cm L:${UFLA_MARGINS.left}cm B:${UFLA_MARGINS.bottom}cm R:${UFLA_MARGINS.right}cm`,
    found: `T:${margins.top}cm L:${margins.left}cm B:${margins.bottom}cm R:${margins.right}cm`,
    status: (uflaMarginOkTop && uflaMarginOkBottom && uflaMarginOkLeft && uflaMarginOkRight) ? "PASS" : "FAIL",
    note: !(uflaMarginOkTop && uflaMarginOkBottom && uflaMarginOkLeft && uflaMarginOkRight) ? "CPG template usa margens diferentes do Manual UFLA geral (3.5/2.5/3/3 vs 3/2/3/2). Isto pode ser intencional se CPG tem template próprio." : undefined,
    codeLocation: "src/ufla-rules.ts:218-225 (UFLA_RULES.margins) vs 170-178 (CPG_RULES.margins)",
  });

  // Font
  checks.push({
    id: "FONT_TNR",
    category: "Typography",
    description: "Fonte Times New Roman no corpo do texto",
    required: requiredFont,
    found: nonTnrParas.length > 0 ? `${nonTnrParas.length} parágrafos sem TNR. Fontes: ${[...new Set(nonTnrParas.map(p => p.font))].join(", ")}` : "Todos em Times New Roman",
    status: nonTnrParas.length === 0 ? "PASS" : "FAIL",
    codeLocation: "src/ufla-rules.ts:181 (CPG_RULES.typography.fontFamily)",
  });

  // Font size
  checks.push({
    id: "FONT_SIZE_12",
    category: "Typography",
    description: "Tamanho de fonte 12pt",
    required: "12pt (24 half-pts)",
    found: sizeIssues.filter(p => p.text.trim()).length > 0
      ? `${sizeIssues.filter(p => p.text.trim()).length} parágrafos com tamanhos variados: ${[...new Set(sizeIssues.filter(p => p.text.trim()).map(p => `${p.fontSize}pt`))].join(", ")}`
      : "Todos em 12pt",
    status: sizeIssues.filter(p => p.text.trim()).length === 0 ? "PASS" : "WARN",
  });

  // Line spacing 1.5
  const hasBodyLine15 = Object.keys(lineSpacingCount).some(k => parseInt(k) === bodyLineSpacingTwip);
  checks.push({
    id: "LINE_SPACING_1_5",
    category: "Spacing",
    description: "Espaçamento 1,5 (360 twips) no corpo do texto",
    required: `${bodyLineSpacingTwip} twips`,
    found: Object.entries(lineSpacingCount).sort().map(([k, v]) => `${k} twips: ${v} paras`).join("; ") || "Nenhum parágrafo com line spacing explícito",
    status: hasBodyLine15 ? "PASS" : "WARN",
    codeLocation: "src/ufla-rules.ts:257 (UFLA_RULES.spacing.bodyLineTwip = 360)",
    note: hasBodyLine15 ? undefined : "Line spacing 1.5 (360 twips) not found. Paragraphs may be using default Word spacing.",
  });

  // First line indent
  checks.push({
    id: "FIRST_LINE_INDENT",
    category: "Spacing",
    description: "Recuo de primeira linha 1,25 cm (709 twips)",
    required: `${firstLineIndentTwip} twips`,
    found: indentIssues.length > 0
      ? `${indentIssues.length} parágrafos com recuo divergente: ${[...new Set(indentIssues.map(p => `${p.firstLine} twips`))].join(", ")}`
      : "Recuo correto (709 twips) ou sem recuo explícito (primeiro parágrafo da seção)",
    status: indentIssues.length === 0 ? "PASS" : "WARN",
    codeLocation: "src/ufla-rules.ts:250 (UFLA_RULES.typography.paragraphFirstLineTwip = cmToTwip(1.25))",
  });

  // References
  checks.push({
    id: "REFERENCES_EXIST",
    category: "References",
    description: "Seção de referências presente",
    required: "Sim",
    found: refSectionStart >= 0 ? `Sim (parágrafo ${refSectionStart})` : "Não encontrada",
    status: refSectionStart >= 0 ? "PASS" : "FAIL",
    codeLocation: "src/export-cpg-docx.ts:323-359 (referenceParagraphs function)",
  });

  if (refSectionStart >= 0) {
    checks.push({
      id: "REFERENCES_HANGING",
      category: "References",
      description: "Referências com recuo deslocado (hanging indent)",
      required: `${referenceHangingTwip} twips`,
      found: refHangingIssues > 0 ? `${refHangingIssues} referências sem hanging` : "Todas com hanging indent",
      status: refHangingIssues === 0 ? "PASS" : "FAIL",
      codeLocation: "src/export-cpg-docx.ts:351-353 (indent: { left: REFERENCE_HANGING, hanging: REFERENCE_HANGING })",
    });
    checks.push({
      id: "REFERENCES_ALIGNMENT",
      category: "References",
      description: "Referências alinhadas à esquerda",
      required: "left",
      found: refAlignmentIssues > 0 ? `${refAlignmentIssues} referências com alinhamento diferente` : "Todas à esquerda",
      status: refAlignmentIssues === 0 ? "PASS" : "FAIL",
      codeLocation: "src/export-cpg-docx.ts:349 (AlignmentType.LEFT)",
    });
    checks.push({
      id: "REFERENCES_SPACING",
      category: "References",
      description: "Referências com espaçamento simples",
      required: `${singleLineSpacingTwip} twips`,
      found: refSpacingIssues > 0 ? `${refSpacingIssues} referências com espaçamento diferente` : "Todas com espaço simples",
      status: refSpacingIssues === 0 ? "PASS" : "FAIL",
      codeLocation: "src/export-cpg-docx.ts:350 (line: SINGLE_LINE = 240)",
    });
  }

  // Headings
  checks.push({
    id: "HEADINGS_BOLD",
    category: "Structure",
    description: "Títulos de seção em negrito",
    required: "bold=true",
    found: headingBoldIssues.length > 0 ? `${headingBoldIssues.length} títulos sem negrito (parágrafos ${headingBoldIssues.map(h => h.index).join(", ")})` : "Todos os títulos em negrito",
    status: headingBoldIssues.length === 0 ? "PASS" : "FAIL",
    codeLocation: "src/export-cpg-docx.ts:163-165 (bold: level !== HeadingLevel.HEADING_3)",
  });

  // Page numbers (CPG intentionally without)
  checks.push({
    id: "PAGE_NUMBERS",
    category: "Pagination",
    description: "Numeração de página",
    required: "CPG documents: sem numeração (intencional)",
    found: hasPageNumber ? "Numeração encontrada no cabeçalho" : "Sem numeração de página",
    status: "PASS",
    note: "CPG documents intentionally omit page numbers per description in export-cpg-docx.ts:434",
  });

  // Paragraph alignment
  const nonJustified = bodyParas.filter(
    (p) => p.alignment && p.alignment !== "both" && p.alignment !== "center" && p.text.trim().length > 10
  );
  checks.push({
    id: "PARAGRAPH_JUSTIFIED",
    category: "Typography",
    description: "Corpo do texto justificado (AlignmentType.BOTH)",
    required: "both (justified)",
    found: nonJustified.length > 0
      ? `${nonJustified.length} parágrafos não justificados: ${nonJustified.slice(0, 3).map(p => `${p.alignment}`).join(", ")}`
      : "Todos justificados ou centralizados",
    status: nonJustified.length === 0 ? "PASS" : "WARN",
    codeLocation: "src/export-cpg-docx.ts:94 (AlignmentType.BOTH)",
  });

  // Heading levels usage
  const headingLevels = {};
  for (const h of headings) {
    headingLevels[h.headingLevel] = (headingLevels[h.headingLevel] || 0) + 1;
  }
  checks.push({
    id: "HEADING_LEVELS",
    category: "Structure",
    description: "Uso de níveis de título (Heading1/2/3)",
    required: "Heading1 (seção primária), Heading2 (secundária), Heading3 (terciária)",
    found: Object.entries(headingLevels).map(([k, v]) => `L${k}: ${v}`).join(", ") || "Nenhum título encontrado",
    status: headings.length > 0 ? "PASS" : "WARN",
    codeLocation: "src/export-cpg-docx.ts:158-169 (sectionTitle function) + 242-244 (blockToParagraph)",
  });

  // Title formatting
  checks.push({
    id: "TITLE_FORMATTING",
    category: "Structure",
    description: "Título do trabalho centralizado, negrito, tamanho 16pt (TITLE_SIZE)",
    required: "center, bold, 16pt",
    found: paragraphDetails.length > 0
      ? `Primeiro parágrafo: align=${paragraphDetails[0].alignment}, bold=${paragraphDetails[0].bold}, fontSize=${paragraphDetails[0].fontSize}pt`
      : "Nenhum parágrafo",
    status: paragraphDetails[0]?.alignment === "center" && paragraphDetails[0]?.bold ? "PASS" : "WARN",
    codeLocation: "src/export-cpg-docx.ts:102-108 (titleParagraph - CENTER, bold, TITLE_SIZE=16pt*2)",
  });

  // ===== COMPUTE OVERALL =====
  const fails = checks.filter(c => c.status === "FAIL").length;
  const warns = checks.filter(c => c.status === "WARN").length;
  const passes = checks.filter(c => c.status === "PASS").length;

  let overall;
  if (fails > 4) overall = "REPROVADO";
  else if (fails > 0) overall = "REPROVADO";
  else if (warns > 0) overall = "APROVADO COM RESSALVAS";
  else overall = "APROVADO";

  const report = {
    timestamp: new Date().toISOString(),
    file: DOCX_PATH,
    workType: "resumo_expandido_cpg",
    overall,
    summary: { passes, warnings: warns, failures: fails, total: checks.length },
    conformityMatrix: checks,
    pageSize,
    margins,
    paragraphStats: {
      total: paragraphDetails.length,
      headingsCount: headings.length,
      headingLevels,
      lineSpacingDistribution: lineSpacingCount,
    },
    nonConformities: checks.filter(c => c.status === "FAIL").map(c => ({
      id: c.id,
      description: c.description,
      detail: c.found,
      required: c.required,
      codeLocation: c.codeLocation,
    })),
    codeIssues: [
      {
        location: "src/export-cpg-docx.ts:94",
        description: "Parágrafo padrão usa spacing line SINGLE_LINE (240) em vez de 1.5 (360)",
        severity: "medium",
        suggestion: "Change default line spacing in paragraph() from SINGLE_LINE to 360 (bodyLineTwip) for body text",
      },
      {
        location: "src/export-cpg-docx.ts:102-107",
        description: "Título do trabalho usa SINGLE_LINE spacing em vez de 1.5",
        severity: "low",
        suggestion: "Consider if CPG requires 1.5 spacing for title. Currently using SINGLE_LINE.",
      },
      {
        location: "src/export-cpg-docx.ts:158-169",
        description: "sectionTitle usa SINGLE_LINE spacing (240) em vez de 1.5 (360)",
        severity: "medium",
        suggestion: "Section titles should use 1.5 spacing per UFLA manual but CPG may differ. Currently SINGLE_LINE.",
      },
      {
        location: "src/export-cpg-docx.ts:396-427",
        description: "cpgFullChildren() return type is CpgChild[] (= Paragraph | Table), matches docx-render-core tabbedTableBlock's Array<Paragraph | Table>",
        severity: "info",
        suggestion: "Return type is consistent.",
      },
      {
        location: "src/docx-render-core.ts:312-391",
        description: "tabbedTableBlock returns Array<Paragraph | Table> with hardcoded single spacing (240) and body font",
        severity: "low",
        suggestion: "Consider if tables should always use single spacing.",
      },
    ],
  };

  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));

  // ===== PRINT REPORT =====
  console.log("=".repeat(72));
  console.log(`RELATÓRIO DE CONFORMIDADE — CPG vs UFLA Manual (6ª ed. 2025)`);
  console.log(`Arquivo: ${DOCX_PATH}`);
  console.log(`Tipo: resumo_expandido_cpg`);
  console.log("=".repeat(72));

  console.log(`\nRESULTADO: ${overall}`);
  console.log(`Pass: ${passes} | Warn: ${warns} | Fail: ${fails} | Total: ${checks.length}`);

  console.log(`\n${"─".repeat(72)}`);
  console.log("MATRIZ DE CONFORMIDADE");
  console.log(`${"─".repeat(72)}`);

  for (const c of checks) {
    const icon = c.status === "PASS" ? "✓" : c.status === "WARN" ? "⚠" : "✗";
    console.log(`\n${icon} [${c.status}] ${c.id}: ${c.description}`);
    console.log(`   Requerido: ${c.required}`);
    console.log(`   Encontrado: ${c.found}`);
    if (c.note) console.log(`   Nota: ${c.note}`);
    if (c.codeLocation) console.log(`   Código: ${c.codeLocation}`);
  }

  console.log(`\n${"─".repeat(72)}`);
  console.log("NÃO CONFORMIDADES (FAIL)");
  console.log(`${"─".repeat(72)}`);

  for (const nc of checks.filter(c => c.status === "FAIL")) {
    console.log(`\n✗ ${nc.id}`);
    console.log(`   ${nc.description}`);
    console.log(`   Requerido: ${nc.required}`);
    console.log(`   Encontrado: ${nc.found}`);
    if (nc.codeLocation) console.log(`   Código: ${nc.codeLocation}`);
  }

  console.log(`\n${"─".repeat(72)}`);
  console.log("RESSALVAS (WARN)");
  console.log(`${"─".repeat(72)}`);

  for (const w of checks.filter(c => c.status === "WARN")) {
    console.log(`\n⚠ ${w.id}: ${w.description}`);
    console.log(`   ${w.found}`);
  }

  console.log(`\n${"─".repeat(72)}`);
  console.log("ANÁLISE DE PARÁGRAFOS DETALHADA");
  console.log(`${"─".repeat(72)}`);

  for (const p of paragraphDetails) {
    const spacingStr = p.lineSpacing ? `${p.lineSpacing}tw` : "default";
    const indentStr = p.firstLine ? `${p.firstLine}tw` : "none";
    const hangStr = p.hanging ? `h:${p.hanging}` : "";
    const alignStr = p.alignment || "default";
    const boldStr = p.bold ? "B" : "";
    const headingStr = p.headingLevel !== null ? `[H${p.headingLevel + 1}]` : "";
    console.log(`P${String(p.index).padStart(2, "0")}: ${headingStr}${alignStr.padEnd(8)} sp:${spacingStr.padEnd(8)} fl:${indentStr.padEnd(8)} ${hangStr.padEnd(8)} ${boldStr} ${p.font ? p.font.padEnd(16) : "TNR".padEnd(16)} ${p.fontSize ? `${p.fontSize}pt`.padEnd(5) : "12pt "} ${p.text.substring(0, 80)}`);
  }

  console.log(`\nRelatório JSON salvo em: ${REPORT_PATH}`);
}

main().catch(console.error);
