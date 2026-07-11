# Status normativo e tecnico

Este arquivo registra o fechamento tecnico da rodada na branch `debug/manual-ufla-sumario`.

## Status por categoria

Estados usados neste arquivo:

- **Concluido tecnicamente**: implementado e coberto por validacao automatizada, ainda sujeito a conferencia final do usuario.
- **Parcial avancado**: fluxo principal existe, mas depende de revisao humana ou ainda nao cobre todas as variantes.
- **Requer validacao manual**: nao pode ser confirmado apenas por teste automatizado.
- **Limitacao conhecida**: comportamento assumidamente incompleto nesta fase.

| Categoria | Estado atual | Observacao |
| --- | --- | --- |
| Posicionamento | Concluido tecnicamente | Produto posicionado como ferramenta de apoio. |
| Cobertura normativa | Parcial | Matriz, painel, status e roadmap versionados. |
| Ficha catalografica | Parcial avançado | Regra e orientacao final registradas. Placeholder rejeitado. Revisao manual obrigatoria. |
| Resumo/Abstract | Parcial | Validacao de estrutura e extensao. Revisao manual obrigatoria para texto final. |
| Indicadores de impacto | Parcial | Campos e alertas estruturados. Revisao final obrigatoria pelo usuario. |
| Listas pre-textuais | Implementado parcialmente | Figuras, tabelas e siglas possuem extracao inicial. Nao geram listas automaticas. |
| Importacao DOCX | Parcial | Importacao funciona com mammoth e OOXML. Reparo de titulos quebrados embutido. Revisao manual necessaria. |
| Exportacao DOCX | Concluido tecnicamente | DOCX editavel com sumario atualizavel via F9 no Word. |
| Colecao Producao Academica UFLA | Suporte inicial | Oito formatos cadastrados com catalogo tecnico, validacao minima e exportador generico. Validacao manual obrigatoria. |
| UX de revisao | Concluido tecnicamente | Blocos, editor, validacao e aderencia modelados. |
| Transparencia | Concluido tecnicamente | Score, relatorio e status de conclusao estruturados. |
| Testes | Concluido tecnicamente | Cobertura local com testes unitarios, integrados e OOXML. |
| Responsividade | Concluido tecnicamente | Breakpoints e layout minimo rastreados. |
| Acessibilidade | Parcial avancado | Checklist, regioes nomeadas, foco visivel, auditoria axe, testes de contraste WCAG e mensagens com role=status/role=alert. Revisao manual recomendada. |
| Performance | Parcial avancado | Carregamento sob demanda. Chunks grandes sinalizados. |
| Governanca | Concluido tecnicamente | Matriz, roadmap e status versionados. |

## Limitacoes reais reconhecidas

- **DOCX e PDF**: O DOCX e a saida canonica. O PDF final deve ser exportado pelo Word ou LibreOffice. O sistema nao gera PDF diretamente.
- **Colecao Producao Academica UFLA**: Os formatos foram cadastrados como suporte inicial. A validacao manual continua obrigatoria e os exportadores especificos serao incrementais.
- **Sumario**: Requer atualizacao manual (F9 no Word) apos gerar o documento.
- **Imagens**: Importadas como marcadores (`[Imagem detectada: ...]`). Imagens reais nao sao preservadas visualmente no DOCX gerado. Legendas, qualidade e posicao exigem revisao manual.
- **Importacao DOCX**: Depende de heuristicas de deteccao. Documentos fora do padrao UFLA podem requerer ajustes manuais.
- **Formatacao ABNT**: Os testes OOXML cobrem parte da estrutura, mas nao substituem inspecao visual no Word ou LibreOffice.
- **PWA**: Nao implementado. Cache de versao pode ser problema futuro, mas nao prioritario.

## Fechamento

A rodada tecnica esta concluida. A validacao final deve ser feita com o arquivo real no navegador e no editor de texto usado para atualizar campos do DOCX.
