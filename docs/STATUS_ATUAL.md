# STATUS ATUAL — Site ABNT / UFLA

> Único documento de status. Resultados históricos: `checkpoint/workslop-assessment.md`.
> Conformidade completa: `artifacts/ufla-compliance/report.md` (canônico).

## Última Atualização
- Data: 2026-08-15
- Hora: 17:00 (OMML cru re-injetado + ficha com upload + w:tblHeader + validação de notas)
- Branch: `feat/ufla-render-validation`
- Evidência: `npm run verify` 100% verde; tsc limpo; lint 0 erros/0 warnings

## Suíte de Testes
- Passed: 1529
- Failed: 0
- Skipped: 10
- Arquivos: 195
- Build: OK (tsc + vite)
- tsc --noEmit: 0 erros (inclui scripts/ufla-compliance via alias @scripts)
- lint: 0 erros, 0 warnings

## Gates (scripts/ufla-compliance)
- GATE DE CÓDIGO: PASSED (npm test + lint + build)
- runExpandedComplianceGate: roda sem erro no DOCX real; technical 15/15 true no artefato (fixture sem orientador/curso/refs ordenadas continua gerando gaps heurísticos)
- FULL_COMPLIANCE_GATE: permanece não declarado — ver pendências abaixo

## Pendências Resolvidas (2026-08-15)
1. [x] **Equações avançadas (OMML cru re-injetado)** — o `<m:oMathPara>` original da origem é capturado na extração, viaja no rascunho como token invisível `\uF001OMML:<base64>\uF001`, e é re-injetado no XML final pelo patch pós-Packer (frações/raízes preservadas — teste `ufla-equations` round-trip m:f)
2. [x] **Ficha catalográfica §6.1 completa** — campo de texto novo (`fichaCatalografica`) + upload de imagem da ficha oficial na UI (seção pré-textuais); exportação prioriza imagem e cai para texto; estilo `ufla_ficha_catalografica` (espaço simples)
3. [x] **Cabeçalho repetido de tabelas (w:tblHeader)** — patch pós-Packer corrigido (estava morto e com posição inválida em tblPr); agora marca a primeira linha de cada tabela em trPr (Manual §23.3)
4. [x] **Validação de notas de rodapé no checker** — itens 24.1–24.3 (notas reais em footnotes.xml, fonte menor com espaço simples, Times New Roman; Manual §21)
5. [x] **Tipos de referência do §25.14** — normalizador ampliado (patente, jornal, periódico, audiovisual, sonoro, partitura, iconográfico, cartográfico, tridimensional, dados de pesquisa, correspondência); 50 testes

## Pendências Declaradas (não bloqueiam conformidade do DOCX)
1. [ ] Lombada (§3.1, elemento externo de impressão) e ilustração multipágina "continua/conclusão" (§23.3)
2. [ ] Criação de notas de rodapé por botão na UI (markup `[^N]`/`[^N]:` já funciona e é testado — conveniência, não conformidade)

## Resolução UFLA-AMBIGUOUS-1
- **Decisão:** paginação contínua a partir da Introdução
- **Base:** Manual UFLA §3.2.7 p.73
- **Status:** DECISION_003 documentada; checker `pagination-start` implementado
- **Impacto:** desbloqueia `fullComplianceGate` para este item

## Próximas Fatias
1. FATIA 2: Equações OMML (UFLA-023) — CONCLUÍDA (OMML cru re-injetado)
2. FATIA 3: Rodapés + paginação (FINDING-FOOTER-001..008; UFLA-AMBIGUOUS-1) — CONCLUÍDA
3. FATIA 6: Regenerar artefatos oficiais (`regenerate-official-artifacts.ts`) e declarar conformidade se todos os gates passarem

## Evidências (2026-08-15 12:25)
- DOCX: `artifacts/ufla-compliance/normalized-dissertacao.docx`
- PDF: `artifacts/ufla-compliance/rendered/normalized-dissertacao.pdf` (236 p.)
- OOXML: 35 tabelas, 25 `<w:tblHeader/>`, 39 bookmarks/31 PAGEREF, 0 alvos ausentes, 0 mojibake
- Report: `artifacts/ufla-compliance/report.md` (canônico, mesma rodada)
- Gates: `artifacts/ufla-audit/gates.json` (meta `generatedAt` 2026-08-15T12:25Z)
- Resumo status: 48 itens (31 covered, 10 partial, 7 not-covered)

## Regras para IAs
1. Nunca editar números de evidência à mão: rodar `scripts/ufla-compliance/regenerate-official-artifacts.ts` (computa tudo da mesma rodada).
2. Antes de mudar tabelas, ler `docs/decisions/001` e `002` (heurística de cabeçalho causou regressão).
3. Registrar toda decisão em `docs/decisions/NNN-*.md` e atualizar ESTE arquivo.
4. Suíte verde antes de regenerar evidências; FULL_COMPLIANCE_GATE permanece FAILED até todos os gates passarem.
