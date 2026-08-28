import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");
const TMP_DIR = join(root, "tmp", "cpg-comparison");
mkdirSync(TMP_DIR, { recursive: true });

const { generateCpgDocxBlob } = await import(pathToFileURL(join(root, "src", "export-cpg-docx.ts")).href);
const { emptyAcademicFields } = await import(pathToFileURL(join(root, "src", "ufla-rules.ts")).href);

const TWIPS_PER_CM = 567;
function twipToCm(twip) { return Math.round((twip / TWIPS_PER_CM) * 100) / 100; }

// ============================================================
// TEMPLATE DATA — realistic samples for each CPG type
// ============================================================

const BASE_FIELDS = {
  ...emptyAcademicFields(),
  author: "Ana Beatriz Costa; Carlos Eduardo Silva; Maria Fernanda Oliveira",
  location: "Lavras - MG",
  year: "2026",
  abstractText: `This study investigates the impact of climate change on coffee production in the south of Minas Gerais, Brazil. The research was conducted over a period of two years, from January 2024 to December 2025, covering twelve municipalities in the coffee-producing region. Data were collected through field surveys, satellite imagery analysis, and statistical modeling of temperature and precipitation anomalies. The results indicate a significant reduction of 15.3% in coffee yield during periods of elevated temperatures, with the most severe impacts observed in municipalities above 900 meters elevation. The adoption of agroforestry systems showed a protective effect, reducing yield losses by approximately 40% compared to full-sun cultivation. These findings underscore the urgency of implementing adaptive management strategies for coffee production systems in the face of ongoing climate variability.`,
  keywords: "climate change; coffee production; Minas Gerais; agroforestry; adaptation",
  resumo: `O presente estudo investiga o impacto das mudanças climáticas na produção de café no sul de Minas Gerais, Brasil. A pesquisa foi conduzida ao longo de dois anos, de janeiro de 2024 a dezembro de 2025, abrangendo doze municípios da região cafeeira. Os dados foram coletados por meio de levantamentos de campo, análises de imagens de satélite e modelagem estatística de anomalias de temperatura e precipitação. Os resultados indicam uma redução significativa de 15,3% na produtividade do café durante períodos de temperaturas elevadas, com os impactos mais severos observados em municípios acima de 900 metros de altitude. A adoção de sistemas agroflorestais apresentou efeito protetor, reduzindo as perdas de produtividade em aproximadamente 40% em comparação com o cultivo a céu aberto. Esses achados destacam a urgência de implementar estratégias de manejo adaptativo para os sistemas de produção de café face à variabilidade climática em curso.`,
  palavrasChave: "mudanças climáticas; produção de café; Minas Gerais; agrofloresta; adaptação",
  program: "Programa de Pós-Graduação em Agronomia — Curso de Doutorado",
  course: "ana.beatriz@ufla.edu.br; carlos.silva@ufla.edu.br; maria.oliveira@ufla.edu.br",
  referencias: [
    "ALVARES, C. A.; STAPE, J. L.; SENTELHAS, P. C.; GONÇALVES, J. L. M.; SPAROVEK, G. Köppen's climate classification map for the world. Meteorologische Zeitschrift, v. 22, n. 6, p. 711–728, 2013.",
    "ASSOCIAÇÃO BRASILEIRA DE PRODUTORES DE CAFÉ. Relatório anual 2025. Brasília: ABRAFÉ, 2025.",
    "BORSCHIVER, S.; GROTTA, M. A.; MARSARO JÚNIOR, G. Cadeia produtiva do café no Brasil: análise setorial e perspectivas. BNDES Setorial, v. 17, n. 33, p. 105–152, 2010.",
    "DAEMON, M.; ROLIM, G. S.; PIO, R. Application of the Hargreaves–Samani method in estimating evapotranspiration in the southern region of Minas Gerais. Revista Brasileira de Engenharia Agrícola e Ambiental, v. 25, n. 2, p. 104–112, 2021.",
    "INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA. Produção agrícola municipal: café. Rio de Janeiro: IBGE, 2025. Disponível em: https://cidades.ibge.gov.br. Acesso em: 15 jan. 2026.",
    "MAIA, C. M. B. F.; NOBRE, C. A. Agriculture and climate change: a review of impacts and adaptations in Brazil. Climatic Change, v. 120, n. 1–2, p. 397–413, 2013.",
    "NUNES, J. E. F.; KIILL, L. H. P.; LIMA, A. A. Adaptation of Coffea arabica L. to water deficit in the field. Journal of Agricultural Science, v. 10, n. 8, p. 201–211, 2018.",
    "PEREIRA, A. R.; VILLA NOVA, N. A.; SANTOS, A. O. Agrometeorologia do café no Brasil. In: REUNIÃO DE PESQUISAS SOBRE CULTURA DO CAFÉ, 14., 2013, Poços de Caldas. Anais... Poços de Caldas: ABIC, 2013. p. 88–102.",
    "PRADO, C. H. B. A.; VALENÇA, M. P.; MOURA, M. F. Photosynthesis and water relations of coffee plants under shade. Photosynthetica, v. 58, n. 3, p. 556–565, 2020.",
    "SCARPARE, F. V.; CRUZ, P. G.; ALMEIDA, R. E. M.; RIGHI, E. C.; STRAPASSON, A. G.; CARVALHO, J. L. V. Bioenergy and climate change: a review of the Brazilian experience. Renewable and Sustainable Energy Reviews, v. 72, p. 995–1009, 2017.",
  ].join("\n"),
  agradecimentos: "Os autores agradecem à Fundação de Amparo à Pesquisa de Minas Gerais (FAPEMIG) e ao Conselho Nacional de Desenvolvimento Científico e Tecnológico (CNPq) pelo financiamento desta pesquisa.",
};

const RESUMO_SIMPLES_FIELDS = {
  ...BASE_FIELDS,
  workType: "resumo_cpg",
  title: "Impacto das Mudanças Climáticas na Produção de Café no Sul de Minas Gerais",
};

const RESUMO_EXPANDIDO_FIELDS = {
  ...BASE_FIELDS,
  workType: "resumo_expandido_cpg",
  title: "Impacto das Mudanças Climáticas na Produção de Café no Sul de Minas Gerais",
};

const ARTIGO_COMPLETO_FIELDS = {
  ...BASE_FIELDS,
  workType: "artigo_completo_cpg",
  title: "Impacto das Mudanças Climáticas na Produção de Café no Sul de Minas Gerais: Diagnóstico e Estratégias de Adaptação",
};

const RESUMO_SIMPLES_EDITOR = "";
const RESUMO_EXPANDIDO_EDITOR = [
  "# 1 INTRODUÇÃO",
  "O café é uma das culturas de maior importância econômica para o Brasil, que é o maior produtor e exportador mundial. A região do sul de Minas Gerais responde por aproximadamente 30% da produção nacional, contribuindo significativamente para a economia regional. Contudo, as mudanças climáticas globais representam uma ameaça substancial à sustentabilidade dessa atividade produtiva.",
  "",
  "# 2 OBJETIVOS",
  "O objetivo geral deste estudo foi avaliar os impactos das mudanças climáticas na produtividade do café no sul de Minas Gerais, no período de 2024 a 2025. Como objetivos específicos, buscou-se quantificar as variações de temperatura e precipitação na região de estudo, analisar a relação entre variáveis climáticas e produtividade do café, e avaliar a eficácia de sistemas agroflorestais como estratégia de adaptação.",
  "",
  "# 3 MATERIAL E MÉTODOS",
  "O estudo foi conduzido em doze municípios da região sul de Minas Gerais, abrangendo uma área total de aproximadamente 4.500 km². Foram instaladas estações meteorológicas automáticas em cada município, registrando dados de temperatura, precipitação e umidade relativa do ar a cada 30 minutos. A produtividade do café foi avaliada em 180 propriedades, distribuídas igualmente entre sistemas convencionais a céu aberto e sistemas agroflorestais. A análise estatística foi realizada utilizando modelos lineares mistos, considerando os efeitos aleatórios de município e propriedade.",
  "",
  "# 4 RESULTADOS E DISCUSSÃO",
  "Os dados climáticos revelaram um aumento médio de 1,2°C na temperatura máxima anual ao longo do período de estudo, com variações significativas entre municípios. A produtividade média do café em sistemas convencionais diminuiu de 35 sacas/ha em 2024 para 29,6 sacas/ha em 2025, representando uma redução de 15,3%. Em contraste, propriedades com sistemas agroflorestais apresentaram redução de apenas 9,2%, com produtividade média de 31,5 sacas/ha em 2025. A análise de correlação demonstrou que cada grau de aumento na temperatura máxima média anual está associado a uma redução de 5,8% na produtividade (R² = 0,73, p < 0,001).",
  "",
  "# 5 CONCLUSÕES",
  "As mudanças climáticas estão impactando negativamente a produção de café no sul de Minas Gerais, com perdas significativas de produtividade associadas ao aumento de temperaturas. A adoção de sistemas agroflorestais demonstra ser uma estratégia eficaz de adaptação, reduzindo as perdas em até 40% em comparação com o cultivo convencional.",
].join("\n");

const ARTIGO_COMPLETO_EDITOR = [
  ...RESUMO_EXPANDIDO_EDITOR.slice(0, 6),
  "",
  "# 3 MATERIAL E MÉTODOS",
  "## 3.1 Área de estudo",
  "O estudo foi conduzido em doze municípios da região sul de Minas Gerais, abrangendo uma área total de aproximadamente 4.500 km². A região apresenta clima tropical de altitude, com precipitação média anual entre 1.200 e 1.600 mm e temperaturas médias anuais de 19 a 22°C.",
  "## 3.2 Dados climáticos",
  "Foram instaladas estações meteorológicas automáticas em cada município, registrando dados de temperatura, precipitação e umidade relativa do ar a cada 30 minutos. Os dados foram validados conforme metodologia proposta por Alvares et al. (2013).",
  "## 3.3 Avaliação da produtividade",
  "A produtividade do café foi avaliada em 180 propriedades, distribuídas igualmente entre sistemas convencionais a céu aberto e sistemas agroflorestais. Em cada propriedade, foram amostradas parcelas de 20 m², com quatro repetições,按照 o delineamento em blocos casualizados.",
  "## 3.4 Análise estatística",
  "A análise estatística foi realizada utilizando modelos lineares mistos implementados no software R (v. 4.3.1), pacote lme4, considerando os efeitos aleatórios de município e propriedade.",
  "",
  "# 4 RESULTADOS",
  "## 4.1 Variáveis climáticas",
  "Os dados climáticos revelaram um aumento médio de 1,2°C na temperatura máxima anual ao longo do período de estudo, com variações significativas entre municípios.",
  "## 4.2 Produtividade do café",
  "A produtividade média do café em sistemas convencionais diminuiu de 35 sacas/ha em 2024 para 29,6 sacas/ha em 2025, representando uma redução de 15,3%. Em contraste, propriedades com sistemas agroflorestais apresentaram redução de apenas 9,2%.",
  "## 4.3 Análise de correlação",
  "A análise de correlação demonstrou que cada grau de aumento na temperatura máxima média anual está associado a uma redução de 5,8% na produtividade (R² = 0,73, p < 0,001).",
  "",
  "# 5 DISCUSSÃO",
  "Os resultados encontrados corroboram os estudos de Maia e Nobre (2013), que relataram sensibilidade elevada da cultura do café a variações de temperatura. O efeito protetor dos sistemas agroflorestais pode ser atribuído à redução da radiação solar direta e ao aumento da umidade do ar no interior do sistema agroflorestal, conforme descrito por Prado et al. (2020).",
  "",
  "# 6 CONCLUSÕES",
  "As mudanças climáticas estão impactando negativamente a produção de café no sul de Minas Gerais, com perdas significativas de produtividade associadas ao aumento de temperaturas. A adoção de sistemas agroflorestais demonstra ser uma estratégia eficaz de adaptação. Recomenda-se a ampliação da adoção desses sistemas, aliada ao desenvolvimento de cultivares mais tolerantes ao calor.",
].join("\n");

// ============================================================
// GENERATION
// ============================================================

async function generateAndSave(name, fields, editorText) {
  const blob = await generateCpgDocxBlob({ fields, editorText });
  const buf = Buffer.from(await blob.arrayBuffer());
  const outPath = join(TMP_DIR, `${name}.docx`);
  writeFileSync(outPath, buf);
  console.log(`  ✓ ${name}.docx (${buf.length} bytes)`);
  return { name, path: outPath, buf };
}

console.log("=== STEP 1: Generating 3 CPG DOCX files ===\n");

const files = await Promise.all([
  generateAndSave("resumo_simples", RESUMO_SIMPLES_FIELDS, RESUMO_SIMPLES_EDITOR),
  generateAndSave("resumo_expandido", RESUMO_EXPANDIDO_FIELDS, RESUMO_EXPANDIDO_EDITOR),
  generateAndSave("artigo_completo", ARTIGO_COMPLETO_FIELDS, ARTIGO_COMPLETO_EDITOR),
]);

// ============================================================
// STEP 2: XML-level comparison of generated DOCX files
// ============================================================

console.log("\n=== STEP 2: XML structural analysis of generated DOCX files ===\n");

async function extractDocxStructure(buf, name) {
  const zip = await JSZip.loadAsync(buf);
  const docXml = await zip.file("word/document.xml").async("text");

  // Extract page setup
  const pgSzMatch = docXml.match(/<w:pgSz[^>]*w:w="(\d+)"[^>]*w:h="(\d+)"/);
  const pgMarMatch = docXml.match(/<w:pgMar[^>]*w:top="(\d+)"[^>]*w:bottom="(\d+)"[^>]*w:left="(\d+)"[^>]*w:right="(\d+)"/);

  // Extract paragraphs
  const paraRegex = /<w:p[ >][\s\S]*?<\/w:p>/gi;
  const paras = docXml.match(paraRegex) || [];

  const paragraphs = paras.map((p, i) => {
    const textMatches = p.match(/<w:t[^>]*>([^<]*)<\/w:t>/gi);
    let text = "";
    if (textMatches) {
      for (const tm of textMatches) {
        const c = tm.match(/>([^<]*)</);
        if (c) text += c[1];
      }
    }

    const alignMatch = p.match(/<w:jc\s+w:val=["']([^"']+)["']/i);
    const lineMatch = p.match(/w:line=["'](\d+)["']/i);
    const firstLineMatch = p.match(/w:firstLine=["'](\d+)["']/i);
    const hangingMatch = p.match(/w:hanging=["'](\d+)["']/i);
    const leftIndMatch = p.match(/w:left=["'](\d+)["']/i);
    const bold = /<w:b\s*\/>|<w:b\s+w:val=["'](1|true)["']/i.test(p);
    const italic = /<w:i\s*\/>|<w:i\s+w:val=["'](1|true)["']/i.test(p);
    const fontMatch = p.match(/<w:rFonts\s[^>]*w:ascii=["']([^"']+)["']/i);
    const sizeMatch = p.match(/<w:sz\s+w:val=["'](\d+)["']/i);
    const outlineMatch = p.match(/<w:outlineLvl\s+w:val=["'](\d+)["']/i);

    return {
      index: i,
      text: text.substring(0, 120),
      alignment: alignMatch ? alignMatch[1] : null,
      lineSpacing: lineMatch ? parseInt(lineMatch[1]) : null,
      firstLine: firstLineMatch ? parseInt(firstLineMatch[1]) : null,
      hanging: hangingMatch ? parseInt(hangingMatch) : null,
      leftIndent: leftIndMatch ? parseInt(leftIndMatch[1]) : null,
      bold,
      italic,
      font: fontMatch ? fontMatch[1] : null,
      fontSize: sizeMatch ? parseInt(sizeMatch[1]) / 2 : null,
      headingLevel: outlineMatch ? parseInt(outlineMatch[1]) : null,
    };
  });

  // Check headers/footers
  const hasHeaderRef = /<w:headerReference/.test(docXml);
  const hasFooterRef = /<w:footerReference/.test(docXml);

  // Check for page number fields
  const relsEntry = zip.file("word/_rels/document.xml.rels");
  let headerTargets = [];
  if (relsEntry) {
    const relsStr = await relsEntry.async("text");
    const relsMatches = relsStr.match(/<Relationship\s+[^>]*>/gi) || [];
    for (const r of relsMatches) {
      if (r.includes("header")) {
        const tMatch = r.match(/Target=["']([^"']+)["']/i);
        if (tMatch) headerTargets.push(tMatch[1]);
      }
    }
  }

  let hasPageNumber = false;
  for (const hdr of headerTargets) {
    try {
      const hdrStr = await zip.file(`word/${hdr}`).async("text");
      if (hdrStr.includes("PAGE") || hdrStr.includes("instrText") || hdrStr.includes("fldChar")) {
        hasPageNumber = true;
      }
    } catch (e) {}
  }

  return {
    name,
    pageSize: pgSzMatch ? { w: parseInt(pgSzMatch[1]), h: parseInt(pgSzMatch[2]) } : null,
    margins: pgMarMatch ? {
      top: parseInt(pgMarMatch[1]),
      bottom: parseInt(pgMarMatch[2]),
      left: parseInt(pgMarMatch[3]),
      right: parseInt(pgMarMatch[4]),
    } : null,
    paragraphCount: paragraphs.length,
    paragraphs,
    hasHeaderRef,
    hasFooterRef,
    hasPageNumber,
    headerTargets,
    fonts: [...new Set(paragraphs.filter(p => p.font).map(p => p.font))],
    fontSizes: [...new Set(paragraphs.filter(p => p.fontSize).map(p => `${p.fontSize}pt`))],
    alignments: [...new Set(paragraphs.filter(p => p.alignment).map(p => p.alignment))],
    lineSpacings: [...new Set(paragraphs.filter(p => p.lineSpacing).map(p => p.lineSpacing))],
  };
}

const structures = [];
for (const f of files) {
  const s = await extractDocxStructure(f.buf, f.name);
  structures.push(s);
  console.log(`--- ${s.name} ---`);
  console.log(`  Page: ${s.pageSize?.w}x${s.pageSize?.h} twips (A4 = 11906x16838)`);
  console.log(`  Margins: T=${twipToCm(s.margins?.top)}cm B=${twipToCm(s.margins?.bottom)}cm L=${twipToCm(s.margins?.left)}cm R=${twipToCm(s.margins?.right)}cm`);
  console.log(`  Paragraphs: ${s.paragraphCount}`);
  console.log(`  Fonts: ${s.fonts.join(", ")}`);
  console.log(`  Font sizes: ${s.fontSizes.join(", ")}`);
  console.log(`  Alignments: ${s.alignments.join(", ")}`);
  console.log(`  Line spacings (twips): ${s.lineSpacings.join(", ")}`);
  console.log(`  Header refs: ${s.hasHeaderRef}, Footer refs: ${s.hasFooterRef}`);
  console.log(`  Page numbers in header: ${s.hasPageNumber}`);
  console.log(`  Heading levels: ${[...new Set(s.paragraphs.filter(p => p.headingLevel !== null).map(p => `H${p.headingLevel + 1}`))].join(", ") || "none"}`);
  console.log();
}

// ============================================================
// STEP 3: Side-by-side paragraph comparison (first 5 paras each)
// ============================================================

console.log("\n=== STEP 3: Key paragraph comparison (first paragraph of each file) ===\n");

for (const s of structures) {
  const first = s.paragraphs[0];
  console.log(`${s.name} P0: align=${first.alignment}, bold=${first.bold}, font=${first.font}, size=${first.fontSize}pt, line=${first.lineSpacing}tw, text="${first.text}"`);
}

// ============================================================
// STEP 4: Compare generated vs CPG template expected rules
// ============================================================

console.log("\n=== STEP 4: Compliance check against CPG rules ===\n");

const CPG_MARGINS_TWIP = {
  top: Math.round(3.5 * TWIPS_PER_CM),
  bottom: Math.round(2.5 * TWIPS_PER_CM),
  left: Math.round(3 * TWIPS_PER_CM),
  right: Math.round(3 * TWIPS_PER_CM),
};

for (const s of structures) {
  const checks = [];

  // A4
  checks.push({ id: "PAGE_A4", pass: s.pageSize?.w === 11906 && s.pageSize?.h === 16838, found: `${s.pageSize?.w}x${s.pageSize?.h}`, expected: "11906x16838" });

  // Margins
  if (s.margins) {
    checks.push({ id: "MARGIN_TOP", pass: s.margins.top === CPG_MARGINS_TWIP.top, found: `${s.margins.top} (${twipToCm(s.margins.top)}cm)`, expected: `${CPG_MARGINS_TWIP.top} (3.5cm)` });
    checks.push({ id: "MARGIN_BOTTOM", pass: s.margins.bottom === CPG_MARGINS_TWIP.bottom, found: `${s.margins.bottom} (${twipToCm(s.margins.bottom)}cm)`, expected: `${CPG_MARGINS_TWIP.bottom} (2.5cm)` });
    checks.push({ id: "MARGIN_LEFT", pass: s.margins.left === CPG_MARGINS_TWIP.left, found: `${s.margins.left} (${twipToCm(s.margins.left)}cm)`, expected: `${CPG_MARGINS_TWIP.left} (3cm)` });
    checks.push({ id: "MARGIN_RIGHT", pass: s.margins.right === CPG_MARGINS_TWIP.right, found: `${s.margins.right} (${twipToCm(s.margins.right)}cm)`, expected: `${CPG_MARGINS_TWIP.right} (3cm)` });
  }

  // No page numbers
  checks.push({ id: "NO_PAGE_NUMBERS", pass: !s.hasPageNumber, found: s.hasPageNumber ? "Found" : "None", expected: "None (suppressed)" });

  // No header refs (page numbers suppressed)
  checks.push({ id: "NO_HEADER_REF", pass: !s.hasHeaderRef, found: s.hasHeaderRef ? "Present" : "None", expected: "None (suppressed)" });

  // Font = Times (not Times New Roman)
  checks.push({ id: "FONT_TIMES", pass: s.fonts.some(f => f === "Times"), found: s.fonts.join(", "), expected: "Times" });

  // Body size = 12pt
  checks.push({ id: "BODY_SIZE_12", pass: s.fontSizes.includes("12pt"), found: s.fontSizes.join(", "), expected: "12pt" });

  // Title size = 16pt
  checks.push({ id: "TITLE_SIZE_16", pass: s.fontSizes.includes("16pt"), found: s.fontSizes.join(", "), expected: "16pt" });

  // Single line spacing (240 twips) for body
  checks.push({ id: "SINGLE_LINE_SPACING", pass: s.lineSpacings.includes(240), found: s.lineSpacings.join(", "), expected: "240 (single)" });

  // No body line spacing (360 twips)
  const hasBodyLine = s.paragraphs.some(p => p.lineSpacing === 360 && p.headingLevel === null && p.text.length > 20);
  checks.push({ id: "NO_BODY_1_5_SPACING", pass: !hasBodyLine, found: hasBodyLine ? "Found 360tw body paras" : "None", expected: "None (single spacing for CPG)" });

  // First line indent = 709 twips (1.27 cm)
  const firstLineIndents = s.paragraphs.filter(p => p.firstLine !== null).map(p => p.firstLine);
  const uniqueFirstLine = [...new Set(firstLineIndents)];
  checks.push({ id: "FIRST_LINE_INDENT", pass: uniqueFirstLine.every(v => v === 709), found: uniqueFirstLine.join(", "), expected: "709 (1.27cm)" });

  const passes = checks.filter(c => c.pass).length;
  const fails = checks.filter(c => !c.pass).length;

  console.log(`--- ${s.name}: ${passes}/${checks.length} PASS, ${fails} FAIL ---`);
  for (const c of checks) {
    const icon = c.pass ? "✓" : "✗";
    console.log(`  ${icon} ${c.id}: expected=${c.expected}, found=${c.found}`);
  }
  console.log();
}

// ============================================================
// STEP 5: Generate variant DOCX files with different content
// ============================================================

console.log("\n=== STEP 5: Generating variant DOCX files with different content ===\n");

const VARIANT_1 = {
  fields: {
    ...BASE_FIELDS,
    workType: "resumo_expandido_cpg",
    title: "Análise da Qualidade da Água em Bacias Hidrográficas do Médio Rio Paraíba do Sul",
    resumo: "Este estudo avaliou a qualidade da água em sete pontos de amostragem ao longo da bacia hidrográfica do médio Rio Paraíba do Sul, no período de março a novembro de 2025. Foram determinados parâmetros físico-químicos e microbiológicos conforme padrões estabelecidos pela Resolução CONAMA nº 357/2005 e pela Resolução CONAMA nº 410/2009. Os resultados revelaram que 43% dos pontos de amostração apresentaram qualidade incompatível com a classe de proteção atribuída, destacando-se os parâmetros de demanda bioquímica de oxigênio, nitrogênio total e coliformes termotolerantes como os principais indicadores de degradação. A análise espacial identificou trechos críticos próximos a áreas urbanas e industriais, com concentrações de poluentes significativamente superiores aos limites permitidos. Conclui-se que é necessária a implementação de medidas de controle de fontes pontuais e difusas de poluição para a recuperação da qualidade ambiental da bacia.",
    palavrasChave: "qualidade da água; bacia hidrográfica; Paraíba do Sul; CONAMA; monitoramento ambiental",
    abstractText: "This study assessed water quality at seven sampling points along the middle Paraíba do Sul River basin from March to November 2025. Physico-chemical and microbiological parameters were determined according to standards established by CONAMA Resolution No. 357/2005 and CONAMA Resolution No. 410/2009. Results revealed that 43% of sampling points showed quality incompatible with the assigned protection class, with biochemical oxygen demand, total nitrogen, and thermotolerant coliforms identified as the main degradation indicators. Spatial analysis identified critical stretches near urban and industrial areas, with pollutant concentrations significantly above permitted limits.",
    keywords: "water quality; river basin; Paraíba do Sul; CONAMA; environmental monitoring",
    program: "Programa de Pós-Graduação em Ciências Ambientais — Curso de Mestrado",
    course: "pedro.santos@ufla.edu.br; juliana.lima@ufla.edu.br",
  },
  editorText: [
    "# 1 INTRODUÇÃO",
    "A qualidade das águas superficiais é um indicador fundamental do estado ambiental das bacias hidrográficas, refletindo a interação entre processos naturais e antrópicos. A bacia do médio Rio Paraíba do Sul, localizada no sudeste do Brasil, é uma das regiões mais pressionadas por atividades industriais, agrícolas e urbanas, demandando monitoramento contínuo e ações efetivas de conservação.",
    "",
    "# 2 OBJETIVOS",
    "Avaliar a qualidade da água em sete pontos de amostragem ao longo da bacia do médio Rio Paraíba do Sul, identificando as principais fontes de poluição e os trechos com maior degradação ambiental.",
    "",
    "# 3 MATERIAL E MÉTODOS",
    "## 3.1 Área de estudo",
    "A bacia do médio Rio Paraíba do Sul abrange uma área de aproximadamente 15.800 km², drenando municípios dos estados de Minas Gerais e Rio de Janeiro.",
    "## 3.2 Coleta e análise de amostras",
    "Foram coletadas amostras de água em sete pontos de amostragem, distribuídos ao longo do eixo principal do rio, em intervalos mensais durante o período de março a novembro de 2025. Os parâmetros físico-químicos e microbiológicos foram determinados conforme metodologia padrão.",
    "",
    "# 4 RESULTADOS",
    "Os dados obtidos indicaram variação significativa na qualidade da água entre os pontos de amostragem e ao longo do período de estudo. Os parâmetros de DBO5, nitrogênio total e coliformes termotolerantes apresentaram os maiores índices de não conformidade com os padrões estabelecidos pela legislação ambiental vigente.",
    "",
    "# 5 CONCLUSÕES",
    "A bacia do médio Rio Paraíba do Sul apresenta trechos com degradação significativa da qualidade da água, exigindo a implementação de medidas integradas de controle de poluição e recuperação ambiental.",
  ].join("\n"),
};

const VARIANT_2 = {
  fields: {
    ...BASE_FIELDS,
    workType: "artigo_completo_cpg",
    title: "Desenvolvimento de um Sistema de Irrigação por Gotejamento Inteligente para Culturas de Baixa Humidade no Semiárido Brasileiro",
    resumo: "O semiárido brasileiro abrange uma área de aproximadamente 1 milhão de km², abrigando cerca de 22 milhões de habitantes. A escassez hídrica é o principal fator limitante para o desenvolvimento agrícola na região. Este artigo apresenta o desenvolvimento e a validação de um sistema de irrigação por gotejamento com sensores de umidade do solo e controlador baseado em microprocessador, visando otimizar o uso da água em culturas de baixa demanda hídrica. O protótipo foi testado em cultivo de feijão-caupi (Vigna unguiculata) durante dois ciclos agrícolas consecutivos (2024/2025). Os resultados demonstraram redução de 35% no consumo de água e aumento de 12% na produtividade em comparação com o sistema de irrigação por superfície convencional.",
    palavrasChave: "irrigação inteligente; semiárido; gotejamento; sensor de umidade; eficiência hídrica",
    abstractText: "The Brazilian semi-arid region encompasses an area of approximately 1 million km², harboring about 22 million inhabitants. Water scarcity is the main limiting factor for agricultural development in the region. This article presents the development and validation of a drip irrigation system with soil moisture sensors and a microprocessor-based controller, aiming to optimize water use in low water-demand crops. The prototype was tested with cowpea (Vigna unguiculata) cultivation over two consecutive agricultural cycles (2024/2025). Results demonstrated a 35% reduction in water consumption and a 12% increase in productivity compared to conventional surface irrigation systems.",
    keywords: "smart irrigation; semi-arid; drip irrigation; moisture sensor; water efficiency",
    program: "Programa de Pós-Graduação em Engenharia Agrícola — Curso de Doutorado",
    course: "roberto.mendes@ufla.edu.br; fernanda.alves@ufla.edu.br",
  },
  editorText: [
    "# 1 INTRODUÇÃO",
    "O semiárido brasileiro caracteriza-se por precipitações irregulares e concentradas, com totais anuais entre 400 e 800 mm, e elevadas taxas de evapotranspiração potencial que podem ultrapassar 2.000 mm/ano. A agricultura irrigada representa a principal alternativa para o desenvolvimento socioeconômico da região, however o uso ineficiente dos recursos hídricos agrava a situação de escassez.",
    "",
    "# 2 OBJETIVOS",
    "Desenvolver e validar um sistema de irrigação por gotejamento com controle inteligente baseado em sensores de umidade do solo, visando maximizar a eficiência hídrica no cultivo de feijão-caupi no semiárido brasileiro.",
    "",
    "# 3 MATERIAL E MÉTODOS",
    "## 3.1 Desenvolvimento do sistema",
    "O sistema foi composto por sensores capacitivos de umidade do solo (tipo FDR), módulo de aquisição de dados baseado em Arduino Mega 2560, atuadores eletromagnéticos de 12V e painel fotovoltaico de 50W para alimentação autônoma.",
    "## 3.2 Experimento agrícola",
    "O experimento foi conduzido em delineamento de blocos casualizados com quatro tratamentos e cinco repetições. Os tratamentos consistiram em: T1 — irrigação por superfície (testemunho); T2 — gotejamento convencional (30% de reposição da ETc); T3 — gotejamento com sensor de umidade a 20 cm (controle automático); T4 — gotejamento com sensor de umidade a 20 e 40 cm (controle automático duplo).",
    "## 3.3 Análise dos dados",
    "Os dados de produtividade, eficiência de uso da água e consumo hídrico foram analisados por ANOVA e comparações múltiplas pelo teste de Tukey (p < 0,05).",
    "",
    "# 4 RESULTADOS E DISCUSSÃO",
    "O sistema de irrigação inteligente demonstrou eficiência superior em todos os parâmetros avaliados. O tratamento T4 apresentou a maior eficiência de uso da água (1,82 kg/m³), seguido por T3 (1,65 kg/m³), T2 (1,23 kg/m³) e T1 (0,89 kg/m³). A produtividade média do feijão-caupi foi de 2.450 kg/ha no T4, 2.280 kg/ha no T3, 2.100 kg/ha no T2 e 1.850 kg/ha no T1.",
    "",
    "# 5 CONCLUSÕES",
    "O sistema de irrigação por gotejamento com controle inteligente baseado em sensores de umidade do solo mostrou-se eficiente para a otimização do uso da água no cultivo de feijão-caupi no semiárido brasileiro, com potencial de economia hídrica significativa e aumento de produtividade.",
  ].join("\n"),
};

console.log("Generating variant 1 (Resumo Expandido — Hidrologia)...");
const v1 = await generateAndSave("variant1_hidrologia", VARIANT_1.fields, VARIANT_1.editorText);

console.log("Generating variant 2 (Artigo Completo — Irrigação)...");
const v2 = await generateAndSave("variant2_irrigacao", VARIANT_2.fields, VARIANT_2.editorText);

// Analyze variants
console.log("\n--- Variant analysis ---");
for (const v of [v1, v2]) {
  const s = await extractDocxStructure(v.buf, v.name);
  console.log(`${s.name}: ${s.paragraphCount} paras, fonts=[${s.fonts}], sizes=[${s.fontSizes}], spacings=[${s.lineSpacings}]`);
}

// ============================================================
// STEP 6: Summary report
// ============================================================

console.log("\n=== STEP 6: Summary Report ===\n");
console.log("Files generated:");
for (const f of [...files, v1, v2]) {
  const stat = existsSync(f.path) ? readFileSync(f.path).length : 0;
  console.log(`  ${f.name}.docx — ${stat} bytes`);
}

console.log("\nExpected vs Actual comparison:");
console.log("  CPG Margins: T=3.5cm B=2.5cm L=3cm R=3cm");
console.log("  CPG Font: Times (not Times New Roman)");
console.log("  CPG Spacing: Single (240 twips) — NOT 1.5");
console.log("  CPG Page numbers: Suppressed (no headers)");
console.log("  CPG Title: 16pt, centered, bold");
console.log("  CPG Abstract indent: 0.8cm sides");
console.log("  CPG First line: 1.27cm");
console.log("  CPG Reference hanging: 0.5cm");
console.log("\nCheck the detailed results above for each file.");

console.log("\nDone! All files in:", TMP_DIR);
