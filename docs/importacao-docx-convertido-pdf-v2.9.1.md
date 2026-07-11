# Importação de DOCX convertido de PDF - v2.9.1

Este diagnóstico trata documentos DOCX gerados a partir de PDF aprovado. O PDF aprovado deve ser usado como referência estrutural confiável; o DOCX convertido deve ser tratado como fonte ruidosa, sujeita a deslocamentos de títulos, caixas de texto, imagens, quadros, gráficos e elementos pré-textuais.

Conversores PDF para Word podem colocar títulos como RESUMO, ABSTRACT, AGRADECIMENTOS, SUMÁRIO e outros elementos em `header*.xml`, `footer*.xml`, caixas de texto, shapes ou objetos ancorados. Nesses casos, o corpo textual pode conter o texto acadêmico real sem que o título exista como parágrafo normal.

Por isso, a importação deve usar delimitadores textuais confiáveis quando eles existirem, especialmente `Palavras-chave:` e `Keywords:`. A presença desses delimitadores deve orientar candidatos a resumo e abstract, com baixa confiança quando a estrutura indicar conversão de PDF.

Quando o documento importado contém ‘Palavras-chave:’, o texto imediatamente anterior, até o limite estrutural anterior mais provável, deve ser candidato a RESUMO, mesmo que o título RESUMO não esteja no corpo textual.

Quando o documento importado contém ‘Keywords:’, o texto imediatamente anterior, após o bloco de resumo/palavras-chave, deve ser candidato a ABSTRACT, mesmo que o título ABSTRACT não esteja no corpo textual.

Campos reais detectados no documento importado devem ser preservados, especialmente natureza do trabalho, orientador, ficha catalográfica, folha de aprovação, indicadores de impacto e listas pré-textuais. A regra de ouro é: nunca inventar campos acadêmicos sensíveis. Quando a importação tiver baixa confiança, o sistema deve avisar o usuário para revisar os campos extraídos antes de gerar o DOCX.

## Etapa 2 — Imagens importadas

Os marcadores técnicos como `[Imagem detectada: rId22]` são diagnósticos internos e não devem entrar no corpo acadêmico, no editorText, nas seções, nas referências ou no DOCX final como parágrafos comuns.

Quando os bytes da imagem estiverem acessíveis em `word/media/*`, a imagem deve ser representada internamente com id estável, relationship id original, arquivo, mime type, bytes, posição aproximada, legenda/fonte próximas e status `preserved`. No editor, essa imagem pode aparecer como um bloco amigável de imagem importada; no DOCX gerado, deve virar uma imagem real.

Quando a imagem for detectada, mas não puder ser preservada, ela deve gerar aviso revisável separado, com status `detected-but-not-preserved`, sem inserir placeholder textual no documento acadêmico. Placeholders herdados de diagnóstico devem ser tratados como `ignored-placeholder`.

## Etapa 3 — Tabelas e quadros importados

Tabelas e quadros extraídos de DOCX, especialmente DOCX convertido de PDF, devem ser preservados como dados estruturados, não como texto solto.

- Tabela preservada deve virar tabela real no DOCX final (`w:tbl`), mantendo linhas e colunas sempre que possível.
- Tabela não preservada deve gerar aviso revisável, não parágrafo acadêmico com lixo textual.
- Conteúdo tabular não deve ser descartado silenciosamente; se a confiança for baixa, o sistema deve avisar o usuário.
- Quadros convertidos como imagem devem seguir o fluxo de imagens (`ImportedDocumentImage`).
- Quadros convertidos como tabela devem seguir o fluxo tabular (`ImportedTable`).
- Legendas próximas (ex.: "Quadro 1 - ...", "Tabela 1 - ...") e fontes ("Fonte: ...") devem ser associadas à tabela quando possível.
- Tabelas em `header/footer` não são trazidas automaticamente para o corpo, salvo evidência clara de conteúdo acadêmico.
- O importador não deve introduzir marcadores técnicos como `[Tabela detectada: ...]` no corpo acadêmico.

Regra de prioridade:
1. não perder dados tabulares;
2. não transformar tabela em lixo textual;
3. preservar linhas e colunas quando possível;
4. manter legenda e fonte próximas;
5. gerar aviso revisável quando uma tabela/quadro não puder ser preservada.
