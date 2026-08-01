---
name: karpathy-behavioral-guidelines
---

# Diretrizes Comportamentais Karpathy Adaptadas — Site_ABNT

## Sobre Este Documento

Esta skill adapta as diretrizes comportamentais derivadas de [Andrej Karpathy](https://x.com/karpathy/status/2015883857489522876) às especificidades do desenvolvimento de software acadêmico que segue **o Manual de Normalização da UFLA (6ª edição)** e **as normas ABNT vigentes**. O foco principal é reduzir erros comuns que comprometem a conformidade normativa, mantendo a agilidade necessária para o rápido avanço do projeto.

**Tradeoff:** Estas diretrizes priorizam **conformidade normativa** e **conformidade comprovada** em relação à velocidade de desenvolvimento, embora sejam flexíveis para tarefas triviais.

## 1. Pense Antes de Codificar

**Não assuma. Não oculte a confusão. Surpreenda os trade-offs.**

Antes de implementar qualquer alteração:

- **Declare suas suposições explicitamente.** No Site_ABNT, presumir que um campo é opcional sem verificar o manual da UFLA pode comprometer a conformidade. Exemplo: Determinar se “coorientador” aparece ou não na folha de rosto deve ser condicional baseado no checklist UFLA.

- **Se múltiplas interpretações existirem, apresente-as.** Exemplo: Ao adaptar um campo “resumo”:
  - 150–500 palavras conforme NBR 6028:2021
  - Espaçamento simples em vez de 1,5 conforme UFLA §5.2.3.1
  - Títulos “RESUMO”/"ABSTRACT” centralizados e negritos

- **Se uma abordagem mais simples existir, mencione-a.** Exemplo: Para gerar um DOCX, prefira reutilizar o núcleo `docx-render-core.ts` em vez de reimplementar a conversão markdown→runs por tipo de trabalho.

- **Se algo estiver confuso, pare. Nomeie a confusão. Pergunte.** Exemplo: Ao encontrar um nó não utilizado em `src/docx-shared.ts`, pergunte: “Este nó é residual de um exportador anterior e não deve estar presente na exportação final?”

## 2. Simplicidade Primeiro

**Código mínimo que resolve o problema. Nada especulativo.**

No contexto do Site_ABNT:

- **Nenhum recurso além do que foi solicitado.** Exemplo: Ao adicionar um campo opcional de “subtítulo” na capa, adicione apenas o campo sem layout decorativo extra ou validação além da conformidade manual.

- **Nenhuma abstração para código de uso único.** Exemplo: A lógica de espaçamento simples vs 1,5 linhas deve ser implementada como constante direta `SINGLE = { line: { spacing: { line: 360 } } }` em `ufla-rules.ts` — não uma classe abstrata.

- **Nenhuma “flexibilidade” ou “configurabilidade” além daquilo que foi solicitado.** Exemplo: A habilidade `ufla_docx_rules` já fornece as regras básicas; não adicione suporte extra a templates não solicitados.

- **Nenhum tratamento de erro para cenários impossíveis.** Exemplo: As importações rejeitam PDF/ODT/RTF — trate esse como erro, não como característica para “converter para DOCX”.

- **Se 200 linhas poderiam ser 50, reescreva.** Exemplo: Um exportador DOCX de 150 linhas usando loops internos repetidos pode ser reduzido para menos de 50 linhas usando funções puras em `docx-shared.ts`.

**O teste:** “Um engenheiro sênior diria que isto está sobrecomplicado?” Se sim, simplifique.

## 3. Mudanças Cirúrgicas

**Toque apenas no que for necessário. Limpe apenas a sua bagunça.**

Ao modificar código existente no Site_ABNT:

- **Não “melhore” código adjacente, comentários ou formatação.** Exemplo: Corrigir a lógica do exportador `coadvisor` deve ser separado de ajustar margens globalmente. Limpe apenas a lógica do coadvisor.

- **Não refatore coisas que não estejam quebradas.** Exemplo: O array `styleCaption` em `docx-shared.ts:172` funciona para legendas — não reescreva completamente sem necessidade comprovada.

- **Iguale-se ao estilo existente, mesmo que você preferisse de outro jeito.** Exemplo: Para comentários sobre marcas UFLA, use o estilo `# @TODO UFLA` em vez de `# FIXME`.

- **Se encontrar código morto não relacionado, mencione-o — não o delete.** Exemplo: Um `console.log` residual em `export-article-docx.ts:280` deve ser mencionado, não deletado sem questionar a necessidade original do desenvolvedor.

Quando suas alterações criarem lixo:

- **Remova imports/variáveis/funções que suas alterações tornaram não utilizados.** Exemplo: Se adicionar `workTitleEn` a um exportador mas não usá-lo, remova a variável.

- **Não remova código morto preexistente a menos que seja solicitado.** Exemplo: O campo `workTitleEn` ainda é mencionado no manual da UFLA mesmo que não implementado — mantenha consistente.

**O teste:** Cada linha alterada deve traçar-se diretamente para a solicitação do usuário.

## 4. Execução Guiada por Metas

**Defina critérios de sucesso. Repita até verificar.**

Transforme tarefas imperativas em metas declarativas verificáveis:

| Em vez de... | Transforme em... |
|---|---|
| “Adicionar validação” | “Escreva testes para entradas inválidas, depois torne-os aceitáveis” |
| “Corrigir a citação longa” | “Escreva um teste que reprodure o recuo incorreto (1,25cm vs 4cm), então conserte usando `cmToTwip(4)`” |

Para tarefas complexas, apresente um breve plano:

```
1. [Corrigir recuo citação longa] → verificar: verificar `src/export-docx.ts:1227` contra `cmToTwip(4)` (≈10px)
2. [Remover sumário CPG] → verificar: `src/export-cpg-docx.ts:68` condicional excluindo `TableOfContents`
3. [Adicionar 8 mapeamentos mojibake] → verificar: `ufla-rules.ts:273‑280` contém todas as maiúsculas
```

**Fortes** critérios de sucesso permitem que você trabalhe independentemente. **Fracos** (ex: “tornar aceitável”) requerem constante esclarecimento.

## Testando Se As Diretrizes Estão Funcionando

Estas diretrizes estão funcionando se você observar:

- **Menos alterações desnecessárias nos diffs** — Apenas as linhas solicitadas aparecem
- **Menos reescritas por overcomplicação** — O código é simples na primeira tentativa
- **Perguntas esclarecedoras antes da implementação** — Não após cometer erros
- **PRs limpos e mínimos** — Sem drive-by refactoring ou “melhorias”

## Regras Específicas do Site_ABNT

### Integração com Normas UFLA/ABNT

- **Ao adicionar nova regra de espaçamento, teste com o validador `npm run skill:validate`** antes de fechar uma tarefa
- **Ao modificar lógica condicional (ex: coorientador), adicione descrição do caso de teste no comentário**
- **Todos os novos exportadores devem ficar dentro de `src/`** — não mover para subpastas

### Validação de Conformidade Obrigatória

Antes de finalizar qualquer alteração:

1. **Execute testes unitários:** `npm test`
2. **Certifique-se de que o build compila:** `npm run build`
3. **Valide o DOCX gerado:** `npm run skill:validate -- <path-to-docx>`
4. **Revise o relatório de conformidade** para garantir conformidade 100% verde para o tipo de trabalho manipulado

### Diretrizes de Arquitetura e Código Específicas

- **Estabilidade:** Evite refatorações em larga escala ou adição de dependências externas sem necessidade comprovada
- **Código Limpo:** Priorize funções puras, tipagem estrita com TypeScript e testes próximos da implementação
- **Exportadores:** Todos os scripts de geração DOCX permanecem em `src/` — não os movam para subpastas sem refatoração explicitamente aprovada

## Tradução e Comentários em Português

Todas as instruções de implementação, comentários de plano e diálogos com o usuário devem ser **em Português (Brasil)**.

Termos técnicos em inglês devem ser brevemente explicados:

- *SpacedLine* → espaçamento entre linhas de parágrafo (ou seja, 1,5 linhas)
- *HangingIndent* → recuo deslocante (0,5cm para referências)
- *TextRun* → linha de texto contígua no DOCX (elemento XML)

## Licença

MIT
