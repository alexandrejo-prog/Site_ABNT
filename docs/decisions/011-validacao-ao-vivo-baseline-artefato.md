# DECISION-011: Validação ao vivo do validador × artefato de auditoria (65/75 não é regressão do gerador)

## Contexto

O validador `skills/ufla-docx-compliance` é usado de duas formas:

1. **Validação de DOCX gerado pelo usuário** (CLI `npm run skill:validate -- <docx> --type=...`) — é o caso de uso primário;
2. **Validação do DOCX de auditoria** (`artifacts/ufla-compliance/normalized-dissertacao.docx` — o baseline importado do documento real da UFLA) — feito informalmente durante a etapa 6j para comprovar o checker.

Na validação ao vivo do artefato de auditoria o resultado foi **65/75 itens OK**. As 10 falhas restantes são características do **baseline de auditoria**, não bugs do gerador.

## Problema

Sem registro formal, qualquer pessoa que rodar `skill:validate` sobre o `normalized-dissertacao.docx` verá os 10 itens falhando e poderá interpretá-los como **regressão do gerador** (falso positivo), quando na verdade são **limitações do próprio artefato de auditoria**, que:

- não possui orientador nem curso preenchidos (folha de rosto/ficha com campos em branco);
- não tem as referências em ordem alfabética (formato do documento de origem);
- não possui imagem de logo (a capa do baseline usa a logo; o bloco da capa do artefato não carrega o parâmetro de imagem — `logoDimension`/`wp:extent` ausentes no bloco reconhecido).

Esses itens **não são obrigatórios no fluxo de geração**, pois:

- orientador/curso são campos opcionais da UI (preenchidos conforme o usuário);
- referências ordenadas dependem do conteúdo digitado;
- a logo é incluída pelo template UFLA na geração real (os itens 3.11–3.14 dependem de `wp:extent`).

## Decisão

1. **Registrar este documento como a fonte normativa** para interpretar a validação ao vivo do artefato de auditoria: qualquer checagem acima de 65/75 contra `normalized-dissertacao.docx` é esperada e **não configura regressão**.
2. **Não "corrigir" o baseline** para forçar 75/75: o artefato deve permanecer fiel ao documento real de origem (foi importado tal como a UFLA publicou). Alterá-lo só para passar no validador contaminaria a evidência de round-trip/preservação.
3. **O gate canônico** continua sendo `npm run ufla:audit` (11/11 gates via Word COM + PDF físico + análise OOXML), que **não** usa `skill:validate` e não sofre desses 10 itens.
4. O caso de uso primário do validador (DOCX gerado pelo app) exige os campos; para ele, o checker é a fonte da verdade.

## Impacto

- Nenhum código muda.
- `docs/STATUS_ATUAL.md` ganha menção curta apontando para esta decisão.