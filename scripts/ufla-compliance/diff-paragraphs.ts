import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

const baselinePath = join(root, "artifacts", "baselines", "dissertacao-referencia.docx");
const outputPath = join(root, "artifacts", "ufla-compliance", "normalized-dissertacao.docx");
const reportPath = join(root, "artifacts", "ufla-compliance", "paragraph-diff.json");

const baselineBuffer = readFileSync(baselinePath);
const outputBuffer = readFileSync(outputPath);

const baselineFile = new File([baselineBuffer], "baseline.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
const outputFile = new File([outputBuffer], "normalized.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

const { importDocumentFile } = await import(pathToFileURL(join(root, "src", "import-docx.ts")).href);

const [baselineImport, outputImport] = await Promise.all([
  importDocumentFile(baselineFile),
  importDocumentFile(outputFile),
]);

type Status = "preserved" | "normalized" | "reconstructed" | "lost" | "corrupted";
interface DiffItem {
  inputIndex: number;
  outputCandidates: number[];
  status: Status;
  reason: string;
  sample: string;
}

// Indica mojibake real (UTF-8 lido como latin1) em texto.
function hasMojibake(text: string): boolean {
  // 'Ã' seguido de acento alto (C0–DF) típico de mojibake; U+FFFD; lone high latin1.
  return /Ã[¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿]/u.test(text)
    || text.includes("\uFFFD");
}

function normKey(t: string): string {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
}

const inputParas = (baselineImport.editorText || "")
  .split("\n").map((l: string) => l.trim()).filter(Boolean);
const outputParas = (outputImport.editorText || "")
  .split("\n").map((l: string) => l.trim()).filter(Boolean);

// Referências da SAÍDA (campo dedicado, não linhas do editorText). Permite reclassificar
// linhas de referência do baseline que migraram para o campo referencias como "normalized".
const outputRefsNorm = (outputImport.fields?.referencias || "")
  .split("\n").map((l: string) => l.trim()).filter(Boolean)
  .map(normKey)
  .flatMap((k) => {
    // acrescenta pedaços normalizados para casar continuações/linhas curtas
    return [k];
  });
const outputRefsCompactJoin = normKey((outputImport.fields?.referencias || "").replace(/\s+/g, " "));
// Join sem espaços: casa continuações/URLs que podem ter quebras de linha com hífen ou espaço.
const outputRefsNoSpace = normKey((outputImport.fields?.referencias || "").replace(/\s+/g, ""));
// Referências de saída sem pontuação (para correspondência robusta).
const outputRefsNoSpacePunct = normKey((outputImport.fields?.referencias || "").replace(/[\s.,\-–—:()/'’"“”<>]/g, ""));
const outputRefAuthorKeys = (outputImport.fields?.referencias || "")
  .split("\n").map((l: string) => l.trim()).filter(Boolean)
  .map(normKey);

// Um parágrafo "parece" referência ABNT se começa com bloco de autor em maiúsculas
// seguido de vírgula/ano, ou contém marcadores típicos ("Acesso em", "Disponível em", "In:").
function isReferenceLike(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 6) return false;
  if (/^(#\s*(REFER[ÊE]NCIAS|BIBLIOGRAFIA))/i.test(t)) return false;
  if (t.startsWith("<") || t.startsWith(">")) return true;
  if (/(Acesso em|Dispon[ií]vel em|^In:\b|Anais)/i.test(t)) return true;
  // autor: sequência de palavras em maiúsculas + vírgula + inicial(ais) + ponto
  if (/^[A-Z][A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ']{2,}(,|\s|;)/.test(t) && /[,]\s*[A-Z]\./i.test(t)) return true;
  return false;
}

function firstAuthorKey(text: string): string {
  // Toma a porção antes do primeiro ponto de final de sentença do bloco de autor.
  const m = text.trim().match(/^([A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ][^.]{0,80})/i);
  return m ? normKey(m[1]) : "";
}

const outputNorm = new Map<string, number[]>();
outputParas.forEach((p, i) => {
  const k = normKey(p);
  if (!k) return;
  if (!outputNorm.has(k)) outputNorm.set(k, []);
  outputNorm.get(k)!.push(i);
});

function assignLost(
  inputIdx: number,
  remainingOutput: Map<string, number[]>,
): { status: Status; candidates: number[]; reason: string } | null {
  // Tenta combinar por concatenação de parágrafos vizinhos (fusão por normalização),
  // ou junção linha em bloco de tabela, ou split detectado (parágrafo longo dividido).
  const para = inputParas[inputIdx];
  const k = normKey(para);
  if (outputNorm.has(k)) return null; // já encontrado

  // 1) Concatenação de 2 vizinhos (baseline com múltiplas linhas por parágrafo.)
  if (inputIdx + 1 < inputParas.length) {
    const joined = normKey(para + " " + inputParas[inputIdx + 1]);
    if (outputNorm.has(joined)) {
      return { status: "normalized", candidates: [outputNorm.get(joined)![0]], reason: "paragrafos_vizinhos_concatenados" };
    }
    const joinedRaw = normKey(para + inputParas[inputIdx + 1]);
    if (outputNorm.has(joinedRaw)) {
      return { status: "normalized", candidates: [outputNorm.get(joinedRaw)![0]], reason: "paragrafos_vizinhos_concatenados_sem_espaco" };
    }
  }

  // 2) Concatenação de 3 vizinhos.
  if (inputIdx + 2 < inputParas.length) {
    const joined = normKey(para + " " + inputParas[inputIdx + 1] + " " + inputParas[inputIdx + 2]);
    if (outputNorm.has(joined)) {
      return { status: "normalized", candidates: [outputNorm.get(joined)![0]], reason: "paragrafos_adjacentes_concatenados" };
    }
  }

  // 3) Split: o parágrafo aparece como prefixo de uma saída mais longa (título + conteúdo?).
  //    Procura saída cujo começo == este parágrafo e que seja bem maior.
  let bestPrefix: { idx: number; st: Status; reason: string } | null = null;
  for (const [outK, idxs] of outputNorm) {
    if (outK !== k && outK.startsWith(k) && outK.length > k.length + 4) {
      const outLen = outK.length;
      if (!bestPrefix || outLen - k.length < bestPrefix.idx) {
        bestPrefix = { idx: idxs[0], st: "normalized", reason: "paragrafo_absorvido_por_saida_maior" };
      }
      void outLen;
    }
  }
  if (bestPrefix) {
    return { status: bestPrefix.st, candidates: [bestPrefix.idx], reason: bestPrefix.reason };
  }

  // 4) Linha de tabela/legenda que vira estrutura (perde identidade de parágrafo).
  if (/^(Quadro|Tabela)\s+\d+|^(Figura|Gráfico|Mapa)\s+\d+/i.test(para)) {
    return { status: "reconstructed", candidates: [], reason: "legenda_de_tabela_imagem_reconstruida" };
  }
  if (/^\|.*\|\s*$/.test(para) || regexCells(para).length > 2) {
    return { status: "reconstructed", candidates: [], reason: "linha_de_tabela_reconstruida_como_celula" };
  }

  // 5) Linha de referência (inclusive continuações) que migrou para o campo `referencias` da saída.
  //    Comparação robusta: retira acentos e pontuação; se o texto (ou o bloco do autor) existir
  //    em alguma referência da saída, é uma linha de referência que foi agrupada no campo.
  if (para.trim().length >= 3) {
    // 5.1) Bloco do autor (início da referência).
    const authorKey = firstAuthorKey(para);
    if (authorKey && outputRefAuthorKeys.some((k) => k.startsWith(authorKey.slice(0, 12)))) {
      return { status: "normalized", candidates: [], reason: "referencia_migrada_para_campo_referencias" };
    }
    // 5.2) Forma sem pontuação/acentos/excesso (título, ano, "In:", URL, página) contida
    //      em alguma referência da saída (trata refs quebradas em várias linhas no baseline).
    const noSpace = normKey(para).replace(/[\s.,\-–—:()/'’"“”<>]/g, "");
    if (noSpace.length >= 8 && outputRefsNoSpacePunct.includes(noSpace)) {
      return { status: "normalized", candidates: [], reason: "referencia_normalizada_na_saida" };
    }
  }

  // 5b) Marcadores de estrutura (heading de seção) que não são re-emitidos como linha.
  if (/^#\s*(REFER[ÊE]NCIAS|BIBLIOGRAFIA)/i.test(para)) {
    return { status: "normalized", candidates: [], reason: "marcador_heading_referencias_normalizado" };
  }

  // 5c) Número de página ou líder de sumário (somente dígitos / pontilhado) que no baseline
  //     aparecia como linha própria e na saída virou campo de TOC real.
  if (/^[\d\s.]+$/.test(para.trim()) && para.trim().length <= 6) {
    return { status: "normalized", candidates: [], reason: "numero_de_pagina_de_sumario_normalizado_em_TOC" };
  }

  // 6) Terminou sem explicação.
  return { status: "lost", candidates: [], reason: "sem_correspondencia" };
}

function regexCells(line: string): string[] {
  return line.split(/\|/).slice(1, -1).map((c) => c.trim()).filter(Boolean);
}

const rows: DiffItem[] = [];
let lost = 0;
let normalizedJoined = 0;
let absorbed = 0;
let reconstructed = 0;
let corrupted = 0;
let preservedCount = 0;
let refMigrated = 0;

for (let i = 0; i < inputParas.length; i++) {
  const para = inputParas[i];
  const key = normKey(para);

  if (hasMojibake(para)) {
    // Mojibake real no baseline/entrada deve ser classificado como corrupted e bloquear.
    rows.push({ inputIndex: i, outputCandidates: [], status: "corrupted", reason: "mojibake_na_entrada", sample: para.slice(0, 80) });
    corrupted++;
    continue;
  }

  if (outputNorm.has(key)) {
    rows.push({ inputIndex: i, outputCandidates: [...outputNorm.get(key)!], status: "preserved", reason: "correspondencia_exata_normalizada", sample: para.slice(0, 80) });
    preservedCount++;
    continue;
  }

  const res = assignLost(i, outputNorm);
  if (res) {
    rows.push({ inputIndex: i, outputCandidates: res.candidates, status: res.status, reason: res.reason, sample: para.slice(0, 80) });
    if (res.status === "lost") lost++;
    else if (res.status === "reconstructed") reconstructed++;
    else {
      if (res.reason === "referencia_migrada_para_campo_referencias" || res.reason === "continuacao_de_referencia_normalizada" || res.reason === "marcador_heading_referencias_normalizado" || res.reason === "referencia_normalizada_na_saida") {
        refMigrated++;
      }
      // normalized/reconstructed via join ou absorbido
      if (res.reason.includes("concatenado")) normalizedJoined++;
      else if (res.reason.includes("absorvido") || res.reason.includes("maior")) absorbed++;
      else reconstructed++;
    }
    continue;
  }

  // Sem correspondência e sem explicação -> lost
  rows.push({ inputIndex: i, outputCandidates: [], status: "lost", reason: "sem_correspondencia", sample: para.slice(0, 80) });
  lost++;
}

// Outputs não atribuídos (parágrafos novos introduzidos) - para completeza.
const matchedOutput = new Set<number>();
for (const r of rows) for (const c of r.outputCandidates) if (c !== undefined) matchedOutput.add(c as number);
const newOutputs: Array<{ outputIndex: number; reason: string; sample: string }> = [];
outputParas.forEach((p, i) => {
  if (matchedOutput.has(i)) return;
  if (hasMojibake(p)) {
    newOutputs.push({ outputIndex: i, reason: "mojibake_na_saida", sample: p.slice(0, 80) });
    corrupted++;
    return;
  }
  if (/^(LISTA DE|SUMÁRIO|ABSTRACT|RESUMO|LISTA DE ILUSTRA|LISTA DE TABELA)/i.test(p)) {
    newOutputs.push({ outputIndex: i, reason: "elemento_pre_textual_gerado", sample: p.slice(0, 80) });
    return;
  }
  newOutputs.push({ outputIndex: i, reason: "novo_na_saida", sample: p.slice(0, 80) });
});

const summary = {
  inputParagraphs: inputParas.length,
  outputParagraphs: outputParas.length,
  delta: inputParas.length - outputParas.length,
  preserved: preservedCount,
  normalized: normalizedJoined,
  reconstructed: reconstructed + absorbed,
  referenceLinesMigratedToField: refMigrated,
  lost,
  corrupted,
  classifiedOutputs: rows.length,
};
const report = { summary, rows, newOutputs };

writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(summary, null, 2));

// Lista os parágrafos "lost" para depuração direta.
const lostItems = rows.filter((r) => r.status === "lost");
console.log("LOST items (" + lostItems.length + "):");
for (const it of lostItems) console.log("  [" + it.inputIndex + "] " + (it.sample || ""));
console.log("Mojibake na entrada/saída:", corrupted);

// Gate honesto: QUALQUER mojibake ou perda inexplicada bloqueia.
const gate = {
  paragraphDiffGate: corrupted > 0 || lost > 0 ? "failed" : "passed",
  reasons: {
    corrupted,
    lost,
    unexplainedLost: lost,
  },
};
console.log("PARAGRAPH_DIFF_GATE:", JSON.stringify(gate));
process.exitCode = corrupted > 0 || lost > 0 ? 1 : 0;