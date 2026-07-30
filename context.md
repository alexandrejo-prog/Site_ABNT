# Contexto do Projeto — Site_ABNT

> Manual de bordo para IA. Consulte SEMPRE antes de responder sobre o projeto.

---

## 1. VISÃO GERAL

- **Nome:** Site_ABNT
- **Objetivo:** Gerador de documentos acadêmicos conforme normas UFLA 6ª edição / ABNT
- **Tecnologias:** React 18, TypeScript 5, Vite, docx (biblioteca), Tiptap (editor rich-text), Vitest
- **Deploy:** Vercel (SPA)
- **Testes:** 120 arquivos, 987+ testes, via `npm run verify`

---

## 2. ESTRUTURA DE DIRETÓRIOS

```
Site_ABNT/
├── src/
│   ├── App.tsx                       # Componente principal (~148 linhas)
│   ├── main.tsx                      # Ponto de entrada
│   ├── components/                   # Componentes React
│   │   ├── EditorSection.tsx         # Editor Tiptap
│   │   ├── EditorToolbar.tsx         # Toolbar do editor
│   │   └── MetadataFields.tsx        # Campos de metadados
│   ├── hooks/                        # Hooks personalizados
│   ├── services/                     # Serviços (PDF, DOCX helpers)
│   ├── export-docx.ts                # Dissertação, Tese, TCC (monografia)
│   ├── export-article-docx.ts        # Artigo científico
│   ├── export-cpg-docx.ts            # Resumo expandido CPG
│   ├── export-research-project-docx.ts # Projeto de pesquisa (NBR 15287)
│   ├── docx-render-core.ts           # Núcleo compartilhado de renderização
│   ├── docx-shared.ts                # Funções compartilhadas (run, paragraph)
│   ├── ufla-rules.ts                 # Constantes tipográficas UFLA
│   ├── app-constants.ts              # Labels, mensagens, constantes de UI
│   └── ... demais utilitários
├── tests/                            # 120+ arquivos de teste
├── skills/
│   └── ufla-docx-compliance/         # Skill de validação de conformidade
├── package.json
├── vite.config.ts
├── tsconfig.json
├── vercel.json
├── CHECKLIST_SITE_UFLA_MANUAL.md
├── PRD.md
├── SKILL.md
├── context.md                        # ← Este arquivo
└── README.md
```

> **Nota:** Os exportadores ficam em `src/` (não em `src/exportadores/`).

---

## 3. TIPOS DE TRABALHO SUPORTADOS

| Tipo | Exportador | Elementos obrigatórios | Elementos PROIBIDOS |
|------|-----------|----------------------|-------------------|
| **Tese** | `export-docx.ts` | Capa, folha de rosto, ficha catalográfica, folha aprovação, indicadores impacto, resumo, abstract, sumário, referências | — |
| **Dissertação** | `export-docx.ts` | Mesmo da tese | — |
| **TCC/Monografia** | `export-docx.ts` | Capa, folha de rosto, resumo, abstract, sumário, referências | Indicadores de impacto (opcional) |
| **Artigo** | `export-article-docx.ts` | Título centralizado, autor centralizado, resumo, abstract, referências | Capa UFLA, folha de rosto, ficha catalográfica, indicadores |
| **Resumo Expandido CPG** | `export-cpg-docx.ts` | Título, autores, resumo, abstract, desenvolvimento, referências | Capa UFLA, folha de rosto, sumário, paginação, apêndices, anexos |
| **Projeto Pesquisa** | `export-research-project-docx.ts` | Estrutura conforme NBR 15287:2025 | — |

---

## 4. REGRAS UFLA (tipografia em `ufla-rules.ts`)

```typescript
const UFLA_RULES = {
  margins: {
    top: cmToTwip(3),    // 3 cm
    bottom: cmToTwip(2), // 2 cm
    left: cmToTwip(3),   // 3 cm
    right: cmToTwip(2),  // 2 cm
  },
  typography: {
    fontFamily: "Times New Roman",
    bodyFontSizePt: 12,
    longQuoteFontSizePt: 11,
    captionFontSizePt: 12,
    sourceFontSizePt: 11,
    bodyLineTwip: 360,        // 1,5 espaçamento
    singleLineTwip: 240,      // espaço simples
    paragraphFirstLineCm: 1.25,
    longQuoteLeftIndentCm: 4,
    hangingIndentCm: 0.5,
  },
};
```

**Constantes importantes (`docx-shared.ts`):**
- `BODY_LINE = 360` — espaçamento 1,5
- `SINGLE_LINE = 240` — espaço simples
- `COVER_AUTHOR_SIZE = 28` — 14pt
- `COVER_TITLE_SIZE = 32` — 16pt

**Núcleo compartilhado (`docx-render-core.ts`):**
- `longQuoteParagraph()` — citação longa (recuo 4cm, fonte 11pt, espaçamento simples)
- `sourceParagraph()` — fonte (alinhada à direita, itálico, 11pt)
- `captionParagraph()` — legenda (centralizada, negrito, 12pt)
- `textRunsFromMarkup()` — markdown → runs DOCX

---

## 5. CORREÇÕES APLICADAS (HISTÓRICO COMPLETO)

### Lote 1 — Commit `32322dd` (19/19 correções)

| ID | Correção | Arquivo |
|----|---------|---------|
| G1 | `heading1Paragraph` CENTER → LEFT | `export-docx.ts` |
| G2 | `pageNumbers.start → 1` | `export-docx.ts`, `export-research-project-docx.ts` |
| G3 | Ano em negrito na capa | `export-docx.ts`, `export-research-project-docx.ts` |
| G4 | Hanging indent 720 → `cmToTwip(0.5)` | `export-research-project-docx.ts` |
| G5 | Legenda figura 12pt (estava 11pt) | `docx-render-core.ts` |
| G6 | Palavras-chave em negrito + período final | `export-docx.ts`, `export-article-docx.ts` |
| G7 | REFERÊNCIAS centralizado + uppercase | `export-docx.ts`, `export-article-docx.ts` |
| G8 | REFERÊNCIAS título uppercase no corpo | `export-article-docx.ts` |
| G9 | Referências em ordem alfabética | `export-article-docx.ts` |
| G10 | Citação longa recuo 4cm (núcleo compartilhado) | `docx-render-core.ts` |
| G11 | Fonte 11pt citação longa | `docx-render-core.ts` |
| G12 | CPG: heading1 uppercase | `export-cpg-docx.ts` |
| G13 | CPG: legenda 11pt | `export-cpg-docx.ts` |
| G14 | CPG: sumário removido | `export-cpg-docx.ts` |
| G15 | CPG: margens 3/2/3/2 cm | `export-cpg-docx.ts` |
| G16 | CPG: espaçamento corpo 1,5 | `export-cpg-docx.ts` |
| G17 | Projeto: autor/subtítulo uppercase | `export-research-project-docx.ts` |
| G18 | Projeto: heading3 negrito | `export-research-project-docx.ts` |
| G19 | Mojibake + NBSP + hifenização | `docx-render-core.ts` |

### Lote 2 — Working tree (não commitado)

| ID | Correção | Arquivos |
|----|---------|---------|
| L2-G1 | Título/Autor CPG uppercase + espaçamento simples resumo/abstract | `export-cpg-docx.ts` |
| L2-G2 | Palavras-chave/Keywords bold + single spacing + período no projeto | `export-research-project-docx.ts` |
| L2-G3 | REFERÊNCIAS centralizado no projeto | `export-research-project-docx.ts` |
| L2-G4 | Heading3 `bold: false` no artigo | `export-docx.ts` |
| L2-G5 | labeledSection centralizada + uppercase no artigo | `export-article-docx.ts` |
| L2-G6 | Fonte 11pt citação longa via núcleo compartilhado | `export-article-docx.ts`, `export-docx.ts` |
| L2-G7 | Figuras: legenda acima + fonte abaixo | `export-docx.ts` |
| L2-G8 | Título/Autor uppercase no artigo | `export-article-docx.ts` |
| L2-G9 | App.tsx refatorado (~148 linhas) + componentes extraídos | `App.tsx`, `EditorSection.tsx`, `EditorToolbar.tsx`, `MetadataFields.tsx` |

---

## 6. STATUS ATUAL DOS TESTES

| Métrica | Valor |
|---------|-------|
| Arquivos de teste | 120/120 ✅ |
| Testes individuais | 987/987 ✅ |
| Skipped (intencionais) | 10 |
| Build (tsc --noEmit) | Sem erros (apenas pré-existentes) |

---

## 7. PENDÊNCIAS CONHECIDAS

| Item | Tipo | Prioridade |
|------|------|-----------|
| Sumário dinâmico (TOC) no artigo completo | GRAVE | ALTA |
| Figura 1 e 2 como elementos flutuantes | MÉDIO | MÉDIA |
| Testes automatizados de conformidade UFLA | MÉDIO | MÉDIA |
| Subtítulo após dois-pontos: minúsculo | BAIXO | BAIXA |

---

## 8. COMANDOS ÚTEIS

```bash
npm run dev          # Iniciar servidor de desenvolvimento
npm run build        # Build do projeto
npm test             # Executar todos os testes
npm run verify       # Build + testes (comando oficial)
npx vitest --ui      # UI interativa dos testes
npx tsc --noEmit     # Verificar tipos TypeScript
```

---

## 9. LINKS ÚTEIS

- **Manual UFLA 6ª ed.:** <https://bibliotecauniversitaria.ufla.br/servicos-biblioteca/manual-de-normalizacao>
- **Repositório:** <https://github.com/alexandrejo-prog/Site_ABNT>
- **Deploy (Vercel):** (a definir)

---

## 10. REGRAS PARA A IA

1. **SEMPRE** consulte este arquivo antes de responder sobre o projeto
2. **MANTENHA** atualizado quando novas correções forem aplicadas
3. **USE** como referência para todas as regras UFLA
4. **NÃO** leia todo o código-fonte a cada interação — use este arquivo como contexto
5. **CORRIJA** imprecisões na estrutura/diretórios se o projeto mudar
