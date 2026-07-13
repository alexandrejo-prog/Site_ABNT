# Importação de PDF v2.10.0

Esta versão evolui o rascunho textual de PDF para um rascunho acadêmico estruturado. O arquivo gerado continua sendo material de revisão humana obrigatória, não uma versão final para submissão.

## Contrato

- A importação do PDF continua entrando como `sourceKind: "pdf"` e `documentMode: "pdf-diagnostic"`.
- O rascunho DOCX é gerado por contrato separado, `pdf-text-draft`, somente no exportador PDF.
- O diagnóstico preserva `pages`, `items`, `lines`, `reconstruction`, `layoutRegions` e `bodyStart`.
- O diagnóstico agora inclui `pretextual`, com capa, folha de rosto, resumo, abstract, confiança e avisos.
- O fluxo acadêmico normal não usa `fields`, `workType` preservado nem `rawText` integral como fonte automática do PDF.

## Pré-textuais reconstruídos

O importador analisa as linhas anteriores ao início do corpo e tenta detectar:

- capa;
- folha de rosto;
- resumo;
- palavras-chave;
- abstract;
- keywords.

A capa é inferida por posição inicial no documento, linhas centralizadas, presença institucional, autor provável, título provável, local, ano, espaçamentos verticais e ausência de sinais de ficha catalográfica ou aprovação.

A folha de rosto é inferida separadamente, com sinais de natureza do trabalho, programa, instituição, orientador/coorientador, local e ano. Quando um campo não é localizado com segurança, ele fica ausente e o diagnóstico registra aviso.

Resumo e abstract são reconstruídos a partir dos títulos exatos `RESUMO` e `ABSTRACT`. O texto vira um único parágrafo lógico, com palavras-chave/keywords separadas e preservadas como aparecem.

## Logo institucional

O DOCX reutiliza exclusivamente o ativo versionado `public/assets/ufla-logo.jpeg`. A logo é inserida somente na capa, centralizada, com proporção preservada. Nenhuma imagem extraída do PDF é inserida nesta rodada.

## Sumário

O sumário do rascunho PDF é visível no `document.xml` e não usa `HeadingLevel`, `w:outlineLvl`, listas multinível nem numeração automática do Word para títulos.

O mecanismo usado é exclusivo do exportador PDF:

- cada heading textual reconstruído recebe um bookmark único;
- o sumário contém entradas visíveis;
- cada entrada usa campo `PAGEREF` associado ao bookmark;
- há tabulação à direita com líder pontilhado;
- os campos podem ser atualizados no Word com `Ctrl+A` e `F9`.

Se o Word ainda não tiver calculado os números, as entradas textuais permanecem visíveis e o documento inclui aviso discreto para atualizar os campos.

## Paginação

A capa não exibe número. A folha de rosto e os demais pré-textuais ficam antes da seção textual sem numeração arábica visível. A seção do corpo reinicia a numeração em `1`, com número no canto superior direito. O sumário aponta para a paginação do novo DOCX, não para números originais do PDF.

## Elementos visuais

Quadros, tabelas, gráficos, figuras, recortes de página e imagens acadêmicas do PDF continuam fora do DOCX. Esses elementos seguem representados por marcadores de revisão, preservando a correção anterior contra vazamento de conteúdo interno e duplicação de marcadores.

Exemplo de marcador:

`[Elemento visual não inserido neste rascunho textual - Quadro, página original 25. Consulte o PDF original.]`

## Interface

No workspace PDF, a opção `Incluir elementos pré-textuais reconstruídos` vem marcada por padrão. A tela mostra o estado de capa, folha de rosto, resumo e abstract como encontrados, ausentes ou exigindo revisão. Quando há campos essenciais ausentes, o usuário precisa aceitar `Gerar com campos ausentes`.

## Limitações

- A detecção é heurística e depende da qualidade textual e geométrica extraída do PDF.
- PDFs digitalizados, protegidos ou com texto muito fragmentado podem exigir revisão manual maior.
- Não há OCR nesta rodada.
- Não há reconstrução de quadros, tabelas, gráficos, figuras ou recortes das páginas.
- Somente a logo institucional é inserida como imagem.
