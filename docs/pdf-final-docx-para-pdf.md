# Estratégia para PDF final: DOCX -> PDF

## Decisão técnica

O DOCX é a saída canônica do sistema. O PDF final deve ser gerado a partir do DOCX por um motor de documento real, não por desenho manual de texto em PDF.

O gerador PDF manual/experimental não deve ser usado como saída normativa final, porque não reproduz a composição tipográfica do Word/LibreOffice: justificação, quebras de linha, hifenização, métricas de fonte e paginação ficam instáveis.

## Caminho local

Para uso local ou baixa concorrência, usar LibreOffice headless com filtro explícito:

```powershell
soffice --headless --convert-to pdf:"writer_pdf_Export" --outdir "PASTA_SAIDA" "ARQUIVO.docx"
```

No backend, esta chamada deve ser protegida por lock para evitar duas conversões simultâneas na mesma instância.

## Caminho para site

Para deploy web, usar Gotenberg como serviço de conversão:

```powershell
docker compose -f docker-compose.gotenberg.yml up -d
```

Configurar o backend para usar Gotenberg:

```powershell
$env:PDF_CONVERTER="gotenberg"
$env:GOTENBERG_URL="http://localhost:3000"
```

## Variáveis de ambiente

| Variável | Uso | Valor padrão |
|---|---|---|
| `PDF_CONVERTER` | `local` ou `gotenberg` | `local` |
| `SOFFICE_PATH` | Caminho do `soffice` no modo local | `soffice` |
| `GOTENBERG_URL` | URL do serviço Gotenberg | `http://localhost:3000` |
| `PDF_OUTPUT_DIR` | Diretório temporário de saída | temp do sistema |
| `PDF_CONVERSION_TIMEOUT` | Tempo máximo por conversão, em segundos | `90` |

## Checklist de validação

Antes de considerar a conversão resolvida, conferir:

1. Justificação dos parágrafos.
2. Contagem de páginas.
3. Título sem corte.
4. Abstract e Resumo com recuo lateral conforme template CPG.
5. Introdução iniciando após os elementos iniciais do modelo CPG.
6. Ausência de capa, folha de rosto, ficha catalográfica, sumário, cabeçalho, rodapé e número de página nos modelos CPG.
7. Referências sem quebras visuais estranhas.
8. Fonte renderizada no PDF final como Times New Roman ou substituta validada.

## Observação sobre fontes

Em Linux, Times New Roman pode não estar instalada. Se a fonte for substituída, a paginação pode mudar. Em produção, instalar fontes compatíveis ou validar formalmente a substituição usada pelo container de conversão.
