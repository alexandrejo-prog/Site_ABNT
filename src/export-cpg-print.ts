import { parseEditorContent, type DocxGenerationInput, type EditorBlock } from "./export-docx";

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripInlineMarkup(value: string): string {
  return value.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

function cleanText(value: string): string {
  return escapeHtml(stripInlineMarkup(value.trim()));
}

function paragraph(text: string, className = "body-paragraph"): string {
  if (!hasText(text)) return "";
  return `<p class="${className}">${cleanText(text)}</p>`;
}

function heading(text: string, level: 1 | 2 | 3): string {
  if (!hasText(text)) return "";
  return `<h${level}>${cleanText(text)}</h${level}>`;
}

function referenceTitleFor(references: string[]): string {
  const upper = references.map((r) => r.trim().toUpperCase());
  const hasRef = upper.some((r) => /^(REFERENCIAS|REFERÊNCIAS)$/.test(r));
  const hasBiblio = upper.some((r) => /^(BIBLIOGRÁFICAS|BIBLIOGRAFICAS)$/.test(r));
  if (hasRef && hasBiblio) return "REFERÊNCIAS BIBLIOGRÁFICAS";
  if (hasBiblio) return "REFERÊNCIAS BIBLIOGRÁFICAS";
  return "Referências";
}

function isReferenceTitleNoise(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  return /^(REFERENCIAS|REFERÊNCIAS|BIBLIOGRÁFICAS|BIBLIOGRAFICAS)$/.test(normalized);
}

function renderAbstractGroup(input: DocxGenerationInput): string {
  const items: string[] = [];

  if (hasText(input.fields.abstractText)) {
    items.push(`<p class="abstract-block"><strong>Abstract.</strong> ${cleanText(input.fields.abstractText)}</p>`);
  }
  if (hasText(input.fields.keywords)) {
    items.push(`<p class="keywords"><strong>Keywords:</strong> ${cleanText(input.fields.keywords)}</p>`);
  }
  if (hasText(input.fields.resumo)) {
    items.push(`<p class="abstract-block"><strong>Resumo.</strong> ${cleanText(input.fields.resumo)}</p>`);
  }
  if (hasText(input.fields.palavrasChave)) {
    items.push(`<p class="keywords"><strong>Palavras-chave:</strong> ${cleanText(input.fields.palavrasChave)}</p>`);
  }

  return items.join("\n");
}

function renderEditorBlocks(blocks: EditorBlock[]): string {
  let firstParagraphInSection = true;
  const html: string[] = [];

  for (const block of blocks) {
    if (block.type === "reference") continue;

    if (block.type === "heading1") {
      html.push(heading(block.text, 1));
      firstParagraphInSection = true;
      continue;
    }

    if (block.type === "heading2") {
      html.push(heading(block.text, 2));
      firstParagraphInSection = true;
      continue;
    }

    if (block.type === "heading3") {
      html.push(heading(block.text, 3));
      firstParagraphInSection = true;
      continue;
    }

    if (/^(figura|imagem|tabela|quadro)\s+\d+/i.test(block.text)) {
      html.push(paragraph(block.text, "caption"));
      continue;
    }

    html.push(paragraph(block.text, firstParagraphInSection ? "body-paragraph no-indent" : "body-paragraph"));
    firstParagraphInSection = false;
  }

  return html.join("\n");
}

function renderReferences(input: DocxGenerationInput, blocks: EditorBlock[]): string {
  const references = [
    ...splitParagraphs(input.fields.referencias),
    ...blocks.filter((block) => block.type === "reference").map((block) => block.text),
  ]
    .map((item) => stripInlineMarkup(item).trim())
    .filter(Boolean)
    .filter((item) => !isReferenceTitleNoise(item));

  if (!references.length) return "";

  return [
    `<h1>${escapeHtml(referenceTitleFor(references))}</h1>`,
    ...references
      .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))
      .map((reference) => `<p class="reference">${escapeHtml(reference)}</p>`),
  ].join("\n");
}

function renderTitleBlock(input: DocxGenerationInput): string {
  const affiliations = splitParagraphs(input.fields.program)
    .map((item) => `<p class="affiliation">${cleanText(item)}</p>`)
    .join("\n");
  const contact = hasText(input.fields.course)
    ? `<p class="contact">${cleanText(input.fields.course)}</p>`
    : "";

  return `
    <h1 class="title">${cleanText(input.fields.title || "Título do trabalho")}</h1>
    <p class="authors">${cleanText(input.fields.author || "Autores")}</p>
    ${affiliations}
    ${contact}
  `;
}

function buildCpgHtml(input: DocxGenerationInput): string {
  const blocks = parseEditorContent(input.editorText);
  const isOnePageSummary = input.fields.workType === "resumo_cpg";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${cleanText(input.fields.title || "Prévia CPG")}</title>
<style>
  @page {
    size: A4;
    margin: 3.5cm 3cm 2.5cm 3cm;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    color: #000;
    background: #fff;
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 1.08;
  }

  .print-toolbar {
    position: sticky;
    top: 0;
    padding: 10px 16px;
    background: #f3f4f6;
    border-bottom: 1px solid #d1d5db;
    font-family: Arial, sans-serif;
    font-size: 13px;
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
  }

  .print-toolbar button {
    padding: 8px 12px;
    border: 1px solid #111827;
    border-radius: 6px;
    background: #111827;
    color: #fff;
    cursor: pointer;
  }

  main {
    max-width: 100%;
  }

  .title {
    margin: 0 0 12pt 0;
    text-align: center;
    font-size: 16pt;
    line-height: 1.1;
    font-weight: 700;
    text-transform: uppercase;
  }

  .authors {
    margin: 0 0 2pt 0;
    text-align: center;
    font-weight: 700;
  }

  .affiliation,
  .contact {
    margin: 0;
    text-align: center;
    font-size: 10pt;
    line-height: 1.05;
  }

  .contact {
    font-family: "Courier New", Courier, monospace;
    margin-bottom: 8pt;
  }

  .abstract-block,
  .keywords {
    margin: 7pt 0 0 0;
    margin-left: 0.8cm;
    margin-right: 0.8cm;
    text-align: justify;
    text-align-last: left;
    hyphens: auto;
    -webkit-hyphens: auto;
  }

  .keywords {
    margin-top: 5pt;
  }

  .body-start {
    page-break-before: always;
  }

  h1:not(.title),
  h2,
  h3 {
    margin: 10pt 0 6pt 0;
    font-size: 12pt;
    line-height: 1.15;
    font-weight: 700;
    text-align: left;
  }

  .body-paragraph {
    margin: 0 0 6pt 0;
    text-indent: 1.27cm;
    text-align: justify;
    text-align-last: left;
    hyphens: auto;
    -webkit-hyphens: auto;
  }

  .body-paragraph.no-indent {
    text-indent: 0;
  }

  .caption {
    margin: 6pt 0;
    text-align: center;
    font-size: 10pt;
    font-family: Arial, sans-serif;
    font-weight: 700;
  }

  .reference {
    margin: 0 0 6pt 0;
    padding-left: 0.5cm;
    text-indent: -0.5cm;
    text-align: left;
  }

  @media screen {
    body {
      background: #d1d5db;
    }

    main {
      width: 21cm;
      min-height: 29.7cm;
      margin: 24px auto;
      padding: 3.5cm 3cm 2.5cm 3cm;
      background: #fff;
      box-shadow: 0 0 0 1px #cbd5e1, 0 14px 40px rgba(15, 23, 42, 0.25);
    }
  }

  @media print {
    .print-toolbar { display: none; }
    main {
      width: auto;
      min-height: auto;
      margin: 0;
      padding: 0;
      box-shadow: none;
    }
  }
</style>
</head>
<body>
  <div class="print-toolbar">
    <button type="button" onclick="window.print()">Imprimir / Salvar como PDF</button>
    <span>Prévia experimental com justificação feita pelo mecanismo de impressão do navegador.</span>
  </div>
  <main>
    ${renderTitleBlock(input)}
    ${renderAbstractGroup(input)}
    ${isOnePageSummary ? "" : `<section class="body-start">${renderEditorBlocks(blocks)}${renderReferences(input, blocks)}</section>`}
    ${isOnePageSummary && hasText(input.fields.agradecimentos) ? `${heading("Agradecimentos", 1)}${paragraph(input.fields.agradecimentos, "body-paragraph no-indent")}` : ""}
  </main>
</body>
</html>`;
}

export function openCpgPrintPreview(input: DocxGenerationInput): void {
  const preview = window.open("", "_blank", "noopener,noreferrer");
  if (!preview) {
    throw new Error("O navegador bloqueou a abertura da prévia. Permita pop-ups para abrir a impressão experimental.");
  }

  preview.document.open();
  preview.document.write(buildCpgHtml(input));
  preview.document.close();
  preview.focus();
}
