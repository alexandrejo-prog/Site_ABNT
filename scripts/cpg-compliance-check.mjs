import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");
const TMP_DIR = join(root, "tmp", "cpg-comparison");
const REPORT_PATH = join(TMP_DIR, "compliance-report.json");

const TWIPS_PER_CM = 567;
function twipToCm(t) { return Math.round((t / TWIPS_PER_CM) * 100) / 100; }

async function inspectDocx(bufOrPath) {
  const buf = typeof bufOrPath === "string" ? readFileSync(bufOrPath) : bufOrPath;
  const zip = await JSZip.loadAsync(buf);
  const doc = await zip.file("word/document.xml").async("text");

  // sectPr — extract with flexible attribute order
  const pgSzMatch = doc.match(/<w:pgSz[^>]*w:w="(\d+)"[^>]*w:h="(\d+)"/)
    || doc.match(/<w:pgSz[^>]*w:h="(\d+)"[^>]*w:w="(\d+)"/);
  const pgMarMatch = doc.match(/<w:pgMar[^>]*>/);

  let margins = null;
  if (pgMarMatch) {
    const tag = pgMarMatch[0];
    const top = tag.match(/w:top="(\d+)"/);
    const bottom = tag.match(/w:bottom="(\d+)"/);
    const left = tag.match(/w:left="(\d+)"/);
    const right = tag.match(/w:right="(\d+)"/);
    margins = {
      top: top ? parseInt(top[1]) : null,
      bottom: bottom ? parseInt(bottom[1]) : null,
      left: left ? parseInt(left[1]) : null,
      right: right ? parseInt(right[1]) : null,
    };
  }

  const pageSize = pgSzMatch
    ? { w: parseInt(pgSzMatch[1] || pgSzMatch[2]), h: parseInt(pgSzMatch[2] || pgSzMatch[1]) }
    : null;

  // Paragraphs
  const paraRegex = /<w:p[ >][\s\S]*?<\/w:p>/gi;
  const paras = doc.match(paraRegex) || [];

  const paragraphs = paras.map((p, i) => {
    const textMatches = p.match(/<w:t[^>]*>([^<]*)<\/w:t>/gi);
    let text = "";
    if (textMatches) {
      for (const tm of textMatches) {
        const c = tm.match(/>([^<]*)</);
        if (c) text += c[1];
      }
    }
    const pprMatch = p.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
    const ppr = pprMatch ? pprMatch[0] : "";

    const alignMatch = ppr.match(/<w:jc\s+w:val=["']([^"']+)["']/i);
    const lineMatch = ppr.match(/w:line="(\d+)"/);
    const beforeMatch = ppr.match(/w:before="(\d+)"/);
    const afterMatch = ppr.match(/w:after="(\d+)"/);
    const firstLineMatch = ppr.match(/w:firstLine="(\d+)"/);
    const hangingMatch = ppr.match(/w:hanging="(\d+)"/);
    const leftIndMatch = ppr.match(/w:left="(\d+)"/);
    const outlineMatch = ppr.match(/<w:outlineLvl\s+w:val=["'](\d+)["']/i);

    // Run-level formatting from first run
    const firstRunMatch = p.match(/<w:rPr[\s\S]*?<\/w:rPr>/);
    const rpr = firstRunMatch ? firstRunMatch[0] : "";
    const bold = /<w:b\s*\/>|<w:b\s+w:val=["'](1|true)["']/i.test(rpr);
    const italic = /<w:i\s*\/>|<w:i\s+w:val=["'](1|true)["']/i.test(rpr);
    const fontMatch = rpr.match(/w:ascii=["']([^"']+)["']/i);
    const sizeMatch = rpr.match(/w:sz\s+w:val=["'](\d+)["']/i);

    return {
      index: i,
      text: text.substring(0, 120),
      alignment: alignMatch ? alignMatch[1] : null,
      lineSpacing: lineMatch ? parseInt(lineMatch[1]) : null,
      before: beforeMatch ? parseInt(beforeMatch[1]) : null,
      after: afterMatch ? parseInt(afterMatch[1]) : null,
      firstLine: firstLineMatch ? parseInt(firstLineMatch[1]) : null,
      hanging: hangingMatch ? parseInt(hangingMatch[1]) : null,
      leftIndent: leftIndMatch ? parseInt(leftIndMatch[1]) : null,
      bold,
      italic,
      font: fontMatch ? fontMatch[1] : null,
      fontSize: sizeMatch ? parseInt(sizeMatch[1]) / 2 : null,
      headingLevel: outlineMatch ? parseInt(outlineMatch[1]) : null,
    };
  });

  // Headers/footers
  const hasHeaderRef = /<w:headerReference/.test(doc);
  const hasFooterRef = /<w:footerReference/.test(doc);

  let hasPageNumber = false;
  const relsEntry = zip.file("word/_rels/document.xml.rels");
  if (relsEntry) {
    const relsStr = await relsEntry.async("text");
    const relsMatches = relsStr.match(/<Relationship\s+[^>]*>/gi) || [];
    for (const r of relsMatches) {
      if (r.includes("header")) {
        const tMatch = r.match(/Target=["']([^"']+)["']/i);
        if (tMatch) {
          try {
            const hdrStr = await zip.file(`word/${tMatch[1]}`).async("text");
            if (hdrStr.includes("instrText") || hdrStr.includes("fldChar")) hasPageNumber = true;
          } catch (e) {}
        }
      }
    }
  }

  return {
    pageSize, margins, paragraphs, hasHeaderRef, hasFooterRef, hasPageNumber,
    fonts: [...new Set(paragraphs.filter(p => p.font).map(p => p.font))],
    fontSizes: [...new Set(paragraphs.filter(p => p.fontSize).map(p => p.fontSize))],
    alignments: [...new Set(paragraphs.filter(p => p.alignment).map(p => p.alignment))],
    lineSpacings: [...new Set(paragraphs.filter(p => p.lineSpacing !== null).map(p => p.lineSpacing))],
    firstLineValues: [...new Set(paragraphs.filter(p => p.firstLine !== null).map(p => p.firstLine))],
  };
}

// ============================================================
// CPG Expected Rules
// ============================================================
const CPG = {
  pageW: 11906, pageH: 16838,
  margins: { top: 1985, bottom: 1418, left: 1701, right: 1701 }, // twips (3.5cm / 2.5cm / 3cm / 3cm)
  font: "Times",
  bodySize: 12,
  titleSize: 16,
  sectionTitleSize: 13,
  subsectionSize: 12,
  emailSize: 10,
  captionSize: 10,
  singleSpacing: 240,
  bodySpacing: 360, // only for resumo_cpg affiliations
  firstLineCm: 1.27,
  firstLineTwip: 720, // cmToTwip(1.27) = Math.round(1.27 * 567) = 720
  abstractSideCm: 0.8,
  abstractSideTwip: 454, // cmToTwip(0.8) = Math.round(0.8 * 567) = 454
  refHangingCm: 0.5,
  refHangingTwip: 284, // cmToTwip(0.5) = Math.round(0.5 * 567) = 284
  noPageNumbers: true,
  noHeaders: true,
};

// ============================================================
// Run compliance checks
// ============================================================
function checkCompliance(s, workType) {
  const checks = [];

  // Page size
  checks.push({
    id: "PAGE_A4",
    pass: s.pageSize?.w === CPG.pageW && s.pageSize?.h === CPG.pageH,
    expected: `A4 (${CPG.pageW}x${CPG.pageH})`,
    found: s.pageSize ? `${s.pageSize.w}x${s.pageSize.h}` : "N/A",
  });

  // Margins
  if (s.margins) {
    for (const side of ["top", "bottom", "left", "right"]) {
      checks.push({
        id: `MARGIN_${side.toUpperCase()}`,
        pass: s.margins[side] === CPG.margins[side],
        expected: `${CPG.margins[side]} (${twipToCm(CPG.margins[side])}cm)`,
        found: `${s.margins[side]} (${twipToCm(s.margins[side])}cm)`,
      });
    }
  }

  // No page numbers
  checks.push({
    id: "NO_PAGE_NUMBERS",
    pass: !s.hasPageNumber,
    expected: "None",
    found: s.hasPageNumber ? "Found" : "None",
  });

  // No header references
  checks.push({
    id: "NO_HEADER_REF",
    pass: !s.hasHeaderRef,
    expected: "None",
    found: s.hasHeaderRef ? "Present" : "None",
  });

  // Font = Times
  const fontsOk = s.fonts.length > 0 && s.fonts.every(f => f === CPG.font || f === "Courier New");
  checks.push({
    id: "FONT_FAMILY",
    pass: fontsOk,
    expected: "Times (+ Courier New for email)",
    found: s.fonts.join(", "),
  });

  // Body size 12pt
  checks.push({
    id: "BODY_SIZE_12",
    pass: s.fontSizes.includes(CPG.bodySize),
    expected: `${CPG.bodySize}pt`,
    found: s.fontSizes.join(", ") + "pt",
  });

  // Title size 16pt
  checks.push({
    id: "TITLE_SIZE_16",
    pass: s.fontSizes.includes(CPG.titleSize),
    expected: `${CPG.titleSize}pt`,
    found: s.fontSizes.join(", ") + "pt",
  });

  // Single line spacing present
  checks.push({
    id: "SINGLE_SPACING",
    pass: s.lineSpacings.includes(CPG.singleSpacing),
    expected: `${CPG.singleSpacing} twips (single)`,
    found: s.lineSpacings.join(", ") + " twips",
  });

  // Espaçamento das afiliações segue o template por tipo:
  // resumo_cpg = 1.5 (P003–P007); resumo_expandido/artigo_completo = simples (P003–P005).
  const centeredAffils = s.paragraphs.filter(p => p.alignment === "center");
  if (workType === "resumo_cpg") {
    const affilSpacingOk = centeredAffils.some(p => p.lineSpacing === CPG.bodySpacing);
    checks.push({
      id: "AFFILIATION_1_5_SPACING",
      pass: affilSpacingOk,
      expected: `${CPG.bodySpacing} twips (1.5) for affiliations`,
      found: centeredAffils.map(p => p.lineSpacing).join(", ") || "none",
    });
  } else {
    const any360 = s.paragraphs.some(p => p.lineSpacing === CPG.bodySpacing);
    checks.push({
      id: "NO_1_5_SPACING_ANYWHERE",
      pass: !any360,
      expected: "No 360 twips (1.5) anywhere, affiliations single-spaced",
      found: any360 ? `${s.paragraphs.filter(p => p.lineSpacing === CPG.bodySpacing).length} paras with 360` : "None",
    });
    checks.push({
      id: "AFFILIATION_SINGLE_SPACING",
      pass: centeredAffils.every(p => p.lineSpacing === CPG.singleSpacing),
      expected: `${CPG.singleSpacing} twips (single) on affiliations`,
      found: centeredAffils.map(p => p.lineSpacing).join(", ") || "none",
    });
  }

  // First line: body paragraphs should have 720 (1.27cm) or 0 (abstracts)
  const bodyFirstLines = s.paragraphs
    .filter(p => p.firstLine !== null && p.alignment === "both")
    .map(p => p.firstLine);
  const allValidFirstLines = bodyFirstLines.every(v => v === CPG.firstLineTwip || v === 0);
  checks.push({
    id: "FIRST_LINE_INDENT",
    pass: allValidFirstLines,
    expected: `${CPG.firstLineTwip} (1.27cm) or 0 (abstract/inset)`,
    found: [...new Set(bodyFirstLines)].join(", ") || "none",
  });

  // Abstract side indent
  const abstractParas = s.paragraphs.filter(p => p.leftIndent === CPG.abstractSideTwip);
  checks.push({
    id: "ABSTRACT_SIDE_INDENT",
    pass: abstractParas.length > 0,
    expected: `${CPG.abstractSideTwip} twips (${CPG.abstractSideCm}cm)`,
    found: `${abstractParas.length} paragraphs with this indent`,
  });

  // Title centered and bold
  const titlePara = s.paragraphs[0];
  checks.push({
    id: "TITLE_CENTERED_BOLD",
    pass: titlePara?.alignment === "center" && titlePara?.bold,
    expected: "center, bold",
    found: `align=${titlePara?.alignment}, bold=${titlePara?.bold}`,
  });

  // Author centered and bold
  const authorPara = s.paragraphs[1];
  checks.push({
    id: "AUTHOR_CENTERED_BOLD",
    pass: authorPara?.alignment === "center" && authorPara?.bold,
    expected: "center, bold",
    found: `align=${authorPara?.alignment}, bold=${authorPara?.bold}`,
  });

  // Caption: Helvetica 10pt bold, centered, 6pt before/after
  const captionParas = s.paragraphs.filter(p => /^(Figura|Tabela|Quadro|Gráfico)\s+\d/.test(p.text));
  checks.push({
    id: "CAPTION_FONT_BOLD",
    pass: captionParas.length === 0 || captionParas.every(p => p.bold && p.font === "Helvetica" && p.fontSize === 10),
    expected: "Helvetica 10pt bold",
    found: captionParas.length === 0 ? "no captions" : captionParas.map(p => `${p.font} ${p.fontSize}pt bold=${p.bold}`).join(", "),
  });
  checks.push({
    id: "CAPTION_CENTERED",
    pass: captionParas.length === 0 || captionParas.every(p => p.alignment === "center"),
    expected: "center",
    found: captionParas.length === 0 ? "no captions" : captionParas.map(p => p.alignment).join(", "),
  });

  return checks;
}

// ============================================================
// Main
// ============================================================
async function main() {
  const files = [
    { path: join(TMP_DIR, "resumo_simples.docx"), type: "resumo_cpg" },
    { path: join(TMP_DIR, "resumo_expandido.docx"), type: "resumo_expandido_cpg" },
    { path: join(TMP_DIR, "artigo_completo.docx"), type: "artigo_completo_cpg" },
    { path: join(TMP_DIR, "variant1_hidrologia.docx"), type: "resumo_expandido_cpg" },
    { path: join(TMP_DIR, "variant2_irrigacao.docx"), type: "artigo_completo_cpg" },
  ];

  const report = { timestamp: new Date().toISOString(), files: [] };

  for (const f of files) {
    console.log(`\n========== ${f.type} (${f.path.split(/[/\\]/).pop()}) ==========\n`);
    const s = await inspectDocx(f.path);

    console.log(`Page: ${s.pageSize?.w}x${s.pageSize?.h}`);
    console.log(`Margins: T=${s.margins?.top}(${twipToCm(s.margins?.top)}cm) B=${s.margins?.bottom}(${twipToCm(s.margins?.bottom)}cm) L=${s.margins?.left}(${twipToCm(s.margins?.left)}cm) R=${s.margins?.right}(${twipToCm(s.margins?.right)}cm)`);
    console.log(`Fonts: ${s.fonts.join(", ")}`);
    console.log(`Sizes: ${s.fontSizes.join(", ")}pt`);
    console.log(`Alignments: ${s.alignments.join(", ")}`);
    console.log(`Line spacings: ${s.lineSpacings.join(", ")} twips`);
    console.log(`FirstLine values: ${s.firstLineValues.join(", ")} twips`);
    console.log(`Headers: ${s.hasHeaderRef}, PageNumbers: ${s.hasPageNumber}`);
    console.log(`Paragraphs: ${s.paragraphs.length}`);

    // Print heading structure
    const headings = s.paragraphs.filter(p => p.headingLevel !== null);
    if (headings.length > 0) {
      console.log(`Headings: ${headings.map(h => `H${h.headingLevel + 1}:"${h.text}"`).join(", ")}`);
    }

    const checks = checkCompliance(s, f.type);
    const passes = checks.filter(c => c.pass).length;
    const fails = checks.filter(c => !c.pass);
    console.log(`\nCompliance: ${passes}/${checks.length} PASS`);
    for (const c of checks) {
      console.log(`  ${c.pass ? "✓" : "✗"} ${c.id}: expected=[${c.expected}] found=[${c.found}]`);
    }

    report.files.push({
      name: f.path.split(/[/\\]/).pop(),
      workType: f.type,
      stats: {
        paragraphs: s.paragraphs.length,
        fonts: s.fonts,
        fontSizes: s.fontSizes,
        alignments: s.alignments,
        lineSpacings: s.lineSpacings,
        firstLineValues: s.firstLineValues,
        margins: s.margins,
      },
      checks,
      passes,
      fails: fails.length,
    });
  }

  // Overall summary
  console.log("\n\n========== OVERALL SUMMARY ==========\n");
  let totalPass = 0, totalChecks = 0;
  for (const f of report.files) {
    totalPass += f.passes;
    totalChecks += f.passes + f.fails;
    const status = f.fails === 0 ? "✓ ALL PASS" : `✗ ${f.fails} FAIL`;
    console.log(`  ${f.name} (${f.workType}): ${status} [${f.passes}/${f.passes + f.fails}]`);
  }
  console.log(`\n  TOTAL: ${totalPass}/${totalChecks} PASS`);

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${REPORT_PATH}`);
}

main().catch(console.error);
