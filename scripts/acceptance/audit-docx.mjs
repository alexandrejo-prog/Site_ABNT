// scripts/acceptance/audit-docx.mjs
//
// Command line interface for the standalone DOCX structural auditor.
// Never mutates the source DOCX. Exit 0 on approval, non-zero on rejection.

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const core = await import(pathToFileURL(path.join(__dirname, "docx-audit-core.mjs")).href);
const { auditDocx, evaluateManifest, parseExpectationsBytes, VALID_PROFILES } = core;

function parseArgs(argv) {
  const opts = {};
  const errors = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const take = () => {
      const v = argv[++i];
      if (v === undefined) errors.push(`Falta valor para ${a}`);
      return v;
    };
    switch (a) {
      case "--docx":
      case "-d":
        opts.docx = take(); break;
      case "--profile":
      case "-p":
        opts.profile = take(); break;
      case "--expect":
      case "-e":
        opts.expect = take(); break;
      case "--output":
      case "-o":
        opts.output = take(); break;
      case "--marker":
        opts.marker = take(); break;
      case "--min-image-bytes":
        opts.minImageBytes = Number(take()); break;
      case "--no-paragraph-text":
        opts.captureParagraphText = false; break;
      case "--no-sequence":
        opts.captureSequence = false; break;
      case "--help":
      case "-h":
        opts.help = true; break;
      default:
        errors.push(`Argumento desconhecido: ${a}`);
    }
  }
  return { opts, errors };
}

function printHelp() {
  console.log(`Uso:
  node scripts/acceptance/audit-docx.mjs --docx "<caminho>.docx" [opcoes]

Opcoes:
  --docx, -d       Caminho do DOCX (obrigatorio)
  --profile, -p    general | pdf-text-draft (default: general)
  --expect, -e     Caminho de expectations JSON (UTF-8 estrito)
  --output, -o     Caminho do manifesto JSON de saida
  --marker         Marcador visual literal (default do projeto)
  --min-image-bytes Imagens abaixo disto sao marcadas pequenas
  --no-paragraph-text  Omitir texto integral dos paragrafos
  --no-sequence        Omitir sequencia simplificada
  --help, -h       Esta ajuda

Expectativas quantitativas aceitam numero exato ou objeto {exact|min|max}:
  "images": 30
  "markers": { "exact": 4 }
  "bookmarks": { "min": 90, "max": 100 }

Saida: JSON no stdout e/ou arquivo. Codigo 0 = aprovado, !=0 = reprovado.`);
}

function main() {
  const { opts, errors } = parseArgs(process.argv.slice(2));
  if (opts.help) { printHelp(); return 0; }
  if (errors.length) {
    for (const e of errors) console.error(`ERRO: ${e}`);
    printHelp();
    return 2;
  }
  if (!opts.docx) {
    console.error("ERRO: --docx e obrigatorio.");
    printHelp();
    return 2;
  }
  if (!fs.existsSync(opts.docx)) {
    console.error(`ERRO: DOCX nao encontrado: ${opts.docx}`);
    return 3;
  }

  const profile = opts.profile || "general";
  if (!VALID_PROFILES.includes(profile)) {
    const msg = `Perfil invalido: ${profile}. Perfis aceitos: ${VALID_PROFILES.join(", ")}`;
    console.error(`ERRO: ${msg}`);
    const failManifest = {
      approved: false,
      profile,
      failures: [{ code: "INVALID_PROFILE", message: msg }],
      warnings: [],
    };
    if (opts.output) {
      fs.mkdirSync(path.dirname(opts.output), { recursive: true });
      fs.writeFileSync(opts.output, JSON.stringify(failManifest, null, 2) + "\n", "utf8");
    }
    console.log(JSON.stringify(failManifest, null, 2));
    return 5;
  }

  // Load expectations as strict UTF-8 bytes.
  let expectRaw = {};
  if (opts.expect) {
    if (!fs.existsSync(opts.expect)) {
      console.error(`ERRO: Arquivo de expectativas nao encontrado: ${opts.expect}`);
      return 3;
    }
    const bytes = fs.readFileSync(opts.expect);
    const parsed = parseExpectationsBytes(bytes);
    if (parsed.errors.length) {
      for (const e of parsed.errors) console.error(`ERRO DE EXPECTATIVAS: ${e}`);
      const failManifest = {
        approved: false,
        profile,
        failures: parsed.errors.map((m) => ({ code: "INVALID_EXPECTATIONS", message: m })),
        warnings: [],
      };
      if (opts.output) {
        fs.mkdirSync(path.dirname(opts.output), { recursive: true });
        fs.writeFileSync(opts.output, JSON.stringify(failManifest, null, 2) + "\n", "utf8");
      }
      console.log(JSON.stringify(failManifest, null, 2));
      return 6;
    }
    expectRaw = { profile: parsed.profile, expect: parsed.expect };
  }

  const buffer = fs.readFileSync(opts.docx);
  const before = fs.statSync(opts.docx).mtimeMs;

  return auditDocx(buffer, {
    sourcePath: opts.docx,
    marker: opts.marker,
    minImageBytes: opts.minImageBytes ?? expectRaw.expect?.minImageBytes ?? 0,
    termOccurrences: Array.from(
      new Set([
        ...(expectRaw.expect?.requiredText || []),
        ...(expectRaw.expect?.forbiddenText || []),
      ])
    ),
    captureParagraphText: opts.captureParagraphText !== false,
    captureSequence: opts.captureSequence !== false,
  })
    .then((manifest) => {
      const evaluation = evaluateManifest(manifest, profile, expectRaw);
      const result = {
        approved: evaluation.approved,
        structuralApproved: evaluation.approved,
        wordApproved: null,
        pdfExported: null,
        profile,
        failures: evaluation.failures,
        warnings: evaluation.warnings,
        metrics: {
          paragraphs: manifest.paragraphs,
          drawing: manifest.drawing,
          wpInline: manifest.wpInline,
          wpAnchor: manifest.wpAnchor,
          blip: manifest.blip,
          mediaCount: manifest.mediaCount,
          tablet: manifest.tables,
          bookmarkStart: manifest.bookmarkStart,
          bookmarkEnd: manifest.bookmarkEnd,
          tocFields: manifest.tocFields,
          pagerefFields: manifest.pagerefFields,
          hyperlinkFields: manifest.hyperlinkFields,
          otherFields: manifest.otherFields,
          markerCount: manifest.markerCount,
          pagesSections: manifest.sections,
          externalImageRelationships: manifest.externalImageRelationships,
          brokenRelationships: manifest.brokenEmbeddedRelationships,
          orphanMediaCount: manifest.orphanMediaCount,
          duplicateMediaCount: manifest.duplicateMediaCount,
        },
        manifest,
      };

      const out = JSON.stringify(result, null, 2);
      if (opts.output) {
        fs.mkdirSync(path.dirname(opts.output), { recursive: true });
        fs.writeFileSync(opts.output, out + "\n", "utf8");
      }
      console.log(out);

      const after = fs.statSync(opts.docx).mtimeMs;
      if (before !== after) {
        console.error("AVISO INTERNO: o DOCX original foi modificado.");
      }

      const status = evaluation.approved ? "APROVADO" : "REPROVADO";
      console.error(`\n=== AUDITORIA ESTRUTURAL: ${status} ===`);
      console.error(`Perfil: ${profile}`);
      console.error(`Paragrafos: ${manifest.paragraphs} | Desenhos: ${manifest.drawing} | Imagens: ${manifest.mediaCount}`);
      console.error(`Tabelas: ${manifest.tables} | Bookmarks: ${manifest.bookmarkStart}/${manifest.bookmarkEnd} | PAGEREF: ${manifest.pagerefFields} | TOC: ${manifest.tocFields}`);
      console.error(`Marcadores: ${manifest.markerCount} | Secoes: ${manifest.sections} | Externas: ${manifest.externalImageRelationships} | Quebradas: ${manifest.brokenEmbeddedRelationships} | Orfas: ${manifest.orphanMediaCount}`);
      if (evaluation.failures.length) {
        console.error(`Falhas (${evaluation.failures.length}):`);
        for (const f of evaluation.failures) console.error(`  - [${f.code}] ${f.message}`);
      }
      if (evaluation.warnings.length) {
        console.error(`Avisos (${evaluation.warnings.length}):`);
        for (const w of evaluation.warnings) console.error(`  - ${w.message}`);
      }
      return evaluation.approved ? 0 : 1;
    })
    .catch((err) => {
      console.error(`ERRO DE AUDITORIA: ${err.message}`);
      return 4;
    });
}

process.exit(await main());
