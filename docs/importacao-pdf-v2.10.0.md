# v2.10.0 — Importação assistida por PDF

## Objetivo

Preparar o Site_ABNT para aceitar arquivos PDF como fonte de entrada, além de DOCX, deixando o site decidir automaticamente o melhor tratamento dos dados importados.

A regra central da v2.10.0 é:

```text
O usuário envia DOCX ou PDF.
O site identifica a estrutura real do arquivo.
O site extrai, normaliza e decide o melhor tratamento por bloco.
O usuário recebe o DOCX final e os diagnósticos de revisão.
```

O usuário não deve escolher manualmente o pipeline de importação.

## Escopo inicial

### Incluído

- Adicionar `pdfjs-dist` como dependência.
- Criar módulo de leitura PDF no navegador.
- Extrair texto com posição por página.
- Renderizar página/região de PDF em imagem quando necessário.
- Criar modelo interno para blocos PDF:
  - página;
  - texto;
  - posição;
  - provável legenda;
  - provável fonte;
  - provável quadro/tabela;
  - provável gráfico/imagem.
- Integrar PDF ao diagnóstico de importação.
- Permitir que o site decida, por bloco:
  - texto editável;
  - tabela reconstruída;
  - texto estruturado;
  - recorte visual como imagem;
  - revisão manual.

### Não incluído nesta etapa inicial

- Prometer extração perfeita de tabela PDF.
- Usar backend Python/Java.
- Usar OCR pesado.
- Substituir o pipeline DOCX já existente.
- Declarar a importação de PDF como 100% finalizada.

## Estratégia técnica

### DOCX

O pipeline DOCX continua usando a estrutura OOXML existente:

- texto e campos acadêmicos;
- pré-textuais;
- corpo;
- referências;
- imagens ancoradas confiáveis;
- tabelas editáveis ou reconstruídas semanticamente.

### PDF

O pipeline PDF deve começar com `pdfjs-dist`:

- carregar PDF no navegador;
- ler páginas;
- extrair textContent com coordenadas;
- renderizar páginas em canvas;
- permitir recorte visual de regiões;
- gerar blocos internos para posterior normalização.

### Decisão automática

O site deve avaliar a confiança de cada bloco:

- alta confiança: importar como texto/tabela/imagem;
- média confiança: importar com aviso revisável;
- baixa confiança: usar texto estruturado, recorte visual ou revisão manual.

## Resultado esperado da primeira rodada

Ao final da primeira implementação da v2.10.0, o projeto deve ter:

- dependência `pdfjs-dist` instalada;
- módulo `src/import-pdf.ts` ou equivalente;
- testes básicos de detecção de PDF;
- testes básicos de extração de texto por página;
- testes de diagnóstico de baixa confiança;
- documentação atualizada;
- build e testes passando.

## Relação com a v2.9.1

A v2.9.1 melhorou a importação de DOCX convertido de PDF, mas manteve limitações documentadas para tabelas, quadros e imagens quando a estrutura da conversão não é confiável.

A v2.10.0 deve complementar essa base, permitindo que o site trate PDF diretamente quando ele for a fonte enviada pelo usuário.

## Critério de qualidade

A v2.10.0 deve ser tratada como evolução incremental. Não declarar 100% de importação PDF. O foco inicial é criar uma base testável e segura para leitura visual/textual de PDF.
