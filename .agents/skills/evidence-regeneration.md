# SKILL: Regeneração de evidências oficiais (anti-workslop)

## Objetivo
Regenerar DOCX, PDF, análise física e relatórios oficiais de forma que TODA a
evidência descreva o MESMO estado de código na MESMA rodada — eliminando o
padrão workslop de números fixos desatualizados.

## Quando Usar
- Sempre que o código mudar (nunca reutilizar artefatos antigos);
- Antes de atualizar `report.md`/`gates.json`;
- Após cada fatia (w:tblHeader, OMML, rodapés, etc.).

## Fluxo
1. Suíte verde obrigatória: `npm test` (0 falhas) + `npm run lint` + `npm run build`.
2. Gerar DOCX: `npx tsx scripts/ufla-compliance/generate-normalized.ts`
   (verifique `w:tblHeader`/conteúdo com inspeção do document.xml).
3. Renderizar com Word (campos + TOC; caminhos ABSOLUTOS — Word COM não
   resolve relativos; use um nome de saída novo se o destino estiver travado):
   ```bash
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/acceptance/validate-word.ps1 \
     -DocxPath "ABS/artifacts/ufla-compliance/normalized-dissertacao.docx" \
     -PdfOutput "ABS/artifacts/ufla-compliance/rendered/normalized-dissertacao.pdf" \
     -ManifestOutput "ABS/artifacts/ufla-compliance/rendered/word-manifest.json" \
     -UpdateFields -UpdateToc
   ```
4. Análise física: `npx tsx scripts/ufla-compliance/analyze-pdf-physical.ts`
   (confira 0 overlaps/cutoffs/blank no `pdf-physical-analysis.json`).
5. Regenerar gates/relatórios/rastreabilidade:
   `npx tsx scripts/ufla-compliance/regenerate-official-artifacts.ts`
   — o script computa a evidência DINAMICAMENTE (executa `npm test`, lê
   páginas do manifest e conta `w:tblHeader` no DOCX). Não edite números à mão.
6. Atualizar `artifacts/ufla-compliance/report.md` (canônico) com hashes,
   páginas, contagens e status da MESMA rodada.
7. Registrar decisão em `docs/decisions/` e atualizar `docs/STATUS_ATUAL.md`.

## Comandos
```bash
npm test && npm run lint && npm run build
npx tsx scripts/ufla-compliance/generate-normalized.ts
# validate-word.ps1 (acima, com caminho absoluto)
npx tsx scripts/ufla-compliance/analyze-pdf-physical.ts
npx tsx scripts/ufla-compliance/regenerate-official-artifacts.ts
```

## Critérios de Aceite
- `gates.json`/`report.md` descrevem exatamente o `npm test` executado na
  regeneração (codeGate com contagem real);
- Hashes dos DOCX/PDF batem com os listados no report.md;
- Nenhum número fixo de rodadas anteriores sobrevive nos artefatos.

## Riscos
- Word COM: caminho relativo falha; destino somente leitura/travado → usar
  saída nova e promover com `mv`;
- Rodar sem suíte verde propaga evidência falsa (WORKSLOP-001/003).

## Referências
- `checkpoint/workslop-assessment.md` (WORKSLOP-001..004)
- `docs/decisions/001..003`
