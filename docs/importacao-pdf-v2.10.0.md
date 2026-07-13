# Importação de PDF v2.10.0

Esta versão introduz a primeira exportação textual mínima a partir de PDF. Ela ainda não é uma conversão acadêmica completa e não substitui a revisão humana.

## Como funciona

- A importação do PDF continua entrando como `sourceKind: "pdf"` e `documentMode: "pdf-diagnostic"`.
- O rascunho DOCX textual é gerado por um contrato separado, `pdf-text-draft`, apenas no momento da exportação.
- O conteúdo exportado usa somente `pdfDiagnostic.reconstruction.blocks`.
- O exportador textual não usa `rawText`, `items`, `lines`, `editorText`, campos acadêmicos, tipo de trabalho ou o template acadêmico normal.
- O documento começa no corpo textual detectado, em geral a partir de `1 INTRODUÇÃO`.
- Capa, ficha catalográfica, folha de aprovação, agradecimentos, resumo, abstract, listas pré-textuais e sumário não são inseridos.

## Elementos visuais

Quadros, tabelas, figuras, gráficos e regiões em colunas não são convertidos em imagem nem em tabela Word nesta rodada. Eles aparecem como marcadores de revisão, por exemplo:

`[Elemento visual não inserido neste rascunho textual — Quadro, página original 25. Consulte o PDF original.]`

Legendas e fontes extraídas como blocos próprios são preservadas como texto. O conteúdo interno achatado de regiões visuais não é misturado à prosa.

## Formatação

O rascunho usa formatação básica:

- papel A4;
- margens 3 cm superior/esquerda e 2 cm inferior/direita;
- Times New Roman;
- corpo em 12 pt, justificado, recuo de primeira linha de 1,5 cm e entrelinhas 1,5;
- títulos em 12 pt negrito, sem nível estrutural do Word;
- legendas, fontes, aviso técnico e marcadores em 10 pt;
- espaçamento antes e depois zerado.

O arquivo não cria sumário, campos TOC, imagens, tabelas editáveis, listas multinível ou estilos de título recolhíveis.

## Limitações conhecidas

- A reconstrução depende da qualidade textual e geométrica extraída do PDF.
- Hifenizações incertas são preservadas e precisam de conferência.
- Parágrafos multipágina e blocos de baixa confiança exigem revisão.
- Elementos visuais continuam dependentes do PDF original.
- Imagens e tabelas editáveis serão tratadas apenas em rodada futura.

Use o DOCX gerado como rascunho textual de inspeção, não como versão final para submissão acadêmica.
