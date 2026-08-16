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

/** Slugify espelhando src/download-filename.ts (o e2e não importa o app). */
function slugify(value: string): string {
  return (value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "sem-titulo");
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
  // ---- 7 formatos restantes da Coleção Produção Acadêmica UFLA ----
  // (artigo_cientifico_ufla já é o 1º caso; patente, revisão sistemática,
  // estudo de caso, software, cultivar, relatório de estágio e proposta de
  // intervenção exercitam os requiredFields PRÓPRIOS de cada formato — os
  // campos como objetivoGeral/justificativa/cronograma ficam visíveis no
  // formulário via visibleField + requiredFields.)
  {
    workType: "patente_ufla",
    filenamePrefix: "patente",
    fields: [
      ["author", "Bruno Martins"],
      ["title", "Composição de substrato para cultivo de café em vasos"],
      ["resumo", "Resumo da patente sobre composição de substrato."],
      ["palavrasChave", "substrato; café; patente"],
      ["referencias", "MARTINS, B. Substratos para cafeicultura. Lavras: UFLA, 2024."],
      ["introducao", "O campo da invenção refere-se a substratos para cafeicultura."],
      ["referencialTeorico", "Estado da técnica em substratos e drenagem."],
    ],
    editorText: "# 1 Introdução\n\nCorpo da patente.\n\n# 2 Reivindicações\n\nReivindicação principal do invento.",
    previewContains: ["Resumo da patente"],
  },
  {
    workType: "revisao_sistematica_ufla",
    filenamePrefix: "",
    fields: [
      ["author", "Carla Nogueira"],
      ["title", "Revisão sistemática sobre irrigação na cafeicultura"],
      ["resumo", "Resumo da revisão sistemática sobre irrigação."],
      ["palavrasChave", "irrigação; revisão; café"],
      ["referencias", "NOGUEIRA, C. Irrigação do cafeeiro. Lavras: UFLA, 2024."],
      ["objetivoGeral", "Sintetizar a literatura sobre irrigação do cafeeiro."],
      ["metodologia", "Busca sistemática nas bases Scopus e Web of Science."],
    ],
    editorText: "# 1 Introdução\n\nCorpo da revisão sistemática.\n\n# 2 Metodologia\n\nEstratégia de busca e critérios de elegibilidade.",
    previewContains: ["Resumo da revisão sistemática"],
  },
  {
    workType: "estudo_caso_ufla",
    filenamePrefix: "estudo-de-caso-ou-casos-multiplos",
    fields: [
      ["author", "Débora Almeida"],
      ["title", "Estudo de caso da cooperativa cafeeira do sul de Minas"],
      ["resumo", "Resumo do estudo de caso da cooperativa."],
      ["palavrasChave", "cooperativa; café; estudo de caso"],
      ["referencias", "ALMEIDA, D. Cooperativismo cafeeiro. Lavras: UFLA, 2023."],
      ["introducao", "Contexto do caso da cooperativa cafeeira."],
      ["metodologia", "Coleta de dados por entrevistas e análise documental."],
    ],
    editorText: "# 1 Introdução\n\nCorpo do estudo de caso.\n\n# 2 Análise\n\nEvidências coletadas na cooperativa.",
    previewContains: ["Resumo do estudo de caso"],
  },
  {
    workType: "software_aplicativo_ufla",
    filenamePrefix: "desenvolvimento-de-software-e-aplicativos",
    fields: [
      ["author", "Eduardo Rocha"],
      ["title", "Aplicativo de apoio à decisão na cafeicultura irrigada"],
      ["resumo", "Resumo do aplicativo de apoio à decisão."],
      ["palavrasChave", "software; irrigação; café"],
      ["referencias", "ROCHA, E. Sistemas de apoio à decisão. Lavras: UFLA, 2024."],
      ["objetivoGeral", "Desenvolver um aplicativo de apoio à decisão."],
      ["metodologia", "Desenvolvimento ágil com testes em campo."],
    ],
    editorText: "# 1 Introdução\n\nCorpo do desenvolvimento do software.\n\n# 2 Arquitetura\n\nArquitetura e tecnologias utilizadas.",
    previewContains: ["Resumo do aplicativo"],
  },
  {
    workType: "cultivar_ufla",
    filenamePrefix: "cultivar",
    fields: [
      ["author", "Fernanda Lima"],
      ["title", "Caracterização agronômica de nova cultivar de cafeeiro"],
      ["resumo", "Resumo da caracterização da nova cultivar."],
      ["palavrasChave", "cultivar; café; melhoramento"],
      ["referencias", "LIMA, F. Melhoramento do cafeeiro. Lavras: UFLA, 2022."],
      ["metodologia", "Ensaios de campo em delineamento em blocos casualizados."],
    ],
    editorText: "# 1 Introdução\n\nCorpo da caracterização da cultivar.\n\n# 2 Desempenho agronômico\n\nResultados dos ensaios de campo.",
    previewContains: ["Resumo da caracterização"],
  },
  {
    workType: "relatorio_estagio_ufla",
    filenamePrefix: "relatorio-de-estagio",
    fields: [
      ["author", "Gabriel Souza"],
      ["title", "Relatório de estágio na Fazenda Experimental da UFLA"],
      ["resumo", "Resumo das atividades do estágio."],
      ["course", "Bacharelado em Agronomia"],
      ["introducao", "Introdução do relatório de estágio."],
      ["metodologia", "Atividades desenvolvidas durante o estágio."],
      ["conclusao", "Considerações finais sobre o estágio."],
    ],
    editorText: "# 1 Introdução\n\nCorpo do relatório de estágio.",
    previewContains: ["Resumo das atividades"],
  },
  {
    workType: "proposta_intervencao_ufla",
    filenamePrefix: "",
    fields: [
      ["author", "Helena Costa"],
      ["title", "Proposta de intervenção no manejo da ferrugem do cafeeiro"],
      ["resumo", "Resumo da proposta de intervenção no manejo da ferrugem."],
      ["palavrasChave", "intervenção; ferrugem; café"],
      ["referencias", "COSTA, H. Manejo integrado de doenças do cafeeiro. Lavras: UFLA, 2024."],
      ["justificativa", "A ferrugem reduz a produtividade e exige manejo planejado."],
      ["objetivoGeral", "Planejar uma intervenção no manejo da ferrugem."],
      ["metodologia", "Diagnóstico situacional e plano de execução."],
      ["cronograma", "Quadro 1 - Cronograma\n1o semestre: diagnóstico.\nFonte: elaborado pela autora (2026)."],
    ],
    editorText: "# 1 Introdução\n\nCorpo da proposta de intervenção.",
    previewContains: ["Resumo da proposta de intervenção"],
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
    if (typeCase.filenamePrefix) {
      expect(suggested).toContain(typeCase.filenamePrefix);
    } else {
      // formatos da Coleção: o nome deriva do slug do título (robusto à
      // duplicação do mapa de rótulos do app)
      const title = typeCase.fields.find(([key]) => key === "title")?.[1] ?? "";
      expect(suggested).toContain(slugify(title));
    }

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
