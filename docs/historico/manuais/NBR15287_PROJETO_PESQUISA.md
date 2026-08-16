# Referência operacional — ABNT NBR 15287:2025 — Projeto de pesquisa

> **Uso no projeto Site_ABNT:** este arquivo é uma referência operacional para orientar a implementação do tipo de trabalho **Projeto de pesquisa** no gerador DOCX.  
> **Atenção:** este documento **não reproduz** a norma ABNT NBR 15287:2025 e **não substitui** a consulta à norma oficial. A norma é protegida por direitos autorais. Este arquivo contém apenas uma síntese funcional para desenvolvimento, validação e testes.

## 1. Identificação da norma

**Norma:** ABNT NBR 15287:2025  
**Título geral:** Informação e documentação — Projeto de pesquisa — Apresentação  
**Objeto:** princípios gerais para apresentação de projetos de pesquisa.  
**Uso no sistema:** criação de tipo/exportação específica para projeto de pesquisa em DOCX editável.

## 2. Escopo de implementação no Site_ABNT

O sistema deve tratar **Projeto de pesquisa** como tipo próprio de documento, diferente de:

- artigo;
- monografia;
- dissertação;
- tese;
- modelos CPG.

A implementação deve ser **inicial e transparente**, evitando prometer conformidade automática completa com a NBR 15287.

Na interface, documentação e painel de aderência, usar linguagem como:

> Suporte inicial/parcial para projeto de pesquisa conforme ABNT NBR 15287:2025. A revisão final pelo usuário continua obrigatória.

## 3. Princípios gerais para o documento gerado

O DOCX de projeto de pesquisa deve priorizar:

- arquivo editável;
- estrutura clara;
- seções acadêmicas reconhecíveis;
- títulos hierarquizados;
- campos revisáveis pelo usuário;
- compatibilidade com edição posterior no Word ou LibreOffice;
- transparência sobre validações parciais.

A exportação não deve bloquear revisão manual nem afirmar conformidade total.

## 4. Elementos estruturais recomendados

Para suporte inicial, o projeto de pesquisa pode ser estruturado com os seguintes elementos:

### 4.1 Elementos pré-textuais

Elementos mínimos recomendados para o DOCX:

- capa ou identificação inicial;
- folha de rosto ou bloco de identificação, se compatível com o modelo institucional;
- sumário, quando suportado pelo gerador;
- dados básicos:
  - instituição;
  - unidade/programa/curso, quando aplicável;
  - autor;
  - título;
  - subtítulo, se houver;
  - local;
  - ano;
  - orientador, quando aplicável.

### 4.2 Elementos textuais

Seções recomendadas para o corpo do projeto:

- Introdução;
- Tema;
- Delimitação do tema, quando aplicável;
- Problema de pesquisa;
- Hipótese ou hipóteses, quando aplicável;
- Objetivo geral;
- Objetivos específicos;
- Justificativa;
- Referencial teórico;
- Metodologia;
- Cronograma;
- Recursos ou orçamento, quando aplicável;
- Resultados esperados, quando aplicável.

### 4.3 Elementos pós-textuais

Elementos pós-textuais mínimos:

- Referências;
- Apêndices, quando houver;
- Anexos, quando houver.

## 5. Campos recomendados no modelo de dados

A implementação pode reaproveitar campos existentes sempre que possível.

Campos específicos recomendados:

- `tema`;
- `delimitacaoTema`;
- `problemaPesquisa`;
- `hipotese`;
- `objetivoGeral`;
- `objetivosEspecificos`;
- `justificativa`;
- `referencialTeorico`;
- `metodologia`;
- `cronograma`;
- `recursosOrcamento`;
- `resultadosEsperados`;
- `referencias`.

Se a estrutura atual ainda não suportar novos campos sem grande refatoração, usar o editor textual e detectar seções por cabeçalhos.

## 6. Cabeçalhos que o importador deve reconhecer

O importador TXT/MD pode reconhecer, de forma simples e conservadora, os seguintes títulos:

- TEMA;
- DELIMITAÇÃO DO TEMA;
- PROBLEMA DE PESQUISA;
- HIPÓTESE;
- HIPÓTESES;
- OBJETIVO GERAL;
- OBJETIVOS ESPECÍFICOS;
- JUSTIFICATIVA;
- REFERENCIAL TEÓRICO;
- FUNDAMENTAÇÃO TEÓRICA;
- METODOLOGIA;
- PROCEDIMENTOS METODOLÓGICOS;
- CRONOGRAMA;
- RECURSOS;
- ORÇAMENTO;
- RESULTADOS ESPERADOS;
- REFERÊNCIAS;
- APÊNDICE;
- APÊNDICES;
- ANEXO;
- ANEXOS.

A detecção deve ser conservadora: se o sistema não tiver confiança, deve preservar o texto no corpo e não fingir extração completa.

## 7. Validações mínimas recomendadas

Para `Projeto de pesquisa`, validar pelo menos:

### 7.1 Validações bloqueantes

- título ausente;
- autor ausente;
- tipo de trabalho ausente;
- problema de pesquisa ausente;
- objetivo geral ausente;
- justificativa ausente;
- metodologia ausente;
- cronograma ausente;
- referências ausentes.

### 7.2 Alertas não bloqueantes

- hipótese ausente, quando o tipo de pesquisa sugerir necessidade;
- objetivos específicos ausentes;
- referencial teórico ausente;
- recursos/orçamento ausentes;
- resultados esperados ausentes;
- cronograma sem organização temporal clara;
- referências muito curtas ou sem aparência bibliográfica.

### 7.3 Mensagens de validação

As mensagens devem seguir o padrão já adotado no projeto:

- `severity`;
- `code`;
- `message`;
- `what`;
- `why`;
- `action`.

Exemplo conceitual:

```ts
{
  severity: "error",
  code: "research-problem-required",
  message: "Informe o problema de pesquisa.",
  what: "O projeto de pesquisa não apresenta o problema a ser investigado.",
  why: "O problema delimita a investigação e orienta objetivos, metodologia e justificativa.",
  action: "Adicione uma seção chamada 'Problema de pesquisa' ou preencha o campo correspondente."
}
```

## 8. Exportação DOCX recomendada

Criar exportador próprio, se possível:

```txt
src/export-research-project-docx.ts
```

O exportador deve gerar documento editável com:

- identificação inicial;
- título;
- autor;
- orientador, quando houver;
- local e ano;
- sumário, se suportado;
- seções textuais;
- referências;
- apêndices/anexos, quando houver.

O exportador deve seguir o padrão já usado pelo projeto para:

- tamanho A4;
- margens compatíveis com trabalhos acadêmicos;
- fonte e espaçamentos já adotados;
- títulos hierarquizados;
- citações e referências quando aplicável.

## 9. Integração com o App

No fluxo de geração:

- adicionar opção visual **Projeto de pesquisa**;
- selecionar exportador específico quando esse tipo estiver ativo;
- manter lazy loading do exportador;
- preservar `isGenerating`;
- preservar tratamento de erros;
- preservar aviso pós-geração DOCX.

Exemplo conceitual:

```ts
if (fields.workType === "projeto_pesquisa") {
  const { generateResearchProjectDocxBlob } = await import("./export-research-project-docx");
  blob = await generateResearchProjectDocxBlob(fields, editorText);
}
```

## 10. Painel de aderência normativa

O painel de aderência deve registrar que:

- projeto de pesquisa possui suporte inicial;
- validação NBR 15287 é parcial;
- a revisão final pelo usuário é obrigatória;
- o sistema não substitui a norma oficial.

Status recomendado:

```txt
Projeto de pesquisa / NBR 15287: Parcial
```

Mensagem sugerida:

> O sistema possui suporte inicial para projeto de pesquisa conforme ABNT NBR 15287:2025, com estrutura e validações básicas. A revisão final pelo usuário é obrigatória.

## 11. Testes mínimos recomendados

Criar testes para:

### 11.1 Tipo de trabalho

- verificar que `Projeto de pesquisa` existe na lista de tipos;
- verificar que não quebra artigo, monografia, dissertação, tese e CPG.

### 11.2 Validação

- projeto incompleto deve gerar erros coerentes;
- projeto mínimo deve passar sem erros bloqueantes inesperados;
- mensagens devem conter `what`, `why` e `action`.

### 11.3 Exportação

- gerar DOCX de projeto de pesquisa;
- confirmar `Blob` válido;
- confirmar tamanho maior que zero;
- confirmar MIME compatível com DOCX.

### 11.4 Importação TXT/MD

- detectar seções principais de projeto de pesquisa;
- preservar acentuação;
- preservar referências;
- não fingir extração completa quando seções estiverem ausentes.

## 12. Limites assumidos nesta implementação

Esta implementação inicial **não deve prometer**:

- validação completa da NBR 15287;
- conferência automática de todos os elementos normativos;
- conformidade institucional final;
- substituição da revisão humana;
- substituição da norma oficial.

## 13. Observações para manutenção

Sempre que a norma oficial, o Manual UFLA ou modelos institucionais forem atualizados, revisar:

- validações;
- campos;
- exportador DOCX;
- mensagens do painel de aderência;
- testes de regressão.

## 14. Nome sugerido para este arquivo

Salvar este documento na raiz do projeto como:

```txt
NBR15287_PROJETO_PESQUISA.md
```
