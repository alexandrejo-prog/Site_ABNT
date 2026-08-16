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
 *  - FICHA CATALOGRÁFICA: no VERSO da folha de rosto (página imediatamente
 *    seguinte contém "FICHA CATALOGRÁFICA") — Manual UFLA §3.1.3.
 *  - FOLHA DE APROVAÇÃO: grade física da banca — membros em linhas de
 *    assinatura com posições y distintas, na metade inferior — Manual UFLA §3.1.4.
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

    // 3. local + ano no 3º terço inferior, dentro da área útil (restrito à
    // metade inferior — "UNIVERSIDADE FEDERAL DE LAVRAS" do topo não conta)
    const localItems = coverItems.filter((it) => /LAVRAS|MG/i.test(it.str) && it.y >= PAGE_H * 0.5);
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

    // --- PRECISÃO VERTICAL: ordenação e distâncias entre os blocos da capa ---
    // Manual UFLA §3.1.1: identificação institucional → autor → título →
    // local/ano, em ordem vertical estrita, com folga entre blocos e todos
    // dentro da área útil. Pega regressões grosseiras (blocos sobrepostos,
    // fora da área, ordem invertida) sem depender de posições exatas.
    const instY = instItems.length ? Math.min(...instItems.map((it) => it.y)) : null;
    const titleTopY = titleItems.length ? Math.min(...titleItems.map((it) => it.y)) : null;
    const titleBottomY = titleItems.length ? Math.max(...titleItems.map((it) => it.y)) : null;
    const localTopY = localItems.length ? Math.min(...localItems.map((it) => it.y)) : null;
    const instFs = coverItems.find((it) => /UNIVERSIDADE FEDERAL DE LAVRAS/i.test(it.str))?.fs ?? 14;
    const authorItems = coverItems.filter(
      (it) =>
        it.fs === instFs &&
        !/UNIVERSIDADE|LAVRAS|MG/i.test(it.str) &&
        it.str.trim().length > 3 &&
        it.y > (instY ?? 0) &&
        it.y < (titleTopY ?? PAGE_H),
    );
    const authorY = authorItems.length ? Math.min(...authorItems.map((it) => it.y)) : null;
    const coverBlocks: Array<[string, number | null]> = [
      ["identificação institucional", instY],
      ["autor", authorY],
      ["título", titleTopY],
      ["local/ano", localTopY],
    ];
    const present = coverBlocks.filter(([, y]) => y != null) as Array<[string, number]>;
    for (let i = 1; i < present.length; i++) {
      if (present[i][1] <= present[i - 1][1]) {
        errors.push(
          `Blocos da capa fora de ordem vertical: ${present[i - 1][0]} (y=${Math.round(present[i - 1][1])}) deve vir antes de ${present[i][0]} (y=${Math.round(present[i][1])}).`,
        );
      }
      const gap = present[i][1] - present[i - 1][1];
      if (gap < 10) {
        errors.push(
          `Blocos da capa sobrepostos/colados: ${present[i - 1][0]} e ${present[i][0]} com gap de ${Math.round(gap)}pt (< 10pt).`,
        );
      } else if (gap > 350) {
        warnings.push(
          `Gap grande entre ${present[i - 1][0]} e ${present[i][0]} na capa (${Math.round(gap)}pt) — verificar visualmente.`,
        );
      }
    }
    const USEFUL_MIN_Y = MARGIN_TOP - 20;
    const USEFUL_MAX_Y = PAGE_H - MARGIN_BOTTOM + 20;
    for (const [name, y] of present) {
      if (y < USEFUL_MIN_Y || y > USEFUL_MAX_Y) {
        errors.push(
          `${name} da capa fora da área útil (y=${Math.round(y)}pt; área ${Math.round(USEFUL_MIN_Y)}-${Math.round(USEFUL_MAX_Y)}pt).`,
        );
      }
    }
    if (titleBottomY != null && localTopY != null && localTopY < titleBottomY) {
      errors.push("Local/ano da capa acima do fim do título — ordem invertida entre título e local/ano.");
    }

    // --- folha de rosto: natureza do trabalho na página seguinte ---
    void joined;
    const natureRe = /APRESENTAD[OA]\s+(?:A|AO|AOS)\s+(?:UNIVERSIDADE|PROGRAMA)/;
    let titlePage: number | null = null;
    for (let i = coverPage + 1; i <= Math.min(coverPage + 2, doc.numPages); i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const text = normalize((tc.items as any[]).map((it) => it.str).join(" "));
      if (natureRe.test(text)) {
        titlePage = i;
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
    if (!titlePage) {
      errors.push("Folha de rosto sem natureza do trabalho ('apresentada à Universidade/Programa...') na página seguinte à capa.");
    } else if (titlePage + 1 <= doc.numPages) {
      // --- ficha catalográfica no VERSO da folha de rosto (Manual UFLA §3.1.3) ---
      // A ficha ocupa a página imediatamente seguinte à folha de rosto (o verso
      // no fluxo contínuo do documento; a capa não conta). O título do campo
      // "Ficha catalográfica" é sempre texto, mesmo quando a ficha é imagem.
      const next = await doc.getPage(titlePage + 1);
      const tcNext = await next.getTextContent();
      const nextText = normalize((tcNext.items as any[]).map((it) => it.str).join(" "));
      if (!/FICHA CATALOGRAFICA/.test(nextText)) {
        errors.push("Ficha catalográfica fora do verso da folha de rosto: a página imediatamente seguinte à folha de rosto não contém 'FICHA CATALOGRÁFICA'.");
      } else {
        // POSIÇÃO do cartão da ficha (Manual UFLA §3.1.3): com conteúdo REAL
        // (número de Cutter-Sanborn/classificação CDU — ficha oficial colada ou
        // gerada), o cartão ocupa a metade inferior do verso. Placeholder
        // ("detectada no arquivo importado") e ficha por imagem não disparam.
        const nextItems = (tcNext.items as any[])
          .map((it) => ({
            y: PAGE_H - it.transform[5],
            str: it.str || "",
          }))
          .filter((it) => it.str.trim().length > 1);
        const cutterLines = nextItems.filter((it) => /\b[A-Z]\d{1,4}[a-z]?\b/i.test(normalize(it.str)) || /\bCDU\s*\d/i.test(normalize(it.str)));
        if (cutterLines.length > 0) {
          const cardTop = Math.min(...cutterLines.map((it) => it.y));
          if (cardTop < PAGE_H * 0.4) {
            errors.push(
              `Cartão da ficha catalográfica (com Cutter) acima do esperado no verso: y=${Math.round(cardTop)}pt (< 40% da página) — o Manual UFLA §3.1.3 posiciona o cartão na metade inferior.`,
            );
          } else if (cardTop < PAGE_H * 0.5) {
            warnings.push(
              `Cartão da ficha catalográfica levemente acima do centro do verso (y=${Math.round(cardTop)}pt) — verificar visualmente.`,
            );
          }
        }
      }
      // --- folha de aprovação: grade física da banca ---
      // Busca a folha de aprovação nas páginas seguintes e valida que os membros
      // da banca formam uma grade vertical (linhas de assinatura em posições y
      // distintas) na metade inferior da página, como no Manual UFLA §3.1.4.
      let approvalFound = false;
      for (let i = titlePage + 2; i <= Math.min(titlePage + 5, doc.numPages); i++) {
        const page = await doc.getPage(i);
        const tc = await page.getTextContent();
        const text = normalize((tc.items as any[]).map((it) => it.str).join(" "));
        if (!/APROVADO EM/.test(text)) continue;
        approvalFound = true;
        const items = (tc.items as any[]).map((it) => ({
          x: it.transform[4],
          y: PAGE_H - it.transform[5],
          w: it.width || 0,
          fs: it.transform[0] || 0,
          str: it.str || "",
        }));
        const memberItems = items.filter((it) => /^(PROF|DRA|DR)\.?\b/i.test(normalize(it.str)));
        const ys = [...new Set(memberItems.map((it) => Math.round(it.y)))].sort((a, b) => a - b);
        if (ys.length < 3) {
          errors.push(`Folha de aprovação sem grade física da banca: apenas ${ys.length} linha(s) de membro em posições verticais distintas (esperado ≥ 3 linhas de assinatura).`);
        } else {
          const maxMemberY = ys[ys.length - 1];
          const minMemberY = ys[0];
          if (maxMemberY < PAGE_H / 2) {
            errors.push(`Grade da banca concentrada acima da metade da página (última linha y=${Math.round(maxMemberY)}pt; esperado ≥ ${Math.round(PAGE_H / 2)}pt) — o Manual UFLA posiciona a banca na metade inferior.`);
          }
          if (minMemberY < PAGE_H / 3) {
            warnings.push(`Primeira linha da banca acima do 1º terço (y=${Math.round(minMemberY)}pt) — verificar visualmente a posição da grade.`);
          }
          // PRECISÃO da grade: linhas não sobrepostas (gap mínimo), dentro da
          // área útil e coluna de nomes alinhada horizontalmente (grade C×R do
          // Manual UFLA §3.1.4 — os nomes formam uma coluna à esquerda).
          for (let i = 1; i < ys.length; i++) {
            const gap = ys[i] - ys[i - 1];
            if (gap < 8) {
              errors.push(`Linhas da banca sobrepostas na folha de aprovação (gap ${gap}pt entre y=${ys[i - 1]} e y=${ys[i]}) — grade colapsada.`);
            }
          }
          if (maxMemberY > PAGE_H - MARGIN_BOTTOM + 20) {
            errors.push(`Linha final da banca invadiu a margem inferior (y=${Math.round(maxMemberY)}pt > ${Math.round(PAGE_H - MARGIN_BOTTOM + 20)}pt).`);
          }
          const memberXs = memberItems.map((it) => it.x);
          const xSpread = Math.max(...memberXs) - Math.min(...memberXs);
          if (xSpread > 60) {
            warnings.push(`Posições x iniciais dos nomes da banca variam muito (${Math.round(xSpread)}pt) — grade horizontal possivelmente desalinhada.`);
          }
        }
        break;
      }
      if (!approvalFound) {
        // a presença da folha de aprovação já é validada por conteúdo no OOXML;
        // aqui registra aviso físico apenas.
        warnings.push("Folha de aprovação ('APROVADO EM') não detectada nas páginas seguintes à folha de rosto — verificar visualmente.");
      }
    } else {
      warnings.push("Documento termina na folha de rosto — não há página para a ficha catalográfica (verso).");
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
