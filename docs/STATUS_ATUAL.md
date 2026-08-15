# STATUS ATUAL — Site ABNT / UFLA

> Único documento de status. Resultados históricos: `checkpoint/workslop-assessment.md`.
> Conformidade completa: `artifacts/ufla-compliance/report.md` (canônico).

## Última Atualização
- Data: 2026-08-15
- Hora: 17:35 (CONFORMIDADE UFLA APROVADA — análise física real de imagens/tabelas no PDF + gates computados com evidência atual)
- Branch: `feat/ufla-render-validation`
- Evidência: `npm run verify` 100% verde; tsc limpo; lint 0 erros/0 warnings

## Suíte de Testes
- Passed: 1539
- Failed: 0
- Skipped: 10
- Arquivos: 195
- Build: OK (tsc + vite)
- tsc --noEmit: 0 erros (inclui scripts/ufla-compliance via alias @scripts)
- lint: 0 erros, 0 warnings

## Gates (scripts/ufla-compliance)
- GATE DE CÓDIGO: PASSED (npm test + lint + build)
- runExpandedComplianceGate: PASSED no DOCX real — 10/10 categorias (pré-textuais, textuais, pós-textuais, referências, citações, figuras, seções, tabelas, equações, paginação)
- FULL_COMPLIANCE_GATE: **APROVADO** (gates.json overall=passed; report.md declara CONFORMIDADE UFLA APROVADA)

## Pendências Resolvidas (2026-08-15)
1. [x] **Equações avançadas (OMML cru re-injetado)** — o `<m:oMathPara>` original da origem é capturado na extração, viaja no rascunho como token invisível `\uF001OMML:<base64>\uF001`, e é re-injetado no XML final pelo patch pós-Packer (frações/raízes preservadas — teste `ufla-equations` round-trip m:f)
2. [x] **Ficha catalográfica §6.1 completa** — campo de texto novo (`fichaCatalografica`) + upload de imagem da ficha oficial na UI (seção pré-textuais); exportação prioriza imagem e cai para texto; estilo `ufla_ficha_catalografica` (espaço simples)
3. [x] **Cabeçalho repetido de tabelas (w:tblHeader)** — patch pós-Packer corrigido (estava morto e com posição inválida em tblPr); agora marca a primeira linha de cada tabela em trPr (Manual §23.3)
4. [x] **Validação de notas de rodapé no checker** — itens 24.1–24.3 (notas reais em footnotes.xml, fonte menor com espaço simples, Times New Roman; Manual §21)
5. [x] **Tipos de referência do §25.14** — normalizador ampliado (patente, jornal, periódico, audiovisual, sonoro, partitura, iconográfico, cartográfico, tridimensional, dados de pesquisa, correspondência); 50 testes

## Pendências Declaradas (não bloqueiam conformidade do DOCX)
1. [x] **Lombada (§3.1)** — fechada: o Manual consolidado determina "Não gerar no MVP; manter como pendência futura para versão impressa". Elemento físico de impressão, fora do escopo do DOCX digital.
2. [x] **Ilustração multipágina (§23.3)** — item 25.9 no checker: detecta imagem maior que a área útil e orienta as marcas (continua / continuação / conclusão); sem imagem excedente, item fica "não verificado".
3. [x] **Criação de notas de rodapé na UI** — botão na faixa do editor insere `[^N]` no cursor e a definição `[^N]: ` ao fim, com numeração sequencial automática.
4. [x] **Análise física do PDF (images/tables not-detected)** — detecção real implementada: 6 imagens via opList/CTM (6/6 do DOCX) e 37 regiões de tabela por grade de colunas alinhadas (35 tabelas no OOXML). Cobertura completa: nenhum item crítico not-detected/failed → renderedLayoutGate PASSED.
5. [x] **Gates computados com evidência real** — `regenerate-official-artifacts.ts` agora executa o gate expandido (`runFullComplianceGate`) e computa renderedLayoutGate/fullComplianceGate a partir do coverage físico real, em vez de hardcodar status.
6. [ ] **Preservação de alvos de referência cruzada** (bookmarks/PAGEREF no round-trip) — extração completa; religação dos alvos é melhoria futura.
7. [ ] **Fidelidade do preview** (header simulado, page-break de ABSTRACT condicional, CSS data-font-size, auditoria axe) — não afeta o DOCX gerado.

## Resolução UFLA-AMBIGUOUS-1
- **Decisão:** paginação contínua a partir da Introdução
- **Base:** Manual UFLA §3.2.7 p.73
- **Status:** DECISION_003 documentada; checker `pagination-start` implementado; gate expandido PASSED com esta decisão

## Próximas Fatias
1. FATIA 2: Equações OMML (UFLA-023) — CONCLUÍDA (OMML cru re-injetado)
2. FATIA 3: Rodapés + paginação (FINDING-FOOTER-001..008; UFLA-AMBIGUOUS-1) — CONCLUÍDA
3. FATIA 6: Regenerar artefatos oficiais e declarar conformidade — **CONCLUÍDA** (FULL COMPLIANCE GATE APROVADO, report.md declara CONFORMIDADE UFLA APROVADA)

## Evidências (2026-08-15 17:35)
- DOCX: `artifacts/ufla-compliance/normalized-dissertacao.docx`
- PDF: `artifacts/ufla-compliance/rendered/normalized-dissertacao.pdf` (236 p.)
- OOXML: 35 tabelas (w:tblHeader semântico nas declaráveis), 39 bookmarks/31 PAGEREF, 0 alvos ausentes, 0 mojibake
- Física PDF: 0 overlaps/cutoffs/blank; **6 imagens (opList/CTM) e 37 regiões de tabela (grade de colunas) detectadas**
- Report: `artifacts/ufla-compliance/report.md` (canônico, mesma rodada; declara CONFORMIDADE UFLA APROVADA)
- Gates: `artifacts/ufla-audit/gates.json` (overall=passed; meta `generatedAt` 2026-08-15T17:35Z)
- Resumo status: 48 itens (33 covered, 8 partial, 7 not-covered)

## Regras para IAs
1. Nunca editar números de evidência à mão: rodar `scripts/ufla-compliance/regenerate-official-artifacts.ts` (computa tudo da mesma rodada).
2. Antes de mudar tabelas, ler `docs/decisions/001` e `002` (heurística de cabeçalho causou regressão).
3. Registrar toda decisão em `docs/decisions/NNN-*.md` e atualizar ESTE arquivo.
4. Suíte verde antes de regenerar evidências; os gates são computados pela regeneração (nunca hardcodar status — a regeneração executa o gate expandido real).
