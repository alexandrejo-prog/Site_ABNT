import type { ImportedPdfDiagnostic } from "./imported-pdf-diagnostic";
import type { ImportedTable, ImportedTableCell } from "./imported-tables";

type TableMerge = { row: number; col: number; type: "vMerge-restart" | "vMerge-continue" | "gridSpan" };

interface CellItem {
  text: string;
  x: number;
  y: number;
  width: number;
}

// Legenda de TABELA/QUADRO → reconstrução tabular.
// Figuras (FIGURA/IMAGEM/ESQUEMA/FLUXOGRAMA/GRÁFICO) NÃO vão para o reconstrutor
// de tabelas (R5.3): são roteadas para extração de imagem.
const CAPTION_RE = /^(TABELA|QUADRO)\b[\s.:]*([0-9IVXLC]+(?:\.[0-9]+)?)/i;
const SOURCE_RE = /^FONTE\s*:/i;

// Legendas de FIGURA/IMAGEM/ESQUEMA/FLUXOGRAMA caracterizam região de imagem, não tabela.
function isCaptionLine(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length > 60) return false; // legendas são curtas
  if (!CAPTION_RE.test(trimmed)) return false;
  const rest = trimmed.replace(CAPTION_RE, "").trim();
  if (!rest) return false;
  if (/^\.?\s*["“'”]\s*(conclus[aã]o|continua[cç][aã]o|continua)\b/i.test(rest)) return false;
  return true;
}

function captionKey(text: string): string {
  const m = text.trim().match(/^(TABELA|QUADRO)\b[\s.:]*([0-9IVXLC]+)/i);
  return m ? `${m[1].toUpperCase()}-${m[2].toUpperCase()}` : text.trim().slice(0, 20).toUpperCase();
}

function clusterColumnXs(xs: number[], pageWidth: number): number[] {
  if (!xs.length) return [];
  const sorted = [...xs].sort((a, b) => a - b);
  const mergeThreshold = Math.max(10, pageWidth * 0.022);
  const clusters: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const last = clusters[clusters.length - 1];
    if (sorted[i] - last <= mergeThreshold) {
      clusters[clusters.length - 1] = (last + sorted[i]) / 2;
    } else {
      clusters.push(sorted[i]);
    }
  }
  return clusters.sort((a, b) => a - b);
}

function rowsFromItems(items: CellItem[], rowTolerance = 4): CellItem[][] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: CellItem[][] = [];
  let current: CellItem[] = [sorted[0]];
  let currentY = sorted[0].y;
  for (let i = 1; i < sorted.length; i += 1) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) <= rowTolerance) {
      current.push(item);
    } else {
      rows.push(current);
      current = [item];
      currentY = item.y;
    }
  }
  rows.push(current);
  return rows.map((row) => row.sort((a, b) => a.x - b.x));
}

interface AssignedCell {
  item: CellItem | null;
}

function assignColumns(row: CellItem[], columnXs: number[], colTolerance: number): AssignedCell[] {
  const used = new Set<number>();
  return columnXs.map((cx) => {
    let best: CellItem | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < row.length; i += 1) {
      if (used.has(i)) continue;
      const d = Math.abs(row[i].x - cx);
      if (d <= colTolerance && d < bestDist) {
        best = row[i];
        bestDist = d;
      }
    }
    if (best) used.add(row.indexOf(best));
    return { item: best };
  });
}

export function extractPdfTables(diagnostic: ImportedPdfDiagnostic): ImportedTable[] {
  const tables: ImportedTable[] = [];
  let counter = 0;

  for (const page of diagnostic.pages) {
    const pageWidth = page.width || 595;
    const items: CellItem[] = page.items
      .map((item) => ({ text: item.text, x: item.x, y: item.y, width: item.width }))
      .filter((item) => item.text.trim().length > 0);
    if (items.length < 4) continue;

    const captionLines = page.lines.filter((line) => isCaptionLine(line.text));
    if (!captionLines.length) continue;

    const byKey = new Map<string, (typeof captionLines)[number]>();
    for (const line of captionLines) {
      const key = captionKey(line.text);
      const existing = byKey.get(key);
      if (!existing || line.text.trim().length > existing.text.trim().length) {
        byKey.set(key, line);
      }
    }

    const caps = [...byKey.values()].sort((a, b) => a.top - b.top);

    for (let c = 0; c < caps.length; c += 1) {
      const caption = caps[c];
      const regionTop = caption.top;
      const nextCap = caps[c + 1];
      let regionBottom = nextCap ? nextCap.top : Infinity;
      for (const line of page.lines) {
        if (SOURCE_RE.test(line.text.trim()) && line.top > regionTop) {
          if (line.top < regionBottom) regionBottom = line.top;
          break;
        }
      }

      const regionItems = items.filter(
        (it) => it.y >= regionTop - 2 && (regionBottom === Infinity || it.y < regionBottom),
      );
      if (regionItems.length < 4) continue;

      const rows = rowsFromItems(regionItems);
      if (rows.length < 2) continue;

      const colXs = clusterColumnXs(rows.flat().map((cell) => cell.x), pageWidth);
      if (colXs.length < 2) continue;

      const colTolerance = Math.max(12, pageWidth * 0.03);
      const matrix = rows.map((row) => assignColumns(row, colXs, colTolerance));

      const cellRows: ImportedTableCell[][] = matrix.map((cols) =>
        cols.map((c) => ({ text: c.item ? c.item.text.trim() : "" })),
      );

      const nonEmptyCols = colXs.filter((_, colIndex) =>
        cellRows.some((row) => (row[colIndex]?.text || "").length >= 1),
      ).length;
      if (nonEmptyCols < 2) continue;

      // Larguras proporcionais à faixa x ocupada por cada coluna (R6.8).
      const colRanges = colXs.map((cx) => {
        let min = Infinity;
        let max = -Infinity;
        for (const row of matrix) {
          for (const cell of row) {
            if (cell.item && Math.abs(cell.item.x - cx) <= colTolerance) {
              min = Math.min(min, cell.item.x);
              max = Math.max(max, cell.item.x + (cell.item.width || 0));
            }
          }
        }
        if (!Number.isFinite(min)) {
          min = cx;
          max = cx + pageWidth / colXs.length;
        }
        return { min, max };
      });
      const rawWidths = colRanges.map((r) => Math.max(1, r.max - r.min));
      const widthTotal = rawWidths.reduce((a, b) => a + b, 0) || 1;
      const estimatedColumnWidths = rawWidths.map((w) => Math.round((w / widthTotal) * 100)) || [];

      // Mesclagem vertical (R6.2): célula vazia sob célula preenchida na mesma coluna
      // indica que o texto da célula superior se estende por várias linhas.
      const finalMerges: TableMerge[] = [];
      for (let col = 0; col < colXs.length; col += 1) {
        let lastFilled = -1;
        for (let row = 0; row < matrix.length; row += 1) {
          const hasText = (cellRows[row][col]?.text || "").length > 0;
          if (hasText) {
            if (lastFilled >= 0 && row - lastFilled > 1) {
              finalMerges.push({ row: lastFilled, col, type: "vMerge-restart" });
              for (let r = lastFilled + 1; r < row; r += 1) {
                finalMerges.push({ row: r, col, type: "vMerge-continue" });
              }
            }
            lastFilled = row;
          }
        }
      }

      let source: string | undefined;
      for (const line of page.lines) {
        if (SOURCE_RE.test(line.text.trim()) && line.top > regionTop && line.top < regionBottom + 40) {
          source = line.text.trim();
          break;
        }
      }

      const overlaps = tables.some(
        (t) => t.position >= page.pageNumber * 1000 && Math.abs((t.position % 1000) - caption.top) < 20,
      );
      if (overlaps) continue;

      counter += 1;
      const id = `pdf-table-${page.pageNumber}-${counter}`;
      tables.push({
        id,
        caption: caption.text.trim(),
        source,
        rowCount: cellRows.length,
        columnCount: colXs.length,
        rows: cellRows,
        estimatedColumnWidths,
        originalGridWidths: estimatedColumnWidths,
        tableWidthTwips: 0,
        hasGridSpan: false,
        hasVerticalMerge: finalMerges.length > 0,
        status: "preserved",
        position: page.pageNumber * 1000 + Math.round(caption.top),
        origin: "pdf-reconstructed",
        cellMerges: finalMerges.length ? finalMerges : undefined,
        logicalColumnCount: colXs.length,
      });
    }
  }

  return tables;
}
