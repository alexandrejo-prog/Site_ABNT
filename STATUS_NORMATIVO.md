# Status normativo e técnico

Este arquivo registra o estado atual do site UFLA DOCX Acadêmico na branch `debug/manual-ufla-sumario`.

## Status por categoria

| Categoria | Estado atual | Observação |
| --- | --- | --- |
| Posicionamento | Concluído técnico | O produto está posicionado como ferramenta de apoio, sem promessa de conformidade total. |
| Cobertura normativa | Concluído técnico | Há matriz normativa versionada, painel de aderência, status normativo e roadmap técnico. |
| Ficha catalográfica | Concluído técnico com conferência manual final | Há regra de obrigatoriedade, rejeição de placeholder e teste. A ficha oficial continua sendo fornecida pela Biblioteca/usuário na versão final. |
| Resumo/Abstract | Concluído técnico | Há validação e módulo de qualidade para contagem, parágrafo único e termos. |
| Indicadores de impacto | Concluído técnico | Há campos, alertas condicionais e módulo de avaliação por dimensões de impacto. |
| Listas pré-textuais | Concluído técnico | Há extração inicial de figuras, tabelas e siglas e testes de detecção. A conferência visual final permanece manual. |
| Importação DOCX | Concluído técnico | Há importação DOCX/TXT/MD, limpeza de sumário importado, preservação do editor e reparo de título quebrado. |
| Exportação DOCX | Concluído técnico com conferência manual final | Há DOCX editável, sumário atualizável e paginação textual. A atualização final depende de Word/LibreOffice. |
| UX de revisão | Concluído técnico | Há modelo de blocos de revisão, fluxo de editor e testes estáticos de interface. |
| Transparência | Concluído técnico | Há cálculo de score, relatório de aderência, relatório de prontidão final e status de conclusão. |
| Testes | Concluído técnico com conferência local | Há Vitest, testes de importação/exportação/validação/UI estática/governança e modelo de CI documentado. |
| Responsividade | Concluído técnico com conferência visual final | Há testes estáticos de breakpoints e largura mínima. A auditoria visual final permanece manual. |
| Acessibilidade | Concluído técnico com conferência manual final | Há checklist e testes estáticos. Revisão por teclado e contraste continuam como conferência final. |
| Performance | Concluído técnico com medição futura | Há orçamento técnico. Medição real e Web Worker ficam condicionados a arquivos grandes excederem o orçamento. |
| Governança | Concluído técnico | Há matriz, status, roadmap, relatório de prontidão e status de conclusão versionado. |

## Pronto para validação local

A base técnica está pronta para validação local. Antes de considerar a rodada concluída no computador local, execute:

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

## Limites que continuam manuais por natureza do processo

- Ficha catalográfica oficial da Biblioteca.
- Folha de aprovação real com banca e data.
- Conferência visual de imagens, tabelas e legendas.
- Atualização final do sumário e campos pelo Word/LibreOffice.
- Exportação final em PDF.
- Criação de workflow CI em `.github/workflows`, bloqueada pela ferramenta remota nesta rodada; o modelo ficou documentado em `docs/CI_VERIFY.md`.
