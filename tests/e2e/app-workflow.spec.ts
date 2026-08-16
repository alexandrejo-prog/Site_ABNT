import { expect, test } from "@playwright/test";

/**
 * E2E (governance-roadmap): fluxo real do app no navegador, parametrizado
 * pelos tipos de trabalho que o sistema exporta — os 6 templates do diff
 * preview↔DOCX mais o artigo da Coleção:
 *
 *   1. Artigo científico UFLA (Coleção Produção Acadêmica)
 *   2. Monografia (com ficha catalográfica)
 *   3. Dissertação (rascunho editável — programa PPG + orientador)
 *   4. Tese (rascunho editável — programa PPG + orientador)
 *   5. Resumo expandido CPG
 *   6. Projeto de pesquisa (campos próprios: problema, objetivo, cronograma)
 *
 * Para cada tipo: seleciona no UI, preenche os requiredFields próprios,
 * escreve o corpo no editor, gera o DOCX (download verificado pelo nome) e
 * abre a pré-visualização sem erros de console.
 */
interface TypeCase {
  workType: string;
  filenamePrefix: string;
  fields: Array<[string, string]>;
  editorText: string;
  previewContains?: string[];
}

/** Preenche um campo, abrindo o <details> da seção quando ele está recolhido. */
async function fillField(page: import("@playwright/test").Page, key: string, value: string): Promise<void> {
  const field = page.locator(`#${key}`);
  if (!(await field.isVisible().catch(() => false))) {
    // procura o <details> ancestral do campo e o abre quando recolhido
    const details = page.locator("details.field-section").filter({ has: page.locator(`#${key}`) });
    const count = await details.count();
    if (count > 0) {
      const open = await details.first().getAttribute("open");
      if (open === null) await details.first().locator("summary").first().click();
    }
  }
  await field.waitFor({ state: "visible", timeout: 10_000 });
  await field.fill(value);
}

const TYPES: TypeCase[] = [
  {
    workType: "artigo_cientifico_ufla",
    filenamePrefix: "artigo-cientifico",
    fields: [
      ["author", "Maria Silva"],
      ["title", "Impacto da irrigação na cafeicultura do Sul de Minas"],
      ["resumo", "Este resumo descreve a metodologia e os resultados principais."],
      ["referencias", "SILVA, M. Irrigação na cafeicultura. Lavras: Editora UFLA, 2024."],
      ["palavrasChave", "café; irrigação; manejo"],
      ["introducao", "A cafeicultura é a principal atividade do Sul de Minas."],
    ],
    editorText: "# Introdução\n\nTexto introdutório do artigo.\n\n# Metodologia\n\nMétodos aplicados.\n\n# Considerações finais\n\nConclusões do estudo.",
    previewContains: ["Resumo", "café; irrigação; manejo"],
  },
  {
    workType: "monografia",
    filenamePrefix: "monografia",
    fields: [
      ["author", "João Pereira"],
      ["title", "Qualidade do café no sul de Minas Gerais"],
      ["resumo", "Resumo da monografia sobre a qualidade do café."],
      ["palavrasChave", "café; qualidade; cerrado"],
      ["referencias", "SILVA, M. Qualidade do café. Lavras: Editora UFLA, 2024."],
      ["course", "Bacharelado em Biologia"],
      ["advisor", "Prof. Dr. Joao Silva"],
      ["introducao", "Texto introdutório da monografia."],
      ["fichaCatalografica", "Ficha catalográfica elaborada pela Biblioteca Universitária da UFLA."],
    ],
    editorText: "# 1 Introdução\n\nCorpo da monografia.\n\n# 2 Desenvolvimento\n\nSegunda seção com conteúdo.",
    previewContains: ["Ficha catalográfica", "Bacharelado em Biologia"],
  },
  {
    workType: "dissertacao",
    filenamePrefix: "dissertacao",
    fields: [
      ["author", "Renata Oliveira"],
      ["title", "Manejo da irrigação na cafeicultura do sul de Minas"],
      ["resumo", "Resumo da dissertação sobre manejo da irrigação."],
      ["palavrasChave", "irrigação; café; manejo"],
      ["referencias", "OLIVEIRA, R. Manejo da irrigação. Lavras: UFLA, 2024."],
      ["program", "Programa de Pós-Graduação em Agronomia/Fitotecnia"],
      ["advisor", "Prof. Dr. Ricardo Alves"],
      ["introducao", "Texto introdutório da dissertação."],
    ],
    editorText: "# 1 Introdução\n\nCorpo da dissertação.\n\n# 2 Revisão de literatura\n\nRevisão sobre manejo da irrigação.",
    previewContains: ["Dissertação", "Prof. Dr. Ricardo Alves"],
  },
  {
    workType: "tese",
    filenamePrefix: "tese",
    fields: [
      ["author", "Paulo Henrique Costa"],
      ["title", "Modelagem climática aplicada à cafeicultura do Cerrado Mineiro"],
      ["resumo", "Resumo da tese sobre modelagem climática."],
      ["palavrasChave", "clima; café; modelagem"],
      ["referencias", "COSTA, P. H. Modelagem climática. Lavras: UFLA, 2025."],
      ["program", "Programa de Pós-Graduação em Agronomia/Fitotecnia"],
      ["advisor", "Prof. Dr. Marina Ferreira"],
      ["introducao", "Texto introdutório da tese."],
    ],
    editorText: "# 1 Introdução\n\nCorpo da tese.\n\n# 2 Material e métodos\n\nMétodos da modelagem climática.",
    previewContains: ["Tese", "Prof. Dr. Marina Ferreira"],
  },
  {
    workType: "resumo_expandido_cpg",
    filenamePrefix: "resumo-expandido-cpg",
    fields: [
      ["author", "Ana Souza"],
      ["title", "Efeito do sombreamento no crescimento de mudas"],
      ["resumo", "Resumo expandido apresentado no Congresso de Pós-Graduação."],
      ["palavrasChave", "sombreamento; mudas; crescimento"],
      ["referencias", "SOUZA, A. Sombreamento de mudas. Lavras: UFLA, 2025."],
      ["program", "Programa de Pós-Graduação em Agronomia"],
      ["course", "ana.souza@ufla.br"],
    ],
    editorText: "# Introdução\n\nContexto do resumo expandido.\n\n# Metodologia\n\nMateriais e métodos.\n\n# Resultados\n\nPrincipais resultados obtidos.",
    previewContains: ["Resumo", "ana.souza@ufla.br"],
  },
  {
    workType: "projeto_pesquisa",
    filenamePrefix: "projeto-de-pesquisa",
    fields: [
      ["author", "Carlos Lima"],
      ["title", "Avaliação de sistemas agroflorestais no sul de Minas"],
      ["resumo", "Resumo do projeto de pesquisa."],
      ["palavrasChave", "agrofloresta; sustentabilidade; café"],
      ["referencias", "LIMA, C. Sistemas agroflorestais. Lavras: UFLA, 2025."],
      ["introducao", "Texto introdutório do projeto."],
      ["problemaPesquisa", "Como os sistemas agroflorestais afetam a produtividade?"],
      ["objetivoGeral", "Avaliar a produtividade em sistemas agroflorestais."],
      ["justificativa", "A pesquisa justifica-se pela importância da sustentabilidade."],
      ["metodologia", "Metodologia quantitativa com parcelas experimentais."],
      ["cronograma", "Quadro 1 - Cronograma\n1o semestre: revisão bibliográfica.\nFonte: elaborado pelo autor (2026)."],
    ],
    editorText: "# Introdução\n\nCorpo do projeto de pesquisa.",
    previewContains: ["Projeto", "problema"],
  },
];

for (const typeCase of TYPES) {
  test(`fluxo completo: ${typeCase.workType} → DOCX → preview`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");

    // 1) Selecionar o tipo de trabalho
    await page.locator("#work-type").selectOption(typeCase.workType);

    // 2) Preencher os campos obrigatórios do tipo (ids = chaves dos metadados)
    for (const [key, value] of typeCase.fields) {
      await fillField(page, key, value);
    }

    // 3) Conteúdo do corpo (editor Tiptap contentEditable)
    const editor = page.locator('div.editor.rich-editor[aria-label="Editor do texto principal"]');
    await editor.click();
    await page.keyboard.insertText(typeCase.editorText);

    // 4) Gerar DOCX (download com nome esperado pelo tipo)
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.getByRole("button", { name: /Gerar DOCX editável/ }).click();
    const download = await downloadPromise;
    const suggested = download.suggestedFilename().toLowerCase();
    expect(suggested).toContain(".docx");
    expect(suggested).toContain(typeCase.filenamePrefix);

    // 5) Preview — sem erros de console e com conteúdo esperado
    await page.getByRole("button", { name: "Visualizar" }).click();
    const preview = page.locator(".preview-modal, .preview-pane, [class*='preview']").first();
    await preview.waitFor({ state: "visible", timeout: 30_000 });
    for (const fragment of typeCase.previewContains ?? []) {
      await expect(page.locator("body")).toContainText(fragment, { timeout: 10_000 });
    }
    expect(errors.filter((e) => !/favicon|net::ERR/i.test(e))).toEqual([]);
  });
}
