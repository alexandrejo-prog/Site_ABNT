# Checklist de pendências e melhorias normativas (Tese/Dissertação)

Rodada foco: geração de **TESE** e **DISSERTAÇÃO** mais próxima do Manual de Normalização da UFLA,
sem quebrar artigo simples, monografia, projeto de pesquisa e CPG.

## Corrigido nesta rodada

- [x] **Placeholders no DOCX bloqueados/omitidos.** `src/export-docx.ts` (`preTextualChildren`)
      não emite mais `[PREENCHER: indicadores de impacto]` nem `[PREENCHER: impact indicators]`.
      Quando vazio, o bloco é omitido por completo. Validadores (`validators.ts`) tratam
      `[PREENCHER:` como erro absoluto de bloqueio (`draft-placeholder-detected`,
      `placeholder-detected`).
- [x] **Indicadores de impacto em parágrafo único.** `consolidateImpactIndicators`
      (`src/impact-indicators.ts`) consolida os campos separados em texto corrido
      (terceira pessoa) unido por `; `, não em linhas `Impacto social: ...`.
- [x] **Página "Impact indicators" só com tradução real.** Gerada apenas se
      `fields.impactIndicators` estiver preenchido; caso contrário é omitida (sem placeholder).
- [x] **Sumário de tese/dissertação.** Usa exclusivamente o campo TOC atualizável do
      Word/LibreOffice (`TableOfContents`); a lista estática sem paginação não é gerada para
      esses tipos. Para demais tipos, mantém lista estática + campo TOC.
- [x] **Folha de rosto de tese/dissertação sem "Curso:".** `buildTitlePageSupplementalLines`
      omite a linha `Curso:` para tese/dissertação (mantém para monografia quando aplicável).
- [x] **Palavras-chave / Keywords com ponto final.** `ensureTrailingPeriod` garante
      `Palavras-chave: ... .` e `Keywords: ... .`, sem duplicar ponto já existente.
- [x] **Cronograma em tabela.** `markdownTableBlock` converte tabelas markdown
      (`Etapa | Mês 1 | Mês 2 | Mês 3`) em `<w:tbl>` (quadro) no DOCX.
- [x] **Referência do Manual UFLA (6. ed., 2025).** Constante `UFLA_MANUAL_REFERENCE` em
      `src/ufla-rules.ts` com a forma canônica; destaque de título mantido pelo normalizador.
- [x] **Aviso de rascunho na UI.** Texto atualizado para:
      "O DOCX é rascunho técnico. Sumário, ficha catalográfica, paginação final e PDF devem
      ser conferidos no Word/LibreOffice." (fora do corpo do DOCX).
- [x] **Limpeza de rascunho legado.** `clearDraft`/`loadDraft` removem `v1`, `v2` e `v3`.
- [x] **Build Vercel.** `import.meta.env` não quebra mais o build (já coberto por
      `vite/client`); `npm run build` e `npm run verify` passam.

## Arquivo "documento_ideal" (externo)

- O arquivo `tese-documento-ideal-teste-tipos-trabalho-ufla-abnt.docx` (e a base
  `documento_ideal_teste_tipos_trabalho_ufla_abnt.docx`) **não está versionado** neste
  repositório. Ele é usado apenas como arquivo importado em testes manuais.
- O nome do DOCX gerado já usa `importedFileName` quando há importação
  (`buildDownloadFileName` em `src/download-filename.ts`), resultando em
  `tese-documento-ideal-teste-tipos-trabalho-ufla-abnt.docx`.

## Pendências que permanecem (conhecidas)

- Paginação real do sumário/numeração de páginas é definitiva apenas após atualizar o
  campo TOC no Word/LibreOffice; o sistema gera o campo atualizável, não a paginação final.
- Ficha catalográfica é provisória (placeholder institucional) e deve ser substituída pela
  Biblioteca Universitária da UFLA.
- PDF final deve ser gerado no Word/LibreOffice (fora do escopo desta rodada).
- Cronograma em formato livre (fora de tabela markdown ou "Quadro N - Cronograma") pode
  sair como parágrafo; recomenda-se usar tabela para melhor aderência.
