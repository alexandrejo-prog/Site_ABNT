// tests/acceptance-docx-audit.test.ts
//
// Structural auditor tests. NO Microsoft Word dependency.
// Synthetic DOCX packages are generated in a temporary directory.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const core = await import(
  path.join(__dirname, "..", "scripts", "acceptance", "docx-audit-core.mjs")
);
const {
  auditDocx,
  evaluateManifest,
  validateExpectSpec,
  parseExpectationsBytes,
  resolveTarget,
  DEFAULT_MARKER,
} = core;

const TMP = path.join(os.tmpdir(), "opencode-acceptance-tests-v2");
const DOCUMENT = (body: string) =>
  `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${body}</w:document>`;
const PAR = (inner: string) => `<w:p>${inner}</w:p>`;
const TEXT = (t: string) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;
const DRAW = (rId: string) =>
  `<w:r><w:drawing><wp:inline><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></pic:blipFill></pic:pic></a:graphicData></wp:inline></w:drawing></w:r>`;

const IMG_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
function relsXml(items: { id: string; type: string; target: string; mode?: string }[]) {
  const rels = items
    .map(
      (i) =>
        `<Relationship Id="${i.id}" Type="${i.type}" Target="${i.target}"${i.mode ? ` TargetMode="${i.mode}"` : ""}/>`
    )
    .join("");
  return `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}
function contentTypes(media: string[] = []) {
  const overrides = media
    .map((m) => `<Override PartName="/word/media/${m}" ContentType="image/png"/>`)
    .join("");
  return `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides}</Types>`;
}

function png() {
  return Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000002000001e221bc330000000049454e44ae426082",
    "hex"
  );
}
function truncatedPng() {
  return Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
}
function jpegMarker() {
  // Minimal JPEG: SOI + a couple bytes, no parser.
  return Buffer.from("ffd8ffe000104a464946", "hex");
}

async function buildDocx(files: Record<string, string | Buffer>, invalid = false): Promise<Buffer> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  const buf = (await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })) as Buffer;
  if (invalid) return Buffer.from(buf.subarray(0, Math.max(0, buf.length - 20)));
  return buf;
}

function minimalParts(extra: Record<string, string | Buffer> = {}, media: Record<string, Buffer> = {}) {
  const files: Record<string, string | Buffer> = {
    "[Content_Types].xml": contentTypes(Object.keys(media)),
    "word/document.xml": DOCUMENT(PAR(TEXT("Ola mundo"))),
    "word/_rels/document.xml.rels": relsXml([]),
    "word/settings.xml": `<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`,
    "word/styles.xml": `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`,
    "word/numbering.xml": `<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`,
    ...extra,
  };
  for (const [name, buf] of Object.entries(media)) files[`word/media/${name}`] = buf;
  return files;
}

async function bufOf(files: Record<string, string | Buffer>): Promise<Buffer> {
  return buildDocx(files);
}

let workDir: string;
beforeAll(() => {
  fs.mkdirSync(TMP, { recursive: true });
  workDir = fs.mkdtempSync(path.join(TMP, "case-"));
});
afterAll(() => {
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch {}
});

describe("Cenários estruturais básicos", () => {
  it("1/2. DOCX mínimo válido e ZIP inválido", async () => {
    const m = await auditDocx(await buildDocx(minimalParts()));
    expect(m.issues.failures).toHaveLength(0);
    expect(m.paragraphs).toBe(1);
    expect(m.sha256).toMatch(/^[0-9A-F]{64}$/);
    const bad = await auditDocx(Buffer.from("not a zip"));
    expect(bad.issues.failures.some((f: any) => f.code === "INVALID_ZIP")).toBe(true);
  });

  it("3. document.xml ausente", async () => {
    const files = minimalParts();
    delete (files as any)["word/document.xml"];
    const m = await auditDocx(await buildDocx(files));
    expect(m.issues.failures.some((f: any) => f.code === "MISSING_DOCUMENT_XML")).toBe(true);
  });

  it("4. imagem referenciada existente", async () => {
    const files = minimalParts(
      {
        "word/document.xml": DOCUMENT(PAR(DRAW("rId1"))),
        "word/_rels/document.xml.rels": relsXml([{ id: "rId1", type: IMG_TYPE, target: "media/img1.png" }]),
      },
      { "img1.png": png() }
    );
    const m = await auditDocx(await bufOf(files));
    expect(m.drawing).toBe(1);
    expect(m.blip).toBe(1);
    expect(m.mediaCount).toBe(1);
    expect(m.brokenEmbeddedRelationships.length).toBe(0);
    expect(m.brokenEmbeddedRelationshipCount).toBe(0);
  });

  it("5. imagem órfã", async () => {
    const m = await auditDocx(await bufOf(minimalParts({}, { "orphan.png": png() })));
    expect(m.orphanMedia).toContain("media/orphan.png");
  });

  it("6. mídia duplicada por hash", async () => {
    const p = png();
    const files = minimalParts(
      {
        "word/document.xml": DOCUMENT(PAR(DRAW("rId1")) + PAR(DRAW("rId2"))),
        "word/_rels/document.xml.rels": relsXml([
          { id: "rId1", type: IMG_TYPE, target: "media/a.png" },
          { id: "rId2", type: IMG_TYPE, target: "media/b.png" },
        ]),
      },
      { "a.png": p, "b.png": Buffer.from(p) }
    );
    const m = await auditDocx(await bufOf(files));
    expect(m.duplicateMedia.length).toBe(1);
  });

  it("7. relacionamento quebrado reprova", async () => {
    const files = minimalParts({
      "word/document.xml": DOCUMENT(PAR(DRAW("rId9"))),
      "word/_rels/document.xml.rels": relsXml([{ id: "rId9", type: IMG_TYPE, target: "media/missing.png" }]),
    });
    const m = await auditDocx(await bufOf(files));
    expect(m.brokenEmbeddedRelationships.length).toBeGreaterThan(0);
    expect(evaluateManifest(m, "general", {}).approved).toBe(false);
  });

  it("8. contagem de desenhos / 10. tabelas / 17. quebra pag / 18. quebra secao", async () => {
    const body = PAR(DRAW("rId1")) + PAR(DRAW("rId2")) + PAR(TEXT("x")) +
      `<w:tbl><w:tr><w:tc><w:p>${TEXT("c")}</w:p></w:tc></w:tr></w:tbl>` +
      PAR(TEXT("a") + "<w:br w:type=\"page\"/>") +
      PAR(TEXT("b") + "<w:br w:type=\"section\"/>");
    const files = minimalParts(
      {
        "word/document.xml": DOCUMENT(body),
        "word/_rels/document.xml.rels": relsXml([
          { id: "rId1", type: IMG_TYPE, target: "media/a.png" },
          { id: "rId2", type: IMG_TYPE, target: "media/b.png" },
        ]),
      },
      { "a.png": png(), "b.png": png() }
    );
    const m = await auditDocx(await bufOf(files));
    expect(m.drawing).toBe(2);
    expect(m.wpInline).toBe(2);
    expect(m.tables).toBe(1);
    expect(m.pageBreaks).toBe(1);
    expect(m.sectionBreaks).toBe(1);
  });

  it("9/11. bookmarkStart/End e nomes + starts/ends sem par", async () => {
    const bm = `<w:bookmarkStart w:id="1" w:name="B1"/><w:p>${TEXT("x")}</w:p><w:bookmarkEnd w:id="1"/>`;
    const m = await auditDocx(await bufOf(minimalParts({ "word/document.xml": DOCUMENT(PAR(bm)) })));
    expect(m.bookmarkStart).toBe(1);
    expect(m.bookmarkEnd).toBe(1);
    expect(m.bookmarkNames).toEqual(["B1"]);
    expect(m.bookmarkStartsWithoutEnd).toHaveLength(0);
    expect(m.bookmarkEndsWithoutStart).toHaveLength(0);

    const bm2 = `<w:bookmarkStart w:id="2" w:name="B2"/><w:p>${TEXT("y")}</w:p>`;
    const m2 = await auditDocx(await bufOf(minimalParts({ "word/document.xml": DOCUMENT(PAR(bm2)) })));
    expect(m2.bookmarkStartsWithoutEnd).toContain("2");

    const bm3 = `<w:p>${TEXT("z")}</w:p><w:bookmarkEnd w:id="3"/>`;
    const m3 = await auditDocx(await bufOf(minimalParts({ "word/document.xml": DOCUMENT(PAR(bm3)) })));
    expect(m3.bookmarkEndsWithoutStart).toContain("3");
  });

  it("bookmark nome/ID duplicado", async () => {
    const dup = `<w:bookmarkStart w:id="1" w:name="X"/><w:bookmarkEnd w:id="1"/><w:bookmarkStart w:id="1" w:name="X"/><w:bookmarkEnd w:id="1"/>`;
    const m = await auditDocx(await bufOf(minimalParts({ "word/document.xml": DOCUMENT(PAR(dup)) })));
    expect(m.bookmarkDuplicateIds.length).toBeGreaterThan(0);
    expect(m.bookmarkDuplicateNames.length).toBeGreaterThan(0);
  });

  it("12/24/25. TOC fragmentado / PAGEREF fragmentado / fldSimple / campo incompleto", async () => {
    const frag = `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
      `<w:r><w:instrText>TO</w:instrText></w:r><w:r><w:instrText>C \\o "1-3"</w:instrText></w:r>` +
      `<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
    const m = await auditDocx(await bufOf(minimalParts({ "word/document.xml": DOCUMENT(PAR(frag)) })));
    expect(m.tocFields).toBe(1);
    expect(m.fieldCommands).toContain("TOC \\o \"1-3\"");
    expect(m.fieldCommands[0]).toBe("TOC \\o \"1-3\"");

    const fragPr = `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
      `<w:r><w:instrText>PAGE</w:instrText></w:r><w:r><w:instrText>REF PDFBM001 \\h</w:instrText></w:r>` +
      `<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
    const m2 = await auditDocx(await bufOf(minimalParts({ "word/document.xml": DOCUMENT(PAR(fragPr)) })));
    expect(m2.pagerefFields).toBe(1);

    const fsimple = `<w:p><w:r><w:fldSimple w:instr="HYPERLINK &quot;https://x.com&quot;"><w:t>link</w:t></w:fldSimple></w:r></w:p>`;
    const m3 = await auditDocx(await bufOf(minimalParts({ "word/document.xml": DOCUMENT(fsimple) })));
    expect(m3.hyperlinkFields).toBe(1);

    const incomplete = `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>TOC \\o</w:instrText></w:r></w:p>`;
    const m4 = await auditDocx(await bufOf(minimalParts({ "word/document.xml": DOCUMENT(PAR(incomplete)) })));
    expect(m4.incompleteCommands).toBeGreaterThan(0);
  });

  it("13/14. múltiplos PAGEREF / HYPERLINK", async () => {
    const pr = (n: string) =>
      `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>PAGEREF ${n} \\h</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
    const hl = `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>HYPERLINK "https://x.com"</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
    const m = await auditDocx(await bufOf(minimalParts({ "word/document.xml": DOCUMENT(pr("PDFBM001") + pr("PDFBM002") + hl) })));
    expect(m.pagerefFields).toBe(2);
    expect(m.hyperlinkFields).toBe(1);
  });

  it("15/16. marcador visual presente e ausente", async () => {
    const m = await auditDocx(await bufOf(minimalParts({ "word/document.xml": DOCUMENT(PAR(TEXT(DEFAULT_MARKER + " - Conteudo em colunas, pagina 40."))) })));
    expect(m.markerCount).toBe(1);
    expect(m.markers[0].type).toBe("colunas");
    const m2 = await auditDocx(await buildDocx(minimalParts()));
    expect(m2.markerCount).toBe(0);
  });

  it("19/20/21. texto obrigatório / ausente / proibido", async () => {
    const m = await auditDocx(await buildDocx(minimalParts()), { termOccurrences: ["Ola mundo"] });
    expect(m.termOccurrences["Ola mundo"]).toBe(1);
    const ev = evaluateManifest(m, "pdf-text-draft", { expect: { requiredText: ["texto que nao existe"] } });
    expect(ev.approved).toBe(false);
    const m2 = await auditDocx(await bufOf(minimalParts({ "word/document.xml": DOCUMENT(PAR(TEXT("erro proibido"))) })));
    const ev2 = evaluateManifest(m2, "pdf-text-draft", { expect: { forbiddenText: ["erro proibido"] } });
    expect(ev2.approved).toBe(false);
  });

  it("22/23. general aceita tabela / pdf-text-draft reprova tabela quando 0", async () => {
    const tbl = `<w:tbl><w:tr><w:tc><w:p>${TEXT("c")}</w:p></w:tc></w:tr></w:tbl>`;
    const m = await auditDocx(await bufOf(minimalParts({ "word/document.xml": DOCUMENT(PAR(tbl)) })));
    expect(evaluateManifest(m, "general", {}).approved).toBe(true);
    expect(evaluateManifest(m, "pdf-text-draft", { expect: { wordTables: { exact: 0 } } }).approved).toBe(false);
  });

  it("26. JSON final serializável", async () => {
    const m = await auditDocx(await buildDocx(minimalParts()));
    expect(() => JSON.parse(JSON.stringify(m))).not.toThrow();
  });

  it("PNG truncado gera warning e continua; formato não PNG retorna null", async () => {
    const files = minimalParts(
      {
        "word/document.xml": DOCUMENT(PAR(DRAW("rId1")) + PAR(DRAW("rId2"))),
        "word/_rels/document.xml.rels": relsXml([
          { id: "rId1", type: IMG_TYPE, target: "media/bad.png" },
          { id: "rId2", type: IMG_TYPE, target: "media/ok.jpg" },
        ]),
      },
      { "bad.png": truncatedPng(), "ok.jpg": jpegMarker() }
    );
    const m = await auditDocx(await bufOf(files));
    expect(m.media.length).toBe(2);
    const bad = m.media.find((x: any) => x.name === "media/bad.png");
    expect(bad.dimensions).toHaveProperty("error");
    const ok = m.media.find((x: any) => x.name === "media/ok.jpg");
    expect(ok.dimensions).toBeNull();
    expect(ok.format).toBe("jpeg");
    // audit continues (no structural failure)
    expect(m.issues.failures.some((f: any) => f.code === "INVALID_PNG_HEADER")).toBe(false);
    expect(m.issues.warnings.some((w: any) => w.code === "INVALID_PNG_HEADER")).toBe(true);
  });

  it("presença de seção 4.3 no texto", async () => {
    const m = await auditDocx(await bufOf(minimalParts({ "word/document.xml": DOCUMENT(PAR(TEXT("Secao 4.3 objetivos"))) })));
    expect(m.hasSection43).toBe(true);
  });

  it("dimensões de imagem PNG resolvidas", async () => {
    const m = await auditDocx(await bufOf(minimalParts(
      { "word/document.xml": DOCUMENT(PAR(DRAW("rId1"))), "word/_rels/document.xml.rels": relsXml([{ id: "rId1", type: IMG_TYPE, target: "media/a.png" }]) },
      { "a.png": png() }
    )));
    expect(m.media[0].dimensions).toEqual({ width: 1, height: 1 });
  });

  it("headers e footers com desenho / relação quebrada", async () => {
    const headerXml = `<?xml version="1.0"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${PAR(DRAW("rIdH1"))}</w:hdr>`;
    const footerXml = `<?xml version="1.0"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${PAR(DRAW("rIdF1"))}</w:ftr>`;
    const hRels = relsXml([{ id: "rIdH1", type: IMG_TYPE, target: "media/h.png" }]);
    const fRels = relsXml([{ id: "rIdF1", type: IMG_TYPE, target: "media/missing-f.png" }]);
    const files = minimalParts(
      {
        "word/header1.xml": headerXml,
        "word/footer1.xml": footerXml,
        "word/_rels/header1.xml.rels": hRels,
        "word/_rels/footer1.xml.rels": fRels,
      },
      { "h.png": png() }
    );
    const m = await auditDocx(await bufOf(files));
    expect(m.headers.length).toBe(1);
    expect(m.footers.length).toBe(1);
    expect(m.headers[0].drawings).toBe(1);
    expect(m.footers[0].drawings).toBe(1);
    expect(m.brokenEmbeddedRelationships.length).toBeGreaterThan(0);
    expect(m.brokenEmbeddedRelationshipCount).toBeGreaterThan(0);
  });

  it("sequência com múltiplos desenhos no mesmo parágrafo", async () => {
    const para = PAR(DRAW("rId1") + DRAW("rId2"));
    const m = await auditDocx(await bufOf(minimalParts(
      { "word/document.xml": DOCUMENT(para), "word/_rels/document.xml.rels": relsXml([
        { id: "rId1", type: IMG_TYPE, target: "media/a.png" },
        { id: "rId2", type: IMG_TYPE, target: "media/b.png" },
      ]) },
      { "a.png": png(), "b.png": png() }
    )));
    const seq = m.sequence.find((s: any) => s.drawingCount === 2);
    expect(seq).toBeTruthy();
    expect(seq.rIds.length).toBe(2);
    expect(seq.origin).toBe("body");
  });
});

describe("Relações externas", () => {
  it("28/29. TargetMode External e r:link", async () => {
    const files = minimalParts({
      "word/document.xml": DOCUMENT(PAR(DRAW("rIdExt")) + PAR(`<w:r><w:drawing><wp:inline><a:graphic xmlns:a="http://x"><a:graphicData><pic:pic xmlns:pic="http://y"><pic:blipFill><a:blip r:link="rIdLink" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></pic:blipFill></pic:pic></a:graphicData></wp:inline></w:drawing></w:r>`)),
      "word/_rels/document.xml.rels": relsXml([
        { id: "rIdExt", type: IMG_TYPE, target: "https://example.com/img.png", mode: "External" },
        { id: "rIdLink", type: IMG_TYPE, target: "https://example.com/link.png", mode: "External" },
      ]),
    });
    const m = await auditDocx(await bufOf(files));
    expect(m.externalImageRelationships).toBe(2);
    expect(evaluateManifest(m, "pdf-text-draft", { expect: {} }).approved).toBe(false);
    // allow explicitly
    expect(evaluateManifest(m, "pdf-text-draft", { expect: { allowExternalImages: true } }).approved).toBe(true);
  });

  it("30. relação de imagem não usada", async () => {
    const files = minimalParts({
      "word/document.xml": DOCUMENT(PAR(TEXT("sem desenho"))),
      "word/_rels/document.xml.rels": relsXml([{ id: "rIdUnused", type: IMG_TYPE, target: "media/u.png" }]),
    }, { "u.png": png() });
    const m = await auditDocx(await bufOf(files));
    expect(m.unusedImageRelationships).toContain("rIdUnused");
  });

  it("31. mídia referenciada duas vezes (rIds distintos, mesma mídia)", async () => {
    const files = minimalParts({
      "word/document.xml": DOCUMENT(PAR(DRAW("rId1")) + PAR(DRAW("rId2"))),
      "word/_rels/document.xml.rels": relsXml([
        { id: "rId1", type: IMG_TYPE, target: "media/a.png" },
        { id: "rId2", type: IMG_TYPE, target: "media/a.png" },
      ]),
    }, { "a.png": png() });
    const m = await auditDocx(await bufOf(files));
    expect(m.embeddedImageRelationships).toBe(2);
    expect(m.mediaCount).toBe(1);
  });

  it("unresolvedBlipReferences quando r:embed sem relação", async () => {
    const files = minimalParts({ "word/document.xml": DOCUMENT(PAR(DRAW("rIdGhost"))) });
    const m = await auditDocx(await bufOf(files));
    expect(m.unresolvedBlipReferences).toContain("rIdGhost");
  });
});

describe("API uniforme de expectativas", () => {
  it("13/14. número = exact / {exact}", async () => {
    const m = await auditDocx(await buildDocx(minimalParts()));
    expect(evaluateManifest(m, "pdf-text-draft", { expect: { markers: 0 } }).approved).toBe(true);
    expect(evaluateManifest(m, "pdf-text-draft", { expect: { markers: { exact: 0 } } }).approved).toBe(true);
    expect(evaluateManifest(m, "pdf-text-draft", { expect: { markers: { exact: 1 } } }).approved).toBe(false);
  });

  it("15/16/17. {min} / {max} / {min,max}", async () => {
    const m = await auditDocx(await buildDocx(minimalParts()));
    expect(evaluateManifest(m, "pdf-text-draft", { expect: { markers: { min: 0 } } }).approved).toBe(true);
    expect(evaluateManifest(m, "pdf-text-draft", { expect: { markers: { max: 0 } } }).approved).toBe(true);
    expect(evaluateManifest(m, "pdf-text-draft", { expect: { markers: { min: 0, max: 2 } } }).approved).toBe(true);
    expect(evaluateManifest(m, "pdf-text-draft", { expect: { markers: { min: 1 } } }).approved).toBe(false);
    expect(evaluateManifest(m, "pdf-text-draft", { expect: { markers: { max: -1 } } }).approved).toBe(false);
  });

  it("18/19. exact+min inválido / min>max inválido", async () => {
    expect(validateExpectSpec("markers", { exact: 4, min: 2 })).toMatch(/exact/);
    expect(validateExpectSpec("markers", { min: 5, max: 3 })).toMatch(/min maior/);
  });

  it("20. métrica desconhecida", async () => {
    expect(validateExpectSpec("naoExiste", { exact: 1 })).toMatch(/desconhecida/);
  });

  it("22. 0,3,4,5 marcadores com exact 4", async () => {
    const files = (n: number) => {
      let body = "";
      for (let i = 0; i < n; i++) body += PAR(TEXT(DEFAULT_MARKER + " x" + i));
      return minimalParts({ "word/document.xml": DOCUMENT(body) });
    };
    for (const n of [0, 3, 4, 5]) {
      const m = await auditDocx(await bufOf(files(n)));
      const ok = evaluateManifest(m, "pdf-text-draft", { expect: { markers: { exact: 4 } } }).approved;
      expect(ok).toBe(n === 4);
    }
  });

  it("23. 98,99,100 bookmarks com exact 99", async () => {
    const files = (n: number) => {
      let body = "";
      for (let i = 0; i < n; i++) body += `<w:bookmarkStart w:id="${i}" w:name="B${i}"/><w:p>${TEXT("x")}</w:p><w:bookmarkEnd w:id="${i}"/>`;
      return minimalParts({ "word/document.xml": DOCUMENT(body) });
    };
    for (const n of [98, 99, 100]) {
      const m = await auditDocx(await bufOf(files(n)));
      const ok = evaluateManifest(m, "pdf-text-draft", { expect: { bookmarks: { exact: 99 }, bookmarkEnds: { exact: 99 } } }).approved;
      expect(ok).toBe(n === 99);
    }
  });

  it("24/25. TOC fragmentado e PAGEREF fragmentado produzem 1 comando", async () => {
    const frag = `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>TO</w:instrText></w:r><w:r><w:instrText>C \\o "1-3"</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
    const m = await auditDocx(await bufOf(minimalParts({ "word/document.xml": DOCUMENT(PAR(frag)) })));
    expect(m.tocFields).toBe(1);
  });
});

describe("UTF-8 e encoding de expectativas", () => {
  it("32. expectativas UTF-8 válidas", () => {
    const json = JSON.stringify({ profile: "pdf-text-draft", expect: { requiredText: ["Quadro 16 – Considerações."] } });
    const r = parseExpectationsBytes(Buffer.from(json, "utf8"));
    expect(r.errors).toHaveLength(0);
  });

  it("33. expectativas JSON inválidas", () => {
    const r = parseExpectationsBytes(Buffer.from('{ invalid json', "utf8"));
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("34. mojibake detectado", () => {
    const json = JSON.stringify({ profile: "pdf-text-draft", expect: { requiredText: ["Quadro 16 â€“ ConsideraÃ§oes"] } });
    const r = parseExpectationsBytes(Buffer.from(json, "utf8"));
    expect(r.errors.some((e: string) => e.includes("codificacao"))).toBe(true);
  });

  it("BOM tratado", () => {
    const json = "﻿" + JSON.stringify({ profile: "general", expect: {} });
    const r = parseExpectationsBytes(Buffer.from(json, "utf8"));
    expect(r.errors).toHaveLength(0);
  });
});

describe("Limites ZIP", () => {
  it("35. entradas acima do limite", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (let i = 0; i < 10; i++) zip.file(`f${i}.xml`, "<x/>");
    const buf = (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
    const m = await auditDocx(buf, { limits: { maxEntries: 5 } });
    expect(m.issues.failures.some((f: any) => f.code === "ZIP_ENTRY_LIMIT")).toBe(true);
  });

  it("36. entrada acima do limite", async () => {
    const big = "x".repeat(100);
    const m = await auditDocx(await bufOf(minimalParts({ "word/document.xml": DOCUMENT(PAR(TEXT(big))) })), {
      limits: { maxSingleEntryBytes: 10, maxXmlEntryBytes: 10 },
    });
    expect(
      m.issues.failures.some((f: any) => f.code === "ZIP_SINGLE_ENTRY_LIMIT" || f.code === "ZIP_XML_ENTRY_LIMIT")
    ).toBe(true);
  });
});

describe("CLI (subprocesso, sem Word)", () => {
  function runCli(args: string[], cwd: string): number {
    try {
      execFileSync("node", [path.join(__dirname, "..", "scripts", "acceptance", "audit-docx.mjs"), ...args], { cwd, stdio: "pipe" });
      return 0;
    } catch (e: any) {
      return typeof e.status === "number" ? e.status : 1;
    }
  }

  it("46. CLI mantém DOCX original intacto", async () => {
    const docxPath = path.join(workDir, "immutable.docx");
    fs.writeFileSync(docxPath, await buildDocx(minimalParts()));
    const before = fs.readFileSync(docxPath);
    runCli(["--docx", docxPath], workDir);
    const after = fs.readFileSync(docxPath);
    expect(Buffer.compare(before, after)).toBe(0);
  });

  it("30/47. caminhos com espaços e aprovação", async () => {
    const dir = path.join(workDir, "pasta com espaco");
    fs.mkdirSync(dir, { recursive: true });
    const docxPath = path.join(dir, "arquivo com espaco.docx");
    const outPath = path.join(dir, "manifest com espaco.json");
    fs.writeFileSync(docxPath, await buildDocx(minimalParts()));
    const code = runCli(["--docx", docxPath, "--output", outPath], dir);
    expect(code).toBe(0);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  it("CLI reprovado retorna !=0", async () => {
    const docxPath = path.join(workDir, "broken.docx");
    fs.writeFileSync(docxPath, await buildDocx(minimalParts({
      "word/document.xml": DOCUMENT(PAR(DRAW("rIdX"))),
      "word/_rels/document.xml.rels": relsXml([{ id: "rIdX", type: IMG_TYPE, target: "media/missing.png" }]),
    })));
    const code = runCli(["--docx", docxPath], workDir);
    expect(code).toBe(1);
  });

  it("15. perfil inválido retorna código !=0", async () => {
    const docxPath = path.join(workDir, "ok.docx");
    fs.writeFileSync(docxPath, await buildDocx(minimalParts()));
    const code = runCli(["--docx", docxPath, "--profile", "nao-existe"], workDir);
    expect(code).toBe(5);
  });

  it("expectativas com codificação inválida retorna !=0", async () => {
    const docxPath = path.join(workDir, "ok2.docx");
    fs.writeFileSync(docxPath, await buildDocx(minimalParts()));
    const expPath = path.join(workDir, "bad.json");
    // latin1 bytes that are invalid UTF-8
    fs.writeFileSync(expPath, Buffer.from(Uint8Array.from([0xff, 0xfe, 0x7b])));
    const code = runCli(["--docx", docxPath, "--expect", expPath, "--profile", "pdf-text-draft"], workDir);
    expect(code).toBe(6);
  });

  it("5. metrics.brokenRelationships é número (não array)", async () => {
    const docxPath = path.join(workDir, "br.docx");
    fs.writeFileSync(docxPath, await buildDocx(minimalParts()));
    const outPath = path.join(workDir, "audit-br.json");
    const code = runCli(["--docx", docxPath, "--profile", "pdf-text-draft", "--output", outPath], workDir);
    expect(code).toBe(0);
    const raw = fs.readFileSync(outPath, "utf8");
    const parsed = JSON.parse(raw);
    expect(typeof parsed.metrics.brokenRelationships).toBe("number");
    expect(Array.isArray(parsed.metrics.brokenRelationships)).toBe(false);
    expect(parsed.metrics.brokenRelationships).toBe(0);
  });
});

describe("14. reforço de resolução de targets e relacionamentos", () => {
  it("body carrega document.xml.rels (não null)", async () => {
    const m = await auditDocx(await bufOf(minimalParts({
      "word/document.xml": DOCUMENT(PAR(DRAW("rId1"))),
      "word/_rels/document.xml.rels": relsXml([{ id: "rId1", type: IMG_TYPE, target: "media/a.png" }]),
    }, { "a.png": png() })));
    expect(m.embeddedImageRelationships).toBe(1);
    expect(m.mediaCount).toBe(1);
  });

  it("relação de header carrega o rel correto (word/_rels/header1.xml.rels)", async () => {
    const hRels = relsXml([{ id: "rIdH1", type: IMG_TYPE, target: "media/h.png" }]);
    const files = minimalParts(
      { "word/header1.xml": "<w:hdr xmlns:w=\"http://w\"><w:p><w:r><w:drawing><wp:inline/></w:drawing></w:r></w:p></w:hdr>" },
      { "h.png": png() }
    );
    files["word/_rels/header1.xml.rels"] = hRels;
    const m = await auditDocx(await bufOf(files));
    expect(m.headers[0].embeddedImageRelationships).toBe(1);
    expect(m.headers[0].mediaCount).toBe(1);
  });

  it("relação de footer carrega o rel correto (word/_rels/footer1.xml.rels)", async () => {
    const fRels = relsXml([{ id: "rIdF1", type: IMG_TYPE, target: "media/f.png" }]);
    const files = minimalParts(
      { "word/footer1.xml": "<w:ftr xmlns:w=\"http://w\"><w:p><w:r><w:drawing><wp:inline/></w:drawing></w:r></w:p></w:ftr>" },
      { "f.png": png() }
    );
    files["word/_rels/footer1.xml.rels"] = fRels;
    const m = await auditDocx(await bufOf(files));
    expect(m.footers[0].embeddedImageRelationships).toBe(1);
  });

  it("target 'media/a.png', './media/a.png' e barras invertidas resolvem para word/media/a.png", async () => {
    for (const target of ["media/a.png", "./media/a.png", "media\\a.png"]) {
      const m = await auditDocx(await bufOf(minimalParts({
        "word/document.xml": DOCUMENT(PAR(DRAW("rId1"))),
        "word/_rels/document.xml.rels": relsXml([{ id: "rId1", type: IMG_TYPE, target }]),
      }, { "a.png": png() })));
      expect(m.embeddedImageRelationships).toBe(1);
      expect(m.mediaCount).toBe(1);
    }
  });

  it("target relativo normalizado não gera relação quebrada", async () => {
    const m = await auditDocx(await bufOf(minimalParts({
      "word/document.xml": DOCUMENT(PAR(DRAW("rId1"))),
      "word/_rels/document.xml.rels": relsXml([{ id: "rId1", type: IMG_TYPE, target: "../word/media/a.png" }]),
    }, { "a.png": png() })));
    expect(m.embeddedImageRelationships).toBe(1);
    expect(m.brokenEmbeddedRelationshipCount).toBe(0);
  });

  it("r:link conta como utilizado e aprova quando allowExternalImages", async () => {
    const files = minimalParts({
      "word/document.xml": DOCUMENT(PAR(`<w:r><w:drawing><wp:inline><a:graphic xmlns:a="http://x"><a:graphicData><pic:pic xmlns:pic="http://y"><pic:blipFill><a:blip r:link="rIdLink" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></pic:blipFill></pic:pic></a:graphicData></wp:inline></w:drawing></w:r>`)),
      "word/_rels/document.xml.rels": relsXml([
        { id: "rIdLink", type: IMG_TYPE, target: "media/linked.png", mode: "External" },
      ]),
    });
    const m = await auditDocx(await bufOf(files));
    expect(m.usedImageRelationships).toBe(1);
    expect(m.externalImageRelationships).toBe(1);
    expect(evaluateManifest(m, "pdf-text-draft", { expect: { allowExternalImages: true } }).approved).toBe(true);
  });

  it("relação externa não procura arquivo ZIP", async () => {
    const files = minimalParts({
      "word/document.xml": DOCUMENT(PAR(DRAW("rIdExt"))),
      "word/_rels/document.xml.rels": relsXml([
        { id: "rIdExt", type: IMG_TYPE, target: "https://example.com/img.png", mode: "External" },
      ]),
    }, { "img.png": png() });
    const m = await auditDocx(await bufOf(files));
    expect(m.externalImageRelationships).toBe(1);
    expect(m.brokenEmbeddedRelationshipCount).toBe(0);
  });

  it("arquivo físico órfão é listado", async () => {
    const m = await auditDocx(await bufOf(minimalParts({}, { "orphan.png": png() })));
    expect(m.orphanMedia).toContain("media/orphan.png");
    expect(m.orphanMediaCount).toBe(1);
  });

  it("mídia usada apenas no header não é órfã", async () => {
    const hRels = relsXml([{ id: "rIdH1", type: IMG_TYPE, target: "media/h.png" }]);
    const files = minimalParts(
      { "word/header1.xml": "<w:hdr xmlns:w=\"http://w\"><w:p><w:r><w:drawing><wp:inline/></w:drawing></w:r></w:p></w:hdr>" },
      { "h.png": png() }
    );
    files["word/_rels/header1.xml.rels"] = hRels;
    const m = await auditDocx(await bufOf(files));
    expect(m.orphanMedia).not.toContain("media/h.png");
  });

  it("duas relações para um arquivo = 2 relações e 1 mídia", async () => {
    const m = await auditDocx(await bufOf(minimalParts({
      "word/document.xml": DOCUMENT(PAR(DRAW("rId1")) + PAR(DRAW("rId2"))),
      "word/_rels/document.xml.rels": relsXml([
        { id: "rId1", type: IMG_TYPE, target: "media/a.png" },
        { id: "rId2", type: IMG_TYPE, target: "media/a.png" },
      ]),
    }, { "a.png": png() })));
    expect(m.embeddedImageRelationships).toBe(2);
    expect(m.mediaCount).toBe(1);
  });

  it("dois arquivos com mesmo SHA-256 = duplicação", async () => {
    const same = png();
    const m = await auditDocx(await bufOf(minimalParts({
      "word/document.xml": DOCUMENT(PAR(DRAW("rId1")) + PAR(DRAW("rId2"))),
      "word/_rels/document.xml.rels": relsXml([
        { id: "rId1", type: IMG_TYPE, target: "media/a.png" },
        { id: "rId2", type: IMG_TYPE, target: "media/b.png" },
      ]),
    }, { "a.png": same, "b.png": same })));
    expect(m.duplicateMediaCount).toBe(1);
  });

  it("relação quebrada mantém lista e count", async () => {
    const m = await auditDocx(await bufOf(minimalParts({
      "word/document.xml": DOCUMENT(PAR(DRAW("rId9"))),
      "word/_rels/document.xml.rels": relsXml([{ id: "rId9", type: IMG_TYPE, target: "media/missing.png" }]),
    })));
    expect(Array.isArray(m.brokenEmbeddedRelationships)).toBe(true);
    expect(m.brokenEmbeddedRelationships.length).toBeGreaterThan(0);
    expect(m.brokenEmbeddedRelationshipCount).toBe(m.brokenEmbeddedRelationships.length);
  });

  it("nenhum array agregado contém undefined", async () => {
    const m = await auditDocx(await bufOf(minimalParts({
      "word/document.xml": DOCUMENT(PAR(DRAW("rId1"))),
      "word/_rels/document.xml.rels": relsXml([{ id: "rId1", type: IMG_TYPE, target: "media/a.png" }]),
    }, { "a.png": png() })));
    const arrays = [
      m.embeddedImageRelationshipList,
      m.externalImageRelationshipList,
      m.brokenEmbeddedRelationships,
      m.orphanMedia,
    ];
    for (const arr of arrays) {
      if (arr) expect(arr.every((x: any) => x !== undefined)).toBe(true);
    }
  });

  it("comando TOC fragmentado preserva \\o", async () => {
    const frag = `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
      `<w:r><w:instrText>TO</w:instrText></w:r><w:r><w:instrText>C \\o "1-3"</w:instrText></w:r>` +
      `<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
    const m = await auditDocx(await bufOf(minimalParts({ "word/document.xml": DOCUMENT(PAR(frag)) })));
    expect(m.fieldCommands[0]).toBe("TOC \\o \"1-3\"");
  });
});

describe("3. resolução de targets relativos (URI relativa)", () => {
  it("resolve varios casos relativos corretamente", () => {
    expect(resolveTarget("word/document.xml", "media/a.png")).toBe("word/media/a.png");
    expect(resolveTarget("word/document.xml", "./media/a.png")).toBe("word/media/a.png");
    expect(resolveTarget("word/header1.xml", "media/h.png")).toBe("word/media/h.png");
    expect(resolveTarget("word/footer2.xml", "media/f.png")).toBe("word/media/f.png");
    // ../media sobe um nível a partir de word/ -> media/f.png (fora de word/)
    expect(resolveTarget("word/footer2.xml", "../media/f.png")).toBe("media/f.png");
    // escapa da raiz do pacote -> invalido
    expect(resolveTarget("word/footer2.xml", "../../escape.png")).toBeNull();
  });

  it("barras invertidas sao normalizadas", () => {
    expect(resolveTarget("word/document.xml", "media\\a.png")).toBe("word/media/a.png");
  });

  it("URLs externas e absolutas nao sao resolvidas como pacote", () => {
    expect(resolveTarget("word/document.xml", "https://example.com/img.png")).toBeNull();
    expect(resolveTarget("word/document.xml", "file:///c:/img.png")).toBeNull();
    expect(resolveTarget("word/document.xml", "/abs/img.png")).toBeNull();
  });
});

describe("4. imagem interna fora de word/media", () => {
  it("relação interna para media/f.png fora de word/media nao e quebrada e gera aviso", async () => {
    const files = minimalParts({
      "word/document.xml": DOCUMENT(PAR(DRAW("rId1"))),
      "word/_rels/document.xml.rels": relsXml([{ id: "rId1", type: IMG_TYPE, target: "../media/f.png" }]),
    });
    // coloca a imagem fora de word/media (media/f.png)
    files["media/f.png"] = png();
    const m = await auditDocx(await bufOf(files));
    expect(m.embeddedImageRelationships).toBe(1);
    expect(m.brokenEmbeddedRelationshipCount).toBe(0);
    expect(m.mediaCount).toBe(1);
    expect(m.orphanMediaCount).toBe(0);
    expect(m.media[0].zipPath).toBe("media/f.png");
    expect(m.issues.warnings.some((w: any) => w.code === "NONSTANDARD_IMAGE_PART_LOCATION")).toBe(true);
  });
});
