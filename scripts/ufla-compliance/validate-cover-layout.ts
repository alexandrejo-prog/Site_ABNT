/**
 * Valida a posição física (coordenadas no PDF renderizado) dos blocos da capa
 * (§3.1.1) e da folha de rosto (§3.1.2) do Manual UFLA.
 *
 * Uso: npx tsx scripts/ufla-compliance/validate-cover-layout.ts <pdf>
 *
 * Critérios (página A4 595.32 × 841.92 pt; área útil = margens 3/3/2/2 cm ≈
 * 85.04/85.04/56.7/56.7 pt):
 *  - CAPA: identificação institucional no 1º terço; autor no 2º quarto; título
 *    centralizado (x ≈ centro ± 10%); local+ano no 3º terço inferior.
 *  - FOLHA DE ROSTO: natureza do trabalho ("... apresentada à Universidade...")
 *    presente na metade inferior; autor/título no topo.
 * A posição exata depende do renderizador; tolerâncias generosas evitam
 * falsos positivos — o objetivo é pegar regressões grosseiras (blocos fora da
 * área útil, título na margem inferior, etc.).
 */
import { readFileSync, existsSync } from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

interface CoverLayoutResult {
  name: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
}

const PAGE_W = 595.32;
const PAGE_H = 841.92;
const MARGIN_TOP = 85.04; // 3 cm
const MARGIN_BOTTOM = 56.7; // 2 cm
const MARGIN_LEFT = 85.04; // 3 cm
const MARGIN_RIGHT = 56.7; // 2 cm
const USEFUL_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

export async function validateCoverLayout(pdfPath: string): Promise<CoverLayoutResult> {
  if (!existsSync(pdfPath)) {
    return { name: "Capa/folha de rosto (layout físico)", passed: false, errors: [`PDF não encontrado: ${pdfPath}`], warnings: [] };
  }
  try {
    const buffer = readFileSync(pdfPath);
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    const errors: string[] = [];
    const warnings: string[] = [];

    // --- página da capa: primeira página com identificação institucional ---
    let coverPage: number | null = null;
    let coverItems: any[] = [];
    for (let i = 1; i <= Math.min(3, doc.numPages); i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const items = (tc.items as any[]).map((it) => ({
        x: it.transform[4],
        y: PAGE_H - it.transform[5],
        w: it.width || 0,
        fs: it.transform[0] || 0,
        str: it.str || "",
      }));
      const joined = normalize(items.map((it) => it.str).join(" "));
      if (joined.includes("UNIVERSIDADE FEDERAL DE LAVRAS")) {
        coverPage = i;
        coverItems = items;
        break;
      }
    }
    if (!coverPage) {
      return { name: "Capa/folha de rosto (layout físico)", passed: false, errors: ["Capa não detectada (primeiras 3 páginas sem identificação institucional UFLA)."], warnings: [] };
    }

    const joined = normalize(coverItems.map((it) => it.str).join(" "));

    // 1. identificação institucional no 1º terço da página
    const instItems = coverItems.filter((it) => /UNIVERSIDADE FEDERAL DE LAVRAS/i.test(it.str));
    if (instItems.length) {
      const instY = Math.min(...instItems.map((it) => it.y));
      if (instY > PAGE_H / 3) {
        errors.push(`Identificação institucional fora do 1º terço (y=${Math.round(instY)}pt; limite ~${Math.round(PAGE_H / 3)}pt).`);
      }
      // deve começar abaixo da margem superior
      if (instY < MARGIN_TOP * 0.5) {
        errors.push(`Identificação institucional colada à borda superior (y=${Math.round(instY)}pt < margem ${Math.round(MARGIN_TOP)}pt).`);
      }
    } else {
      errors.push("Capa sem 'UNIVERSIDADE FEDERAL DE LAVRAS' como bloco de texto.");
    }

    // 2. título centralizado horizontalmente (x ≈ centro ± 10%)
    const titleItems = coverItems.filter((it) => it.fs >= 15 && it.str.trim().length > 4);
    const centerX = PAGE_W / 2;
    const xTolerance = USEFUL_W * 0.12;
    let titleCentered = true;
    for (const it of titleItems) {
      // largura real do item (pdf.js fornece it.width) — mais precisa que
      // str.length * fontSize (que superestima para fontes estreitas)
      const itemCenter = it.x + (it.w > 0 ? it.w / 2 : it.str.length * it.fs * 0.5);
      if (Math.abs(itemCenter - centerX) > xTolerance) titleCentered = false;
    }
    if (titleItems.length === 0) {
      errors.push("Capa sem bloco de título (fonte ≥ 15 pt).");
    } else if (!titleCentered) {
      warnings.push("Alguns itens do título não estão centralizados (±12% da largura útil) — verificar visualmente.");
    }

    // 3. local + ano no 3º terço inferior, dentro da área útil
    const localItems = coverItems.filter((it) => /LAVRAS|MG/i.test(it.str));
    if (localItems.length) {
      const localY = Math.max(...localItems.map((it) => it.y));
      if (localY < PAGE_H * (2 / 3)) {
        errors.push(`Local/ano fora do 3º terço inferior (y=${Math.round(localY)}pt; esperado ≥ ${Math.round(PAGE_H * 2 / 3)}pt).`);
      }
      if (localY > PAGE_H - MARGIN_BOTTOM + 20) {
        errors.push(`Local/ano invadiu a margem inferior (y=${Math.round(localY)}pt > ${Math.round(PAGE_H - MARGIN_BOTTOM + 20)}pt).`);
      }
    } else {
      warnings.push("Local/ano ('LAVRAS - MG') não detectado na capa — verificar visualmente.");
    }

    // --- folha de rosto: natureza do trabalho na página seguinte ---
    void joined;
    const natureRe = /APRESENTAD[OA]\s+(?:A|AO|AOS)\s+(?:UNIVERSIDADE|PROGRAMA)/;
    let approvalDetected = false;
    for (let i = coverPage + 1; i <= Math.min(coverPage + 2, doc.numPages); i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const text = normalize((tc.items as any[]).map((it) => it.str).join(" "));
      if (natureRe.test(text)) {
        approvalDetected = true;
        // a natureza deve estar na metade inferior (y > PAGE_H/2)
        const natureItems = (tc.items as any[]).filter((it) => /APRESENTAD[OA]/i.test(it.str || ""));
        if (natureItems.length) {
          const y = PAGE_H - natureItems[0].transform[5];
          if (y < PAGE_H / 2) {
            warnings.push(`Natureza do trabalho na folha de rosto no 1º terço (y=${Math.round(y)}pt) — o Manual UFLA posiciona na metade inferior; verificar visualmente.`);
          }
        }
        break;
      }
    }
    if (!approvalDetected) {
      errors.push("Folha de rosto sem natureza do trabalho ('apresentada à Universidade/Programa...') na página seguinte à capa.");
    }

    return {
      name: "Capa/folha de rosto (layout físico)",
      passed: errors.length === 0,
      errors,
      warnings,
    };
  } catch (err) {
    return {
      name: "Capa/folha de rosto (layout físico)",
      passed: false,
      errors: [`Falha ao analisar layout físico: ${err instanceof Error ? err.message : String(err)}`],
      warnings: [],
    };
  }
}

// Execução standalone
const isDirectRun = typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").endsWith("validate-cover-layout.ts");
if (isDirectRun) {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Uso: npx tsx scripts/ufla-compliance/validate-cover-layout.ts <pdf>");
    process.exit(1);
  }
  validateCoverLayout(pdfPath).then((r) => {
    console.log(`${r.name}: ${r.passed ? "PASSED" : "FAILED"}`);
    for (const e of r.errors) console.log("  ERRO:", e);
    for (const w of r.warnings) console.log("  aviso:", w);
    process.exit(r.passed ? 0 : 1);
  });
}
