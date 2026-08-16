# DECISION 010 — Paginação: contagem a partir da folha de rosto (complemento da DECISION_003)

**Data:** 2026-08-15
**Status:** Vigente — substitui a interpretação "reinício em 1" do `ooxml-checks → pagination-start`

## Contexto

O Manual de Normalização da UFLA (§ paginação) contém duas afirmações que geraram a ambiguidade `UFLA-AMBIGUOUS-1`:

> "As páginas pré-textuais são contadas a partir da folha de rosto, mas não numeradas."

> "A numeração é colocada a partir da primeira folha da parte textual (Introdução), em algarismos arábicos (1, 2, 3, ...)"

A leitura ingênua "(1, 2, 3, ...)" sugeria que a Introdução deveria exibir o número **1** (reinício). A DECISION_003 deixou os dois caminhos abertos ("número 1 **ou n**, se a contagem prévia for mantida"), o que mantinha a ambiguidade e permitia um checker que exigia `w:pgNumType w:start="1"`.

## Decisão

1. **Contagem**: todas as folhas, a partir da folha de rosto, são **contadas sequencialmente** (folha de rosto = 1). As pré-textuais **não exibem número**.
2. **"(1, 2, 3, ...)"** descreve o **sistema de numeração** (algarismos arábicos, não romanos), **não um reinício**.
3. **Numeração visível**: começa na Introdução (primeira folha textual) **com o valor contado** — número de folhas pré-textuais + 1. **Nunca reinicia em 1** em trabalhos com parte pré-textual (dissertação, tese, monografia).
4. Em trabalhos **sem pré-textuais** (projeto de pesquisa, resumo expandido CPG, artigo científico — conforme a `DOCUMENT_TYPE_MATRIX`), a contagem começa naturalmente em 1 e a numeração visível inicia em 1 na primeira folha textual.

## Evidências

- **Documento real (baseline)**: `normalized-dissertacao.docx` — seção textual com `w:pgNumType w:start="13"`; no PDF renderizado a Introdução (folha física 18) exibe **13**, e a sequência segue 14, 15, ... sem quebra. As 17 folhas pré-textuais não exibem número.
- **ABNT NBR 14724**: "Todas as folhas, a partir da folha de rosto, são contadas sequencialmente, mas não numeradas. A numeração é colocada a partir da primeira folha da parte textual, em algarismos arábicos, no canto superior direito".
- **Teste de aceite**: `tests/acceptance/ufla-pagination-pretextual.test.ts` — "a secao textual inicia a numeracao no valor das paginas pre-textuais contadas + 1 (pgNumType start=9 no OOXML da referencia), **nunca em 1**".

## Alinhamento do checker com o Word

O que o Word renderiza deve ser exatamente o que o checker valida:

1. **OOXML**: a seção textual (única com `w:headerReference` contendo campo `PAGE`) deve definir `w:pgNumType w:start="N"` com **N ≥ 2** (continuação). Pré-textuais sem header/footer de número.
2. **PDF físico (renderizado pelo Word)**: nenhuma pré-textual exibe dígito no canto superior direito; a primeira folha com número é a Introdução e o valor é **N**; a sequência é contínua até o fim (referências, apêndices, anexos).
3. O `ooxml-checks → pagination-start` (que exigia reinício em 1) é substituído por `pagination-restart-at-1` (erro se a seção textual reiniciar em 1) e `pagination-continuation-required` (aviso se a continuação explícita estiver ausente).

## Critério de aceite

- Gate `UFLA-AMBIGUOUS-1 (paginação)` verifica OOXML + PDF físico com a regra acima.
- `UFLA-AMBIGUOUS-1` removido da lista de achados não-estruturais do `regenerate-official-artifacts.ts`.
- Dissertação real continua PASSED; projeto/artigo/CPG (sem pré-textuais) continuam PASSED com início em 1.
