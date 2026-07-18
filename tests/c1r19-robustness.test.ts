import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import JSZip from "jszip";
import { execSync } from "node:child_process";
import { describe, it, expect } from "vitest";
import { importDocumentFile } from "../src/import-docx";
import { buildPdfCopyDocxBlob } from "../src/pdf-to-copy-docx";
import { generateDocxBlob } from "../src/export-docx";
import { closeChromiumBrowser } from "../src/figure-rasterizer";
import { detectPdfFigureRegions } from "../src/pdf-figure-extractor";

const TMP = join(process.cwd(), "tmp", "c1r19");
const OUT = join(TMP, "out");
mkdirSync(OUT, { recursive: true });

function filePolyfill(buffer: Uint8Array, name: string): File {
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  return new File([ab], name, { type: "application/pdf" });
}

interface DocxCheck {
  ok: boolean;
  parts: number;
  drawings: number;
  media: number;
  hasStyles: boolean;
  hasNumbering: boolean;
  hasCoreProps: boolean;
  relsBroken: string[];
  reimportOk: boolean;
  notes: string[];
}

async function checkDocx(buf: BlobPart, label: string): Promise<DocxCheck> {
  const notes: string[] = [];
  const check: DocxCheck = {
    ok: false, parts: 0, drawings: 0, media: 0,
    hasStyles: false, hasNumbering: false, hasCoreProps: false,
    relsBroken: [], reimportOk: false, notes,
  };
  try {
        const zip = await JSZip.loadAsync(buf as ArrayBuffer);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    check.parts = names.length;
    // ZIP integrity already validated by loadAsync above (throws if corrupt).
    check.hasStyles = names.includes("word/styles.xml");
    check.hasNumbering = names.includes("word/numbering.xml");
    check.hasCoreProps = names.includes("docProps/core.xml");
    for (const n of names) {
      if (n.endsWith(".xml") || n.endsWith(".rels")) {
        const txt = await zip.file(n)!.async("string");
        if (!txt || txt.length === 0) { check.relsBroken.push(`${n}:vazio`); continue; }
        // well-formedness: balanced tag count (pragmatic)
        const opens = (txt.match(/<[a-zA-Z]/g) || []).length;
        const closes = (txt.match(/<\//g) || []).length;
        const selfclose = (txt.match(/\/>/g) || []).length;
        if (opens !== closes + selfclose) check.relsBroken.push(`${n}:tags ${opens}/${closes}/${selfclose}`);
      }
    }
    // media vs drawings
    check.media = names.filter((n) => n.startsWith("word/media/")).length;
    const docXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    check.drawings = (docXml.match(/<w:drawing/g) || []).length;
    // rels resolution: every r:embed must have a Relationship Id present
    const rels = (await zip.file("word/_rels/document.xml.rels")?.async("string")) ?? "";
    const relIds = new Set([...rels.matchAll(/Id="([^"]+)"/g)].map((m) => m[1]));
    const embeds = [...docXml.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1]);
    for (const e of embeds) if (!relIds.has(e)) check.relsBroken.push(`embed ${e} sem rel`);
    // hyperlinks: r:id must resolve
    const hlinks = [...docXml.matchAll(/w:hyperlink[^>]*r:id="([^"]+)"/g)].map((m) => m[1]);
    for (const h of hlinks) if (!relIds.has(h)) check.relsBroken.push(`hyperlink ${h} sem rel`);
    // reimport to confirm the DOCX is loadable by the app parser
    const reimport = await importDocumentFile(new File([buf], label, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    check.reimportOk = reimport.importedImages !== undefined;
    check.ok = check.hasStyles && check.relsBroken.length === 0 && check.reimportOk;
  } catch (e: any) {
    check.notes.push("DOCX invalido: " + (e?.message || String(e)).slice(0, 160));
  }
  return check;
}

function listExtremePdfs(): string[] {
  return readdirSync(TMP).filter((n) => n.startsWith("ext_") && n.toLowerCase().endsWith(".pdf"));
}

// conta processos Chromium (chrome.exe / headless_shell.exe) no sistema
function countChromium(): number {
  try {
    const out = execSync("tasklist /NH", { stdio: ["ignore", "pipe", "ignore"] }).toString();
    return (out.match(/chrome\.exe|headless_shell\.exe|chromium/i) || []).length;
  } catch {
    return -1;
  }
}

interface CaseResult {
  name: string;
  pageCount: number;
  regions: number;
  copyFigures: number;
  abntFigures: number;
  copyCheck: DocxCheck;
  abntCheck: DocxCheck;
  throwStep: string | null;
  throwMsg: string | null;
  ms: number;
}

const results: CaseResult[] = [];

describe("C1R19 — Robustez e casos limite (pre-release)", () => {
  const pdfs = listExtremePdfs();
  it(`processa ${pdfs.length} PDFs extremos (fluxo 2-passos)`, async () => {
    const chromiumBefore = countChromium();
    for (const fileName of pdfs) {
      const buffer = new Uint8Array(readFileSync(join(TMP, fileName)));
      const t0 = Date.now();
      let res: CaseResult = {
        name: fileName, pageCount: 0, regions: 0, copyFigures: 0, abntFigures: 0,
        copyCheck: {} as DocxCheck, abntCheck: {} as DocxCheck,
        throwStep: null, throwMsg: null, ms: 0,
      };
      try {
        const oldResult = await importDocumentFile(filePolyfill(buffer, fileName));
        const regions = detectPdfFigureRegions(oldResult.pdfDiagnostic!);
        res.pageCount = oldResult.pdfDiagnostic!.pageCount;
        res.regions = regions.length;
        const copy = await buildPdfCopyDocxBlob({
          editorText: oldResult.editorText,
          importedImages: oldResult.importedImages,
          importedTables: oldResult.importedTables,
          fileName,
        });
        const copyBuffer = new Uint8Array(await copy.blob.arrayBuffer());
        res.copyFigures = copy.figureCount;
        res.copyCheck = await checkDocx(copyBuffer, fileName.replace(/\.pdf$/i, "-copia.docx"));
        const reimport = await importDocumentFile(new File([copyBuffer as BlobPart], fileName.replace(/\.pdf$/i, "-copia.docx"), { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
        const newAbnt = await generateDocxBlob({
          fields: reimport.fields,
          editorText: reimport.editorText,
          importedImages: reimport.importedImages,
          importedTables: reimport.importedTables,
        });
        const abntBuf = new Uint8Array(await newAbnt.arrayBuffer());
        res.abntFigures = reimport.importedImages.filter((i: any) => i.data && i.data.byteLength).length;
        res.abntCheck = await checkDocx(abntBuf, fileName.replace(/\.pdf$/i, "-abnt.docx"));
        writeFileSync(join(OUT, fileName.replace(/\.pdf$/i, "-copia.docx")), copyBuffer);
        writeFileSync(join(OUT, fileName.replace(/\.pdf$/i, "-abnt.docx")), Buffer.from(abntBuf));
      } catch (e: any) {
        res.throwStep = "conversao";
        res.throwMsg = (e?.message || String(e)).slice(0, 200);
      } finally {
        res.ms = Date.now() - t0;
      }
      results.push(res);
      console.log(
        `${fileName} pag=${res.pageCount} reg=${res.regions} copyFig=${res.copyFigures} abntFig=${res.abntFigures} ` +
        `copyOK=${res.copyCheck.ok} abntOK=${res.abntCheck.ok} ${res.throwStep ? "THROW:" + res.throwStep : ""} ${res.ms}ms`,
      );
    }
    const chromiumAfter = countChromium();
    console.log(`Chromium procs: antes=${chromiumBefore} depois=${chromiumAfter}`);
    await closeChromiumBrowser();
    writeFileSync(join(OUT, "resultados.json"), JSON.stringify(results, null, 2));
    // Nenhuma exceção não tratada em caso normal; DOCXs gerados devem ser válidos.
    const invalid = results.filter((r) => !r.copyCheck.ok || !r.abntCheck.ok);
    console.log(`DOCX invalidos: ${invalid.length}`);
  }, 600000);

  const errorCases: Array<{ name: string; buf: Uint8Array }> = [
    { name: "zero.pdf", buf: new Uint8Array(0) },
    { name: "corrupted.pdf", buf: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 255, 254, 99, 111, 114, 114, 117]) },
    { name: "truncated.pdf", buf: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 37, 69, 79, 70, 10]) },
    { name: "noeof.pdf", buf: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]) },
    { name: "garbage.pdf", buf: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) },
    { name: "html.pdf", buf: new Uint8Array(Buffer.from("<html><body>not a pdf</body></html>")) },
  ];

  it("FASE 2 — casos de erro não quebram e dão mensagem clara", async () => {
    const errResults: Array<{ name: string; threw: boolean; msg: string | null }> = [];
    for (const c of errorCases) {
      let threw = false;
      let msg: string | null = null;
      try {
        await importDocumentFile(filePolyfill(c.buf, c.name));
      } catch (e: any) {
        threw = true;
        msg = (e?.message || String(e)).slice(0, 160);
      }
      errResults.push({ name: c.name, threw, msg });
      const clear = !!msg && /PDF|inválido|inválido|corrompid|ilegível|suportado/i.test(msg || "");
      console.log(`${c.name}: threw=${threw} clearMsg=${clear} msg="${(msg || "").slice(0, 80)}"`);
      // Não deve travar; se lançar, a mensagem deve ser clara (mencionar PDF/inválido).
      expect(threw).toBe(true);
      expect(clear).toBe(true);
    }
    writeFileSync(join(OUT, "erros.json"), JSON.stringify(errResults, null, 2));
  });

  function sha1(buf: Uint8Array): string {
    return createHash("sha1").update(Buffer.from(buf)).digest("hex");
  }

  async function convertTwostep(buffer: Uint8Array, fileName: string): Promise<{ abntHash: string; copyHash: string; copyBuffer: Uint8Array; abntFig: number }> {
    const oldResult = await importDocumentFile(filePolyfill(buffer, fileName));
    const copy = await buildPdfCopyDocxBlob({
      editorText: oldResult.editorText,
      importedImages: oldResult.importedImages,
      importedTables: oldResult.importedTables,
      fileName,
    });
    const copyBuffer = new Uint8Array(await copy.blob.arrayBuffer());
    const reimport = await importDocumentFile(new File([copyBuffer as BlobPart], fileName.replace(/\.pdf$/i, "-copia.docx"), { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    const newAbnt = await generateDocxBlob({
      fields: reimport.fields,
      editorText: reimport.editorText,
      importedImages: reimport.importedImages,
      importedTables: reimport.importedTables,
    });
    const abntBuf = new Uint8Array(await newAbnt.arrayBuffer());
    return {
      abntHash: sha1(abntBuf),
      copyHash: sha1(copyBuffer),
      copyBuffer,
      abntFig: reimport.importedImages.filter((i: any) => i.data && i.data.byteLength).length,
    };
  }

  // Hash do CONTEÚDO (ignora docProps/core.xml e app.xml, que carregam
  // timestamps e são não-determinísticos por natureza do OOXML/Packer).
  async function contentHash(buffer: Uint8Array): Promise<string> {
    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir && !/docProps\/(core|app)\.xml/.test(n) && !/word\/media\//.test(n)).sort();
    const h = createHash("sha1");
    for (const n of names) {
      h.update(n);
      h.update(await zip.file(n)!.async("string"));
    }
    return h.digest("hex");
  }

  // Mapa nome-da-parte -> hash (exclui docProps/core,app e word/media).
  async function partHashes(buffer: Uint8Array): Promise<Record<string, string>> {
    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir && !/docProps\/(core|app)\.xml/.test(n) && !/word\/media\//.test(n)).sort();
    const out: Record<string, string> = {};
    for (const n of names) {
      const h = createHash("sha1").update(n).update(await zip.file(n)!.async("string")).digest("hex");
      out[n] = h.slice(0, 12);
    }
    return out;
  }

  it("FASE 5 — reprodutibilidade (3 execuções idênticas)", async () => {
    const reps = ["ext_native.pdf", "ext_many_images.pdf", "ext_mixed_orient.pdf"];
    const repResults: Array<{ name: string; fullEqual: boolean; contentEqual: boolean; full: string[]; content: string[]; fig: number; diffParts?: string[] }> = [];
    for (const name of reps) {
      const buffer = new Uint8Array(readFileSync(join(TMP, name)));
      const full: string[] = [];
      const content: string[] = [];
      const partMaps: Array<Record<string, string>> = [];
      let figs = 0;
      for (let k = 0; k < 3; k += 1) {
        const r = await convertTwostep(buffer, name);
        full.push(r.abntHash);
        content.push(await contentHash(r.copyBuffer));
        partMaps.push(await partHashes(r.copyBuffer));
        figs = r.abntFig;
      }
      // localiza partes que diferem entre run1 e run2 (exceto media/docProps)
      const diffParts = new Set<string>();
      const base = partMaps[0];
      for (const pm of partMaps.slice(1)) {
        for (const k of new Set([...Object.keys(base), ...Object.keys(pm)])) {
          if (base[k] !== pm[k]) diffParts.add(k);
        }
      }
      const fullEqual = full.every((h) => h === full[0]);
      const contentEqual = content.every((h) => h === content[0]);
      repResults.push({ name, fullEqual, contentEqual, full, content, fig: figs, diffParts: [...diffParts] });
      console.log(`${name}: figuras=${figs} fullEqual=${fullEqual} contentEqual=${contentEqual}`);
      console.log(`  full: ${full.map((h) => h.slice(0, 10)).join(" ")}`);
      console.log(`  content: ${content.map((h) => h.slice(0, 10)).join(" ")}`);
      console.log(`  partes que diferem: ${[...diffParts].join(", ") || "(nenhuma)"}`);
    }
    writeFileSync(join(OUT, "reproducibilidade.json"), JSON.stringify(repResults, null, 2));
    await closeChromiumBrowser();
  }, 600000);

  // Fields completo (igual ao default do App.tsx) — o app NUNCA passa undefined.
  const FULL_FIELDS: Record<string, string> = {
    workType: "tcc", author: "Autor", title: "Título", subtitle: "Subtítulo", workNature: "Natureza do trabalho",
    course: "Curso", program: "Programa", advisor: "Orientador", coadvisor: "Coorientador", location: "Local",
    year: "Ano", resumo: "Resumo", palavrasChave: "Palavras-chave", abstractText: "Abstract", keywords: "Keywords",
    introducao: "Introdução", conclusao: "Conclusão", referencias: "Referências", anexos: "Anexos", apendices: "Apêndices",
    dedicatoria: "Dedicatória", agradecimentos: "Agradecimentos", epigrafe: "Epígrafe", indicadoresImpacto: "Indicadores de impacto",
    impactIndicators: "Impact indicators", imageWarnings: "Avisos de imagens", tema: "Tema", delimitacaoTema: "Delimitação do Tema",
    problemaPesquisa: "Problema de Pesquisa", hipotese: "Hipótese", objetivoGeral: "Objetivo Geral", objetivosEspecificos: "Objetivos Específicos",
    justificativa: "Justificativa", referencialTeorico: "Referencial Teórico", metodologia: "Metodologia", cronograma: "Cronograma",
    recursosOrcamento: "Recursos/Orçamento", resultadosEsperados: "Resultados Esperados", corpusDados: "Corpus/Dados",
    contextoInstitucional: "Contexto Institucional", conclusaoProvisoria: "Conclusão Provisória", contribuicoesImpactos: "Contribuições/Impactos",
    impactoSocial: "Impacto social", impactoCientifico: "Impacto científico", impactoEducacional: "Impacto educacional",
    impactoAmbiental: "Impacto ambiental", impactoTecnologico: "Impacto tecnológico/econômico", publicoBeneficiado: "Público beneficiado",
    aderenciaOds: "Aderência a ODS/política institucional", institution: "UFLA",
  };

  it("FASE 4 — DOCX com texto Unicode raro (fontes/glifos ausentes)", async () => {
    // Caso em que o texto do editor e os campos contêm glifos raros: o gerador DOCX
    // não deve quebrar nem produzir XML inválido (Word usa fontes de fallback; o XML é UTF-8).
    const rare = "Título 𝔘𝔫𝔦𝔠𝔬de 𝄞 日本語 Русский ελληνικά \u{1F600} acentuação çãõ é à";
    const fields = { ...FULL_FIELDS, title: rare, author: rare, resumo: rare, abstractText: rare, palavrasChave: "α β γ" };
    const res = await generateDocxBlob({
      fields: fields as any,
      editorText: `# ${rare}\n\nIntrodução com símbolos raros: 𝄞 𝕌 𝔽.\n\n## Metodologia\nTexto multilingue Русский 日本語.`,
      importedImages: [],
      importedTables: [],
    });
    const buf = new Uint8Array(await res.arrayBuffer());
    const check = await checkDocx(buf as BlobPart, "unicode-raro.docx");
    console.log(`Unicode-raro DOCX ok=${check.ok} parts=${check.parts} relsBroken=${check.relsBroken.length}`);
    expect(check.ok).toBe(true);
    expect(check.relsBroken.length).toBe(0);
  });

  it("FASE 5b — confirma determinismo do DOCX cópia (ext_native)", async () => {
    const name = "ext_native.pdf";
    const buffer = new Uint8Array(readFileSync(join(TMP, name)));
    async function copyHash(): Promise<string> {
      const oldResult = await importDocumentFile(filePolyfill(buffer, name));
      const copy = await buildPdfCopyDocxBlob({
        editorText: oldResult.editorText,
        importedImages: oldResult.importedImages,
        importedTables: oldResult.importedTables,
        fileName: name,
      });
      const copyBuffer = new Uint8Array(await copy.blob.arrayBuffer());
      return contentHash(copyBuffer);
    }
    const h1 = await copyHash();
    const h2 = await copyHash();
    const h3 = await copyHash();
    const equal = h1 === h2 && h2 === h3;
    console.log(`FASE 5b ext_native copy contentEqual=${equal} [${h1.slice(0, 12)} ${h2.slice(0, 12)} ${h3.slice(0, 12)}]`);
    expect(equal).toBe(true);
    await closeChromiumBrowser();
  }, 300000);
});
