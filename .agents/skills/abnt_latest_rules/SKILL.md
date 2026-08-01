---
name: abnt_latest_rules
description: Aplica as normas ABNT mais recentes quando o Manual da UFLA não as especificar.
---

# Skill: abnt_latest_rules

# Skill — abnt_latest_rules

Esta habilidade contém as regras normativas das **Normas ABNT mais recentes** que complementam o **Manual de Normalização da UFLA (6ª ed., 2025)**. Ela é utilizada automaticamente pelo projeto Site_ABNT sempre que o manual da UFLA não definir uma regra ou quando houver omissão intencional, garantindo conformidade com as normas ABNT vigentes.

## 1. Precedência Normativa
1. **Manual da UFLA 6ª edição** – primeira fonte de regras específicas para a UFLA.  
2. **Template oficial de Word da UFLA** – define aspectos de apresentação visual (margens, posicionamento de logotipo, etc.).  
3. **Normas ABNT vigentes** – entram em vigor somente quando o manual da UFLA for omisso ou quando a própria norma da UFLA encaminhar a outra norma (ex.: “conforme ABNT”).  

As normas ABNTPrioritárias são:
- **NBR 14724:2024** – apresentação de trabalhos acadêmicos.  
- **NBR 6023:2020** – referências bibliográficas.  
- **NBR 10520:2023** – citações.  
- **NBR 6028:2021** – resumos.  
- **NBR 6027:2012** – sumário.  
- **NBR 6024:2012** – numeração progressiva.  

## 2. Mapeamento de Regras ABNT ao Gerador DOCX
| Tema ABNT | Implementação no Site_ABNT | Arquivo/ Função responsável |
|-----------|---------------------------|-----------------------------|
| Margens (NBR 14724:2024, Seção 5.1) | Margens configuradas em 3 cm (top/left) e 2 cm (bottom/right) via `ufla-rules.ts` | `src/ufla-rules.ts` |
| Fonte e tamanho (NBR 14724:2024) | Times New Roman, 12 pt (texto), 11 pt (citações longas, notas) | `src/export-docx.ts` (buildPageMargins) |
| Espaçamento simples em citações longas (NBR 10520:2023) | Citação longa → recuo de 4 cm, fonte 11 pt, sem aspas | `src/docx-render-core.ts` |
| Referências com “et al.” em itálico (NBR 6023:2020) | Quando houver 4+ autores, o sobrenome do primeiro + “et al.” em itálico | `src/export-docx.ts` (buildReferenceSection) |
| Título em inglês na folha de aprovação (NBR 14724:2024, item 6.2) | Campo de título recebe versão `titleEn` quando `settings.englishTitle` está preenchido | `src/export-docx.ts` (buildApprovalPage) |
| Data de aprovação na folha de aprovação (NBR 14724:2024) | Campo “Ano de aprovação” preenchido a partir de `fields.approvalDate` | `src/export-docx.ts` (buildApprovalPageSupplemental) |
| Membros da banca com instituições (NBR 14724:2024) | Cada membro recebe `institution` ao lado do nome | `src/export-docx.ts` (buildApprovalPage) |
| Escala de imagens para caber nas margens (NBR 14724:2024, Seção 5.8) | Imagens > 10 cm são redimensionadas automaticamente para ≤ 16 cm de largura | `src/export-docx.ts` (processImage) |
| Numereração progressiva (NBR 6024:2012) | Campo `pageNumber` inserido a partir da introdução, estilo arábico, 10 pt | `src/export-docx.ts` (addPageNumbers) |
| Formatação de tabelas e quadros (NBR 14724:2024) | Tabelas: borda simples interna; Quadros: borda dupla superior/inferior (pendente) | `src/export-docx.ts` (buildTable) |

## 3. Uso da Skill `abnt_latest_rules`
- **Automática:** Sempre que o pipeline de normalização detectar umItem do checklist marcado como `[ ]` **sem** regra explícita no `ufla-rules.ts`, a skill `abnt_latest_rules` é invocada para aplicar a norma ABNT correspondiente.  
- **Integração:** As regras são importadas via `import { ABNT_LATEST_RULES } from "./abnt_latest_rules/rules"` onde `rules.ts` exporta um objeto `{ [key]: implementationFn }`.  
- **Customização:** Caso deseje sobrescrever uma regra ABNT, basta criar/modificar um arquivo `custom-abnt-rules.ts` na raiz do projeto e importá‑lo antes da skill ser executada.

## 4. Exemplos de Implementação
### 4.1. Título em Inglês na Folha de Aprovação
```ts
// src/export-docx.ts (fragmento)
if (fields.titleEn && fields.workType === "tese") {
  supplementalLines.push(
    cleanMojibakeText(`Title (English): ${fields.titleEn}`)
  );
}
```

### 4.2. Data de Aprovação
```ts
// src/export-docx.ts (fragmento)
if (fields.approvalDate) {
  supplementalLines.push(
    cleanMojibakeText(`Ano de aprovação: ${fields.approvalDate}`)
  );
}
```

### 4.3. Escala Automática de Imagens
```ts
// src/export-docx.ts (fragmento)
if (imageWidth > 10) {
  const newWidth = Math.min(imageWidth, 16);
  imageInfo.widthTwip = cmToTwip(newWidth);
}
```

## 5. Referências Normativas Utilizadas
- **NBR 14724:2024** – Apresentação de trabalhos acadêmicos.  
- **NBR 6023:2020** – Referências.  
- **NBR 10520:2023** – Citações.  
- **NBR 6028:2021** – Resumos.  
- **NBR 6027:2012** – Sumário.  
- **NBR 6024:2012** – Numeração progressiva.  

## 6. Atualizações Periódicas
Esta skill deve ser revisada a cada atualização das normas ABNT (aprox. a cada 2‑3 anos) para garantir que **todas** as referências estejam ainda vigentes.

Base directory for this skill: C:\Users\User\Desktop\Alexandre\Site_Normas_UFLA\Site_ABNT\.agents\skills\abnt_latest_rules
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.
Note: file list is sampled.

<skill_files>

</skill_files>