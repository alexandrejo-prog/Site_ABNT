import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import crypto from "node:crypto";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

const baselinePath = join(root, "artifacts", "baselines", "dissertacao-referencia.docx");
const outputPath = join(root, "artifacts", "ufla-compliance", "baseline-extraction.json");

const data = readFileSync(baselinePath);
const sha256 = crypto.createHash("sha256").update(data).digest("hex");
const zip = await JSZip.loadAsync(data);

const documentXml = await zip.file("word/document.xml")?.async("string") || "";
const stylesXml = await zip.file("word/styles.xml")?.async("string") || "";
const settingsXml = await zip.file("word/settings.xml")?.async("string") || "";
const relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string") || "";

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\d+$/, "")
    .trim();
}

function paragraphTextsFromXml(xml: string): string[] {
  return (xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).map((p) => {
    const matches = [...p.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)];
    return matches.map((m) => m[1]).join("");
  });
}

const parasXml = documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
const paragraphs = parasXml.map((pXml, index) => {
  const matches = [...pXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)];
  const text = matches.map((m) => m[1]).join("");
  const style = (() => {
    const m = pXml.match(/<w:pStyle\s+w:val="([^"]+)"/);
    return m ? m[1] : "";
  })();
  const isHeading = /^Heading\d+$/.test(style);
  const headingLevel = (() => {
    const m = style.match(/^Heading(\d+)$/);
    return m ? parseInt(m[1]) : null;
  })();
  const hasPageBreak = pXml.includes("w:pageBreakBefore") || pXml.includes("<w:br w:type=\"page\"/>");
  return {
    index,
    text,
    style,
    isHeading,
    headingLevel,
    hasPageBreak,
    hasTable: false,
    hasImage: false,
  };
});

function extractFields(xml: string): string[] {
  const fields: string[] = [];
  const instrTexts = [...xml.matchAll(/<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g)];
  for (const match of instrTexts) {
    fields.push(match[1].trim());
  }
  return fields;
}

const references: string[] = [];
const refHeadingPattern = /^(REFERÊNCIAS|REFERENCIAS|BIBLIOGRAFIA)$/i;
const refStartIdx = paragraphs.findIndex((p) => refHeadingPattern.test(p.text.trim()));
if (refStartIdx >= 0) {
  for (let i = refStartIdx + 1; i < paragraphs.length; i++) {
    const text = paragraphs[i].text.trim();
    if (!text) continue;
    if (/^(APÊNDICE|ANEXO|SUMÁRIO|SUMARIO)/i.test(text)) break;
    references.push(text);
  }
}

const tables: string[] = [];
const tblXmls = [...documentXml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g)];
for (const match of tblXmls) {
  const tblText = paragraphTextsFromXml(match[0]).filter((t) => t.trim()).join(" | ");
  tables.push(tblText.slice(0, 200));
}

const images: string[] = [];
const rels = new Map([...relsXml.matchAll(/Id="([^"]+)"[^>]*Type="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[3]]));
for (const [name, file] of Object.entries(zip.files)) {
  if (file.dir) continue;
  if (name.startsWith("word/media/")) {
    images.push(name);
  }
}

const captions: string[] = [];
const captionPattern = /^(Figura|Tabela|Quadro|Gráfico|Mapa|Ilustração)\s+\d+[\s\-—:]/i;
for (const p of paragraphs) {
  if (captionPattern.test(p.text.trim())) {
    captions.push(p.text.trim());
  }
}

const sections: string[] = [];
const sectionPatterns = [
  /^LISTAS DE ILUSTRAÇÕES$/i,
  /^LISTA DE TABELAS$/i,
  /^LISTA DE SIGLAS$/i,
  /^SUMÁRIO$/i,
  /^INTRODUÇÃO$/i,
  /^INTRODUCAO$/i,
  /^REFERENCIAL TEÓRICO$/i,
  /^REFERENCIAL TEORICO$/i,
  /^METODOLOGIA$/i,
  /^RESULTADOS$/i,
  /^CONSIDERAÇÕES FINAIS$/i,
  /^CONSIDERACOES FINAIS$/i,
  /^REFERÊNCIAS$/i,
  /^REFERENCIAS$/i,
  /^APÊNDICES$/i,
  /^APENDICES$/i,
  /^ANEXOS$/i,
];
for (const p of paragraphs) {
  for (const pattern of sectionPatterns) {
    if (pattern.test(p.text.trim()) && !sections.includes(p.text.trim())) {
      sections.push(p.text.trim());
    }
  }
}

const headers: string[] = [];
const footers: string[] = [];
for (const [name, file] of Object.entries(zip.files)) {
  if (file.dir) continue;
  if (name.startsWith("word/header") && name.endsWith(".xml")) {
    const xml = await file.async("string");
    headers.push(paragraphTextsFromXml(xml).filter((t) => t.trim()).join(" ") || name);
  }
  if (name.startsWith("word/footer") && name.endsWith(".xml")) {
    const xml = await file.async("string");
    footers.push(paragraphTextsFromXml(xml).filter((t) => t.trim()).join(" ") || name);
  }
}

const fields = extractFields(documentXml);

const metadata: Record<string, string> = {};
const coverParas = paragraphs.slice(0, 30);
for (const p of coverParas) {
  const text = p.text.trim();
  if (text && !metadata.title) {
    if (text.length > 50 && text.includes("Política")) {
      metadata.title = text;
    }
  }
  if (text && text.includes("Medeiros") && !metadata.author) {
    metadata.author = text;
  }
  if (/^\d{4}$/.test(text) && !metadata.year) {
    metadata.year = text;
  }
  if (text.includes("LAVRAS") && !metadata.location) {
    metadata.location = text;
  }
}

const parts = Object.keys(zip.files).map((name) => ({
  name,
  size: zip.files[name]?.size || 0,
}));

const bodyOrder = sections.map((s) => {
  const idx = paragraphs.findIndex((p) => normalizeText(p.text) === normalizeText(s));
  return { section: s, paragraphIndex: idx >= 0 ? idx : null };
});

const output = {
  file: {
    path: baselinePath,
    size: data.length,
    sha256,
  },
  parts,
  paragraphCount: paragraphs.length,
  paragraphs: paragraphs,
  headings: [],
  styles: {},
  references,
  referenceCount: references.length,
  tables,
  tableCount: tables.length,
  images,
  imageCount: images.length,
  captions,
  sections,
  headers,
  footers,
  fields,
  metadata,
  bodyOrder,
};

writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log("EXTRAIDO_COM_SUCESSO");
console.log(JSON.stringify({
  paragraphCount: paragraphs.length,
  referenceCount: references.length,
  tableCount: tables.length,
  imageCount: images.length,
  captionCount: captions.length,
  sectionCount: sections.length,
  headerCount: headers.length,
  footerCount: footers.length,
  fieldCount: fields.length,
  partCount: parts.length,
}, null, 2));