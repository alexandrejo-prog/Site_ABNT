# Status normativo e técnico

Este arquivo registra o estado atual do site UFLA DOCX Acadêmico na branch `debug/manual-ufla-sumario`.

## Status por categoria

| Categoria | Estado atual | Observação |
| --- | --- | --- |
| Posicionamento | Resolvido no núcleo | O produto está posicionado como ferramenta de apoio, sem promessa de conformidade total. |
| Cobertura normativa | Parcial avançado | Há matriz normativa versionada, painel de aderência, status normativo e roadmap técnico. |
| Ficha catalográfica | Parcial avançado técnico | Há regra de obrigatoriedade, rejeição de placeholder e teste; falta só campo/upload visual e inserção final pelo usuário. |
| Resumo/Abstract | Parcial avançado | Há validação e módulo de qualidade para contagem, parágrafo único e termos. |
| Indicadores de impacto | Parcial avançado técnico | Há campos, alertas condicionais e módulo de avaliação por dimensões de impacto. |
| Listas pré-textuais | Parcial avançado técnico | Há extração inicial de figuras, tabelas e siglas; falta geração automática no DOCX final. |
| Importação DOCX | Parcial avançado | Há importação DOCX/TXT/MD, limpeza de sumário importado e preservação do editor. |
| Exportação DOCX | Parcial avançado | Há DOCX editável, sumário atualizável e paginação textual; atualização final depende de Word/LibreOffice. |
| UX de revisão | Parcial avançado técnico | Há modelo de blocos de revisão; falta aplicar os blocos dobráveis na interface principal. |
| Transparência | Parcial avançado | Há cálculo de score, relatório de aderência e relatório de prontidão final; falta exibir no painel lateral. |
| Testes | Parcial avançado | Há Vitest, testes de importação/exportação/validação/UI estática/governança; CI remoto segue bloqueado. |
| Responsividade | Parcial avançado técnico | Há testes estáticos de breakpoints; falta auditoria visual manual. |
| Acessibilidade | Parcial avançado técnico | Há checklist e testes estáticos; falta auditoria automatizada completa e revisão por teclado. |
| Performance | Parcial avançado técnico | Há orçamento técnico; falta medição real e possível Web Worker se o orçamento for excedido. |
| Governança | Parcial avançado | Há matriz, status, roadmap e relatório de prontidão; falta converter roadmap em issues/milestones formais. |

## Pronto para validação local

A base técnica está pronta para validação local. Antes de considerar a rodada concluída, execute:

```powershell
cd "C:\Users\User\Desktop\Alexandre\Site_Normas_UFLA\Site_ABNT"

git fetch origin
git pull --rebase origin debug/manual-ufla-sumario

npm test
npm run build
npm run verify
npm run dev
```

## Critérios manuais finais

1. Importar DOCX real.
2. Confirmar texto editável no painel central.
3. Confirmar tipo correto de trabalho.
4. Gerar DOCX.
5. Abrir no Word/LibreOffice.
6. Atualizar sumário com Ctrl+A e F9.
7. Confirmar que o sumário é atualizável e recebe páginas reais.
8. Conferir ficha catalográfica, imagens, legendas, referências e paginação final.

## Limites que continuam manuais

- Ficha catalográfica oficial da Biblioteca.
- Folha de aprovação real com banca e data.
- Conferência visual de imagens, tabelas e legendas.
- Atualização final do sumário e campos pelo Word/LibreOffice.
- Exportação final em PDF.
- Criação de workflow CI, bloqueada pela ferramenta remota nesta rodada.
