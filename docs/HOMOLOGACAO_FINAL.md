# Homologação Final — Site_ABNT UFLA/ABNT

## 1. Estado geral

- [x] `npm run verify` passa.
- [x] Build de produção (`npm run build`) passa.
- [x] Arquivos locais indevidos continuam fora do Git (`Regras/`, `*.pdf`, `*.docx` gerados).
- [x] `dist/`, `node_modules/`, DOCX/PDF gerados não entram no Git.

## 2. Tipos de trabalho validados

- [x] Artigo acadêmico simples
- [x] Monografia
- [x] Dissertação
- [x] Tese
- [x] Projeto de pesquisa
- [x] Resumo CPG/UFLA
- [x] Resumo expandido CPG/UFLA
- [x] Artigo completo CPG/UFLA
- [x] Itens da Coleção Produção Acadêmica UFLA (suporte inicial documentado)

## 3. Artigo acadêmico simples

- [x] Gera DOCX sem capa.
- [x] Sem folha de rosto.
- [x] Sem ficha catalográfica.
- [x] Sem folha de aprovação.
- [x] Sem indicadores de impacto.
- [x] Sem sumário.
- [x] Começa com título, autor, resumo, palavras-chave, abstract, keywords e corpo textual.
- [x] Não exige curso, programa, orientador ou indicadores.
- [x] Não emite `program-conflict` por metadados institucionais.

## 4. Monografia

- [x] Gera capa.
- [x] Gera folha de rosto.
- [x] Gera ficha catalográfica provisória.
- [x] Gera folha de aprovação.
- [x] Gera resumo.
- [x] Gera abstract.
- [x] Gera sumário.
- [x] Gera corpo textual.
- [x] Gera referências.
- [x] Exige curso.
- [x] Não exige indicadores de impacto.
- [x] Orientador tratado como alerta/exigência conforme regra.

## 5. Dissertação e tese

- [x] Geram estrutura completa.
- [x] Exigem programa.
- [x] Exigem orientador.
- [x] Exigem indicadores de impacto.
- [x] Folha de rosto com natureza correta.
- [x] Não usam texto genérico "Trabalho acadêmico apresentado..." quando há tipo e metadados suficientes.
- [x] Preservam validação de compatibilidade programa/grau.
- [x] Evitam falso `program-conflict` quando o texto é coerente com o programa informado.

## 6. Projeto de pesquisa

- [x] Usa template próprio (`projeto-pesquisa`).
- [x] Exige problema de pesquisa.
- [x] Exige objetivo geral.
- [x] Exige justificativa.
- [x] Exige metodologia.
- [x] Exige cronograma.
- [x] Exige referências.
- [x] Gera estrutura compatível com projeto de pesquisa.
- [x] Não usa validações indevidas de dissertação/tese quando não aplicáveis.

## 7. CPG/UFLA

- [x] Resumo CPG, resumo expandido CPG e artigo completo CPG não geram capa.
- [x] Não geram folha de rosto.
- [x] Não geram ficha catalográfica.
- [x] Não geram folha de aprovação.
- [x] Não geram sumário.
- [x] Não geram indicadores de impacto.
- [x] Filtram seções incompatíveis do corpo exportado.
- [x] Preservam seções permitidas após uma seção filtrada.
- [x] Mantêm título, autores, afiliação, resumo, palavras-chave, abstract e keywords na ordem correta.
- [x] Mantêm alertas de extensão/página como revisão manual, sem quebrar geração de rascunho quando permitido.

## 8. Autosave e limpeza

- [x] Autosave salva rascunho com conteúdo real.
- [x] Limpar rascunho remove `localStorage`.
- [x] Limpar rascunho limpa formulário/editor.
- [x] Limpar rascunho limpa diagnósticos antigos.
- [x] Limpar rascunho cancela debounce pendente.
- [x] Limpar rascunho não recria rascunho vazio por causa de campos padrão como local/ano.
- [x] Após nova edição, autosave volta a funcionar.

## 9. Rascunho com pendências

- [x] Geração normal bloqueia erros críticos.
- [x] "Gerar rascunho mesmo com pendências" permite pendências revisáveis.
- [x] Placeholder `[PREENCHER: ...]` continua bloqueando.
- [x] Placeholder natural continua bloqueando.
- [x] Pendências acadêmicas revisáveis não bloqueiam rascunho.

## 10. Importação e títulos

- [x] Importação DOCX/TXT/MD funciona.
- [x] Títulos quebrados são reparados de forma conservadora.
- [x] Não junta título com parágrafo comum.
- [x] Caso `# 4 RESULTADOS` + `E DISCUSSÃO` vira `# 4 RESULTADOS E DISCUSSÃO`.

## 11. DOCX

- [x] Abre no Word/LibreOffice.
- [x] Fonte principal correta.
- [x] Margens básicas corretas.
- [x] Corpo justificado.
- [x] Recuo de primeira linha.
- [x] Resumo/abstract com formatação adequada.
- [x] Referências em seção própria.
- [x] Sumário não fica vazio nos modelos que exigem sumário.
- [x] Campo TOC atualizável presente; documento não sai com página de sumário vazia.
