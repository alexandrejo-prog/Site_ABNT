# Importação de PDF (rascunho textual v2.10.0)

Este documento descreve a reconstrução de texto de PDF para o modo de rascunho
experimental (`documentMode: "pdf-text-draft"`). O objetivo é parar de tratar
cada linha visual do PDF como um parágrafo isolado no Word e reconstruir a
estrutura semântica do documento.

## Pipeline

1. **Extração** (`import-pdf.ts`): `pdfjs-dist` extrai itens de texto com
   coordenadas (x, y, largura, altura, fonte).
2. **Linhas** (`import-pdf-text.ts` → `buildPageLines`): itens agrupados em
   linhas visuais com tolerância adaptativa (mediana da altura das letras);
   cada linha é enriquecida com `fontSize`, `fontName`, `isBold` e `bbox`.
3. **Blocos semânticos** (`pdf-text-reconstruction.ts` → `reconstructPdfSemanticBlocks`):
   as linhas viram blocos do tipo `paragraph`, `heading`, `list-item`,
   `caption`, `source`, `visual` ou `review-note`.
4. **DOCX** (`export-docx.ts` → `buildPdfTextDraftDocxBlob`): gerado a partir
   dos blocos semânticos, com formatação ABNT/UFLA (Times 12, justificado,
   recuo de 1,25 cm, entrelinha 1,5, margens 3/3/2/2 cm).

## Regras de reconstrução

- **Parágrafos**: linhas consecutivas são fundidas quando o espaçamento é o
  entrelinha comum (limiar relativo ou absoluto de ~2 linhas) e não há quebra
  de recuo. Hyphenation/continuação são respeitados pela proximidade.
- **Títulos**: seções numeradas (`1 INTRODUÇÃO`, `2.1 Metodologia`) viram
  `heading` (centralizado, maiúsculo, negrito). Nível = número de segmentos.
- **Legendas e fontes**: `Quadro/Tabela/Figura/Gráfico N –` viram `caption`;
  `Fonte:` vira `source` (centralizados).
- **Listas**: marcadores `a)`, `1)`, `-`, `•` iniciam `list-item`; linhas
  penduradas (recuo) são anexadas.
- **Números de página**: linhas com 1–4 dígitos em cabeçalho/rodapé que
  aparecem em 3+ páginas são descartadas.
- **Cabeçalhos/rodapés repetitivos**: textos idênticos em faixas superior/inferior
  de 3+ páginas são descartados.
- **Sumário/índice**: entradas com linha de pontos + número de página são
  ignoradas (não viram título falso).
- **Regiões visuais**: quadros, tabelas, gráficos e figuras detectados
  (`detectPdfVisualRegionCandidates`) tornam-se blocos `visual`; as linhas
  internas (ex.: linhas de tabela) são absorvidas pelo recorte e não viram
  parágrafos soltos. O recorte é inserido como imagem no DOCX quando a opção
  "inserir elementos visuais" está marcada e a região tem confiança ≠ baixa;
  caso contrário, vira nota de revisão (`[IMAGEM DETECTADA]`).
- **Páginas pré-textuais**: por padrão, todo o conteúdo antes do primeiro
  título de seção de nível 1 (ex.: `1 INTRODUÇÃO`) é excluído. A opção
  "incluir páginas pré-textuais" desativa esse filtro.

## Opções na UI (ImportBlock)

- **Inserir figuras, quadros, gráficos e tabelas detectados como imagens no
  DOCX** (padrão ligado).
- **Incluir páginas pré-textuais no rascunho** (padrão desligado).

## Limitações conhecidas

- Não há OCR; texto de imagem escaneada não é extraído.
- Tabelas NÃO são reconstruídas como tabela editável do Word: entram como
  imagem recortada (ou nota). A formatação final exige revisão manual.
- A decisão de modo usa o discriminador explícito (`documentMode`), nunca o
  conteúdo do editor.
