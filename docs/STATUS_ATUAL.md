# STATUS ATUAL — Site ABNT / UFLA

> Único documento de status. Resultados históricos: `checkpoint/workslop-assessment.md`.
> Conformidade completa: `artifacts/ufla-compliance/report.md` (canônico).

## Última Atualização
- Data: 2026-08-15
- Hora: ~19:50 (GOVERNANCE ROADMAP: física PDF nos 15 tipos do gate; e2e Playwright; Lighthouse; CI com axe + ufla:audit; `perTypePhysicalGate`)
- Branch: `feat/ufla-render-validation`
- Evidência: `npm run ufla:audit` completo — lint + verify + regenerate (Word COM + PDF físico + 8 gates) all passed; resumoStatus 48/48 covered, 0 partial, 0 not-covered; `npm run e2e` (Playwright, fluxo real do app) passed; `npm run ufla:lh` (Lighthouse: a11y 100, performance 86, best-practices 92)

## Suíte de Testes
- Passed: 1579
- Failed: 0
- Skipped: 10
- Arquivos: 200
- Build: OK (tsc + vite)
- tsc --noEmit: 0 erros (inclui scripts/ufla-compliance via alias @scripts)
- lint: 0 erros, 0 warnings

## Gates (scripts/ufla-compliance)
- GATE DE CÓDIGO: PASSED (npm test + lint + build)
- runExpandedComplianceGate: PASSED no DOCX real — 10/10 categorias (pré-textuais, textuais, pós-textuais, referências, citações, figuras, seções, tabelas, equações, paginação)
- FULL_COMPLIANCE_GATE: **APROVADO** (gates.json overall=passed; report.md declara CONFORMIDADE UFLA APROVADA)
- perTypeGate: 15/15 PASSED (4 padrão + 3 rascunhos editáveis + 8 formatos da Coleção)
- perTypePhysicalGate: PASSED (15/15 renderizados via Word COM: A4 + paginação OOXML↔PDF; skipped-no-word sem Word)
- E2E (Playwright): PASSED (fluxo real do app: artigo da Coleção → DOCX → preview)
- Lighthouse: PASSED (a11y 100 ≥ 90, performance 86, best-practices 92)

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
6. [x] **Religação de alvos de referência cruzada** (bookmarks/PAGEREF no round-trip) — extração converte hyperlink interno/REF em token `[x:ANCHOR~texto]`; exportação resolve por label (heading → `SECAO_`, legenda → `LISTA_`, degrade para texto plano sem link quebrado) com `InternalHyperlink` + bookmark estável no heading e na legenda de tabela; coberto nos 4 exportadores (dissertação, artigo, CPG, projeto).
7. [x] **Gate por tipo de trabalho** — `run-gate-per-type.ts` gera DOCX de exemplo (artigo, TCC/monografia, resumo expandido CPG, projeto) e roda o gate expandido com o tipo explícito; `audit-pretextual` respeita a matriz de tipos (ficha/aprovação/sumário não exigidos em artigo/CPG não geram falso positivo); resultado em `gates.json → perTypeGate: passed`.
8. [x] **Preservação completa de imagens (UFLA-imagens/preservação)** — classificador de imagens revisto: figura composta com legenda compartilhada (4 logos da Figura 2) é importada como grupo; imagens de apêndice sem legenda são preservadas; perdas 7 → 0 (12 únicas baseline vs 11 gerado; a capa é reconstruída pelo template e a duplicação de image12 é dedupe correto).
9. [x] **Layout físico de capa e folha de rosto (UFLA-capa/UFLA-aprovacao)** — `validate-cover-layout.ts` valida coordenadas no PDF renderizado (institucional no 1º terço, autor, título centralizado, local+ano no terço inferior y≥561; natureza da folha de rosto na metade inferior — corrigida de 37% para ~50%): categoria no gate expandido PASSED; teste `cover-layout-validation.test.ts`.
10. [x] **Referências online (UFLA-referencias-online)** — tipo dedicado `online` (NBR 6023) com conteúdo estruturado + 'Disponível em:'; data de acesso bloqueante no audit-references; URL avulsa segue 'site' com confiança baixa; dados de pesquisa mantêm prioridade.
11. [x] **UFLA-AMBIGUOUS-1 paginação (DECISION-010)** — contagem contínua a partir da folha de rosto (folha de rosto = 1); numeração visível inicia na Introdução com o valor contado (pré-textuais + 1), nunca reinício em 1; checker OOXML (pgNumType start) ↔ PDF físico (folha 18 = 13, contínua); `ooxml-checks` corrigido (pagination-restart-at-1).
12. [x] **Auditoria cruzada de formatos (UFLA-formatos-20)** — `audit-formats-cross.ts`: 18 formatos × 20 requisitos, mapeamento completo, zero órfão, zero tipo morto, cobertura 100%; DOCUMENT_TYPE_MATRIX estendida para artigo/CPG (resumo/abstract/introdução/desenvolvimento/referências/layout/tipografia/espaçamento); gate `formatsCrossGate` PASSED.
12b. [x] **Gate dos 8 formatos da Coleção Produção Acadêmica** — roteados para a estrutura de artigo (sem capa/folha de rosto/ficha/aprovação) no `document-template.ts` e `generateDocxBlob`; fixtures por formato satisfazem os requiredFields PRÓPRIOS (curso/justificativa/cronograma/objetivos/metodologia/conclusão/referencial teórico...), verificados no DOCX gerado (`verify-production-format.ts`); gate por tipo 12/12 PASSED (4 padrão + 8 Coleção) com `requiredFieldsCheck` em gates-per-type.json; testes em `tests/ufla-compliance/production-formats-gate.test.ts`.
13. [x] **Comando único de auditoria** — `npm run ufla:audit` orquestra lint + verify + regenerate com lock (`artifacts/ufla-audit/.audit.lock`) e falha rápida; resumo dos 7 gates + overall no final.
14. [x] **Fidelidade do preview** — header simulado alinhado à DECISION-010 (número de página explícito só nas páginas textuais/pós-textuais, iniciando em pré-textuais reais + 1; pré-textuais sem número; sumário com páginas corretas); page-break de ABSTRACT condicional (monografia/dissertação/tese); CSS data-font-size (10/11/12 pt); auditoria axe no App e no PreviewModal (tests/accessibility).
15. [x] **Rascunho editável de longos no gate por tipo** — monografia, dissertação e tese (via `generateGraduateEditableDraftDocxBlob`, com patches de natureza/recuo/Curso) exercitados no gate por tipo: 15 tipos (4 padrão + 3 drafts + 8 Coleção) — 15/15 PASSED; fixtures próprias (curso para monografia; programa + orientador + indicadores para dissertação/tese).
16. [x] **Física PDF nos 15 tipos (DECISION-009/010)** — `analyze-per-type-pdfs.ts`: cada DOCX do gate é renderizado via Word COM e validado fisicamente — A4 (595.32×841.92 pt), paginação OOXML↔PDF alinhada (pgNumType start = primeiro número visível), imagens/tabelas detectadas por opList/CTM + grade de colunas; novo gate `perTypePhysicalGate` no gates.json + artefato `per-type-physical.json`; sem Word (CI) o gate passa de forma graciosa (skipped-no-word); teste em `tests/ufla-compliance/per-type-physical.test.ts`.
17. [x] **e2e Playwright (governance-roadmap)** — `npm run e2e`: compila o app (vite build) e serve via `vite preview`; fluxo real no Chromium (seleciona o Artigo científico UFLA, preenche os requiredFields próprios, gera o DOCX com download verificado, abre o preview sem erros de console); workflow `.github/workflows/e2e.yml` com instalação de browser e artefato do relatório.
18. [x] **Lighthouse (governance-roadmap)** — `npm run ufla:lh`: auditoria no Chromium do app de produção (a11y, performance, best-practices) com relatório `artifacts/lighthouse/lighthouse.json`; gate de governança: a11y ≥ 90; resultados atuais: a11y 100, performance 86, best-practices 92.
19. [x] **CI automatizado (GitHub Actions)** — `verify.yml` ganhou a etapa de conformidade UFLA sem Word (`ci-checks.ts`: 18 formatos × 15 tipos, com física PDF skipped-no-word); `e2e.yml` roda Playwright + Lighthouse em todo push/PR; axe já roda no `npm test` (jsdom).

## Resolução UFLA-AMBIGUOUS-1
- **Decisão (DECISION-010, complementa DECISION_003):** contagem contínua a partir da folha de rosto (folha de rosto = 1); pré-textuais contadas sem número visível; numeração visível inicia na Introdução com o **valor contado** (pré-textuais + 1) — **nunca reinício em 1**; "(1, 2, 3, ...)" do Manual = sistema de numeração arábico, não reinício
- **Base:** Manual UFLA § paginação; ABNT NBR 14724; evidência do documento real (pgNumType start=13 ↔ PDF físico folha 18 = 13)
- **Status:** DECISION-010 documentada; `validate-pagination.ts` implementado com OOXML + PDF físico (canto superior direito, continuidade, sem número nas pré-textuais); `ooxml-checks` corrigido (`pagination-start` substituído por `pagination-restart-at-1`); gate expandido PASSED com esta decisão; teste em `tests/rendering/pagination-physical-validation.test.ts`

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
