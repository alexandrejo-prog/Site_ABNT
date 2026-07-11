# Importação de DOCX convertido de PDF - v2.9.1

Este diagnóstico trata documentos DOCX gerados a partir de PDF aprovado. O PDF aprovado deve ser usado como referência estrutural confiável; o DOCX convertido deve ser tratado como fonte ruidosa, sujeita a deslocamentos de títulos, caixas de texto, imagens, quadros, gráficos e elementos pré-textuais.

Conversores PDF para Word podem colocar títulos como RESUMO, ABSTRACT, AGRADECIMENTOS, SUMÁRIO e outros elementos em `header*.xml`, `footer*.xml`, caixas de texto, shapes ou objetos ancorados. Nesses casos, o corpo textual pode conter o texto acadêmico real sem que o título exista como parágrafo normal.

Por isso, a importação deve usar delimitadores textuais confiáveis quando eles existirem, especialmente `Palavras-chave:` e `Keywords:`. A presença desses delimitadores deve orientar candidatos a resumo e abstract, com baixa confiança quando a estrutura indicar conversão de PDF.

Quando o documento importado contém ‘Palavras-chave:’, o texto imediatamente anterior, até o limite estrutural anterior mais provável, deve ser candidato a RESUMO, mesmo que o título RESUMO não esteja no corpo textual.

Quando o documento importado contém ‘Keywords:’, o texto imediatamente anterior, após o bloco de resumo/palavras-chave, deve ser candidato a ABSTRACT, mesmo que o título ABSTRACT não esteja no corpo textual.

Campos reais detectados no documento importado devem ser preservados, especialmente natureza do trabalho, orientador, ficha catalográfica, folha de aprovação, indicadores de impacto e listas pré-textuais. A regra de ouro é: nunca inventar campos acadêmicos sensíveis. Quando a importação tiver baixa confiança, o sistema deve avisar o usuário para revisar os campos extraídos antes de gerar o DOCX.
