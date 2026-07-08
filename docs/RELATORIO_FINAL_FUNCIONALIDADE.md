# Relatório final — Site_ABNT UFLA/ABNT

## Status
Concluído e funcional para geração de rascunho DOCX editável conforme tipos de trabalho suportados, com validação preliminar e revisão final humana obrigatória.

## Escopo concluído
- Importação de DOCX/TXT/MD com reparo conservador de títulos quebrados.
- Editor de texto com marcação leve e toolbar básica.
- Autosave local (localStorage, 800ms debounce) com restauração automática.
- Limpeza de rascunho (localStorage, formulário, editor, diagnósticos, debounce).
- Validação por tipo de trabalho (placeholders, natureza, programa, curso, orientador, indicadores, compatibilidade).
- Geração DOCX editável com margens, fonte, espaçamento e sumário atualizável.
- Modelos UFLA/ABNT (artigo simples, monografia, dissertação, tese, projeto de pesquisa).
- Modelos CPG/UFLA (resumo, resumo expandido, artigo completo).
- Filtro de seções proibidas para CPG.
- Testes automatizados (contrato por tipo, regressões, fluxos de UI).
- Build de produção.

## Tipos suportados

| Tipo | Estrutura gerada | Validações específicas | Status |
|------|------------------|------------------------|--------|
| Artigo acadêmico simples | Título, autor, resumo, palavras-chave, abstract, keywords, corpo, referências | Sem pré-textuais; sem program-conflict | Funcional |
| Monografia | Capa, folha de rosto, ficha catalográfica, folha de aprovação, resumo, abstract, sumário, corpo, referências | Exige curso; orientador como alerta | Funcional |
| Dissertação | Estrutura completa com indicadores de impacto | Exige programa, orientador, indicadores; compatibilidade grau/programa | Funcional |
| Tese | Estrutura completa com indicadores de impacto | Exige programa, orientador, indicadores; compatibilidade grau/programa | Funcional |
| Projeto de pesquisa | Capa, folha de rosto, resumo, abstract, sumário, corpo, referências | Exige problema, objetivo geral, justificativa, metodologia, cronograma, referências | Funcional |
| Resumo CPG/UFLA | Título, autores, afiliação, resumo, palavras-chave, abstract, keywords | Sem capa, folha de rosto, ficha, aprovação, sumário, indicadores; 1 página | Funcional |
| Resumo expandido CPG/UFLA | Título, autores, afiliação, resumo, palavras-chave, abstract, keywords, corpo | Sem estruturas proibidas; 4 a 6 páginas | Funcional |
| Artigo completo CPG/UFLA | Título, autores, afiliação, resumo, palavras-chave, abstract, keywords, corpo | Sem estruturas proibidas; 8 a 14 páginas | Funcional |
| Coleção Produção Acadêmica UFLA | Template geral com aviso de suporte inicial | Suporte inicial; validação de campos mínimos por tipo | Funcional (parcial) |

## Limites declarados
- O sistema gera rascunho DOCX editável.
- A submissão final exige revisão humana no Word/LibreOffice.
- Ficha catalográfica oficial deve ser gerada pela Biblioteca.
- PDF final deve ser exportado no Word/LibreOffice.
- Paginação e sumário final devem ser conferidos no editor de texto.
- O sistema não substitui revisão humana, Biblioteca, orientador, banca, Word/LibreOffice ou validação oficial ABNT/UFLA.

## Evidência técnica
- `npm run verify` aprovado.
- Número de testes: 506 (495 anteriores + 11 novos de contrato final).
- Build de produção aprovado.
- Branch/main: `main`.
- Data: 2026-07-08.
- Principais arquivos testados: `src/export-docx.ts`, `src/export-article-docx.ts`, `src/export-research-project-docx.ts`, `src/export-cpg-docx.ts`, `src/cpg-content-filter.ts`, `src/heading-fragment-repair.ts`, `src/validators.ts`, `src/work-type-requirements.ts`, `src/draft-storage.ts`, `src/App.tsx`.

## Conclusão
O sistema está concluído e funcional no escopo de ferramenta de apoio à estruturação e geração de rascunho DOCX UFLA/ABNT, com modelos diferenciados por tipo de trabalho e validações preliminares automatizadas.
