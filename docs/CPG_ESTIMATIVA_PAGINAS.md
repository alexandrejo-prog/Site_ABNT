# Estimativa de páginas — modelos CPG/UFLA

Este documento registra como o sistema calcula os alertas de estimativa de páginas nos modelos do Congresso de Pós-Graduação da UFLA (CPG/UFLA).

## Escopo

A estimativa vale apenas para os modelos:

- `resumo_cpg`
- `resumo_expandido_cpg`
- `artigo_completo_cpg`

Ela é usada somente para **alerta ao usuário**. Não bloqueia a geração do DOCX e não substitui a conferência visual no Word ou LibreOffice.

## Regra implementada

O validador monta uma aproximação com os principais campos textuais:

- título;
- autor;
- abstract;
- keywords;
- resumo;
- palavras-chave;
- corpo do editor;
- referências.

Depois calcula:

```ts
Math.max(1, Math.ceil(text.length / 3200))
```

Ou seja: cada bloco aproximado de **3.200 caracteres** é tratado como uma página estimada.

## Alertas por tipo de CPG

| Tipo | Faixa esperada | Alerta emitido |
|---|---:|---|
| `resumo_cpg` | 1 página | alerta se a estimativa passar de 1 página |
| `resumo_expandido_cpg` | 4 a 6 páginas | alerta se a estimativa ficar abaixo de 4 ou acima de 6 páginas |
| `artigo_completo_cpg` | 8 a 14 páginas | alerta se a estimativa ficar abaixo de 8 ou acima de 14 páginas |

## Limitações conhecidas

A estimativa não mede paginação real. Ela não considera com precisão:

- quebras manuais de página;
- tamanho real de imagens;
- tabelas extensas;
- variações de fonte renderizadas pelo Word/LibreOffice;
- ajustes manuais de margens, espaçamento, legendas e referências;
- atualização de campos automáticos.

Por isso, o sistema sempre deve tratar esses avisos como **alertas de revisão**, não como validação final.

## Conferência final recomendada

Para submissão final:

1. Gere o DOCX pelo sistema.
2. Abra o arquivo no Word ou LibreOffice.
3. Atualize campos automáticos, quando existirem.
4. Confira visualmente a quantidade real de páginas.
5. Ajuste conteúdo, imagens, tabelas e referências.
6. Exporte o PDF pelo Word ou LibreOffice.

## Regra operacional

Não transformar a estimativa em bloqueio automático de geração. O usuário pode gerar o DOCX como rascunho técnico mesmo quando houver alerta de páginas, desde que revise o arquivo final externamente.
