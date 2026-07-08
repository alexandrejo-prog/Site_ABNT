# Checklist de pendências e melhorias normativas (Tese/Dissertação)

Rodada foco: geração de **TESE** e **DISSERTAÇÃO** mais próxima do Manual de Normalização da UFLA,
sem quebrar artigo simples, monografia, projeto de pesquisa e CPG.

## Corrigido nesta rodada

- [x] **Placeholders no DOCX bloqueados/omitidos.** `src/export-docx.ts` (`preTextualChildren`)
      não emite mais `[PREENCHER: indicadores de impacto]` nem `[PREENCHER: impact indicators]`.
      Quando vazio, o bloco é omitido por completo. Validadores (`validators.ts`) tratam
      `[PREENCHER:` como erro absoluto de bloqueio (`draft-placeholder-detected`,
      `placeholder-detected`).
- [x] **Indicadores de impacto em parágrafo único (sem rótulos).** `buildFlowingImpactText`
      e `stripImpactLabels` (`src/impact-indicators.ts`) consolidam os campos separados em
      texto corrido, em terceira pessoa, **sem** os rótulos `Impacto social:`, `Impacto
      científico:` etc. O bloco pré-textual "INDICADORES DE IMPACTO" é um único parágrafo.
      `consolidateImpactIndicators` (usado no preview do rascunho) é mantido intacto.
- [x] **Sem duplicação da seção textual "INDICADORES DE IMPACTO".** Para tese/dissertação, a
      seção homônima importada/escrita no corpo textual é removida (`removeDuplicateIndicatorsSection`
      em `src/export-docx.ts`), pois os indicadores já aparecem no bloco pré-textual.
- [x] **Página "Impact indicators" só com tradução real.** Gerada apenas se
      `fields.impactIndicators` estiver preenchido; caso contrário é omitida (sem placeholder).
      Validador emite aviso (não bloqueia) quando há indicadores em PT mas não em EN.
- [x] **Sumário — Abordagem A (campo TOC atualizável).** Tese/dissertação usam
      exclusivamente o campo `TableOfContents` do Word/LibreOffice; a lista estática sem
      paginação não é gerada para esses tipos (evita página de sumário vazia/enganosa). Para
      demais tipos, mantém lista estática + campo TOC. A UI avisa para "Atualizar campo" no
      Word/LibreOffice. Validação emite aviso `summary-empty-headings` quando não há títulos
      de seção (TOC ficaria vazio até a atualização).
- [x] **Folha de rosto de tese/dissertação sem "Curso:".** `buildTitlePageSupplementalLines`
      omite a linha `Curso:` para tese/dissertação (mantém para monografia quando aplicável).
- [x] **Folha de aprovação com banca editável (rascunho técnico).** `approvalPageChildren`
      inclui aviso "Banca examinadora a ser preenchida na versão final." e linhas editáveis
      `Prof.(a) Dr.(a) ___` / `Instituição: ___`. Não finge aprovação final.
- [x] **Palavras-chave / Keywords com ponto final.** `ensureTrailingPeriod` garante
      `Palavras-chave: ... .` e `Keywords: ... .`, sem duplicar ponto já existente.
- [x] **Cronograma em tabela (markdown + texto livre delimitado).** `markdownTableBlock`
      converte tabelas markdown (`Etapa | Mês 1 | Mês 2 | Mês 3`) em `<w:tbl>`. Novo
      `plainScheduleTable` converte cronogramas em texto livre quando as colunas são
      separadas por tab ou 2+ espaços (cabeçalho "Etapa" + "Mês N") em tabela real (cabeçalho
      em negrito). Quando o texto livre usa espaço simples (colunas não detectáveis), permanece
      como parágrafos separados, **sem colunas coladas** (fallback documentado abaixo).
- [x] **Referência do Manual UFLA (6. ed., 2025).** Constante `UFLA_MANUAL_REFERENCE` em
      `src/ufla-rules.ts` com a forma canônica. `normalizeUflaManualReference`
      (`src/references-normalizer.ts`) reescreve qualquer referência do Manual UFLA vinda com
      ano anterior (ex.: 2024) para a forma canônica 6. ed./2025, preservando o destaque do
      título. Referências comuns que mencionam UFLA/2024 não são alteradas.
- [x] **Sanitizador de caracteres estranhos.** `cleanMojibakeText` (`src/docx-render-core.ts`)
      remove/normaliza U+FFFE, U+FFFF, U+FEFF indevido, U+2060, U+200B e caracteres de
      controle; U+FFFE entre letras vira hífen (`TÉCNICO-ADMINISTRATIVOS`). Aplicado também
      nas referências e nos parágrafos do corpo textual.
- [x] **Aviso de rascunho na UI.** Texto inclui instrução de atualizar o sumário:
      "O DOCX é rascunho técnico. Sumário, ficha catalográfica, paginação final e PDF devem
      ser conferidos no Word/LibreOffice. Após abrir no Word/LibreOffice, clique com o botão
      direito no sumário e selecione 'Atualizar campo'." (fora do corpo do DOCX).
- [x] **Limpeza de rascunho legado.** `clearDraft`/`loadDraft` removem `v1`, `v2` e `v3`.
- [x] **Build Vercel.** `import.meta.env` não quebra mais o build; `npm run build` e
      `npm run verify` passam.

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
- Cronograma em **texto livre com espaço simples** (`Etapa Mês 1 Mês 2 Mês 3` em uma linha
  sem tab/2+ espaços) não tem colunas detectáveis de forma confiável; nesse caso ele permanece
  como parágrafos separados (sem colunas coladas). **Workaround do usuário:** usar tabela
  markdown (`| Etapa | Mês 1 | Mês 2 | Mês 3 |`) ou separar colunas por tab/2+ espaços para
  obter um quadro real no DOCX.
