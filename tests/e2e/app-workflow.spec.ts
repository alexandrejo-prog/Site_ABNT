import { expect, test } from "@playwright/test";

/**
 * E2E (governance-roadmap): fluxo real do app no navegador.
 *
 * 1. Abre o app (build de produção via vite preview).
 * 2. Seleciona o formato "Artigo científico UFLA" (Coleção Produção Acadêmica).
 * 3. Preenche os requiredFields próprios do formato (author, title, resumo,
 *    referencias, palavrasChave, introducao).
 * 4. Gera o DOCX editável e verifica o download.
 * 5. Abre a pré-visualização e verifica conteúdo + acessibilidade básica.
 */
test("fluxo completo: artigo da Coleção → DOCX → preview", async ({ page }) => {
  await page.goto("/");

  // 1) Selecionar o tipo de trabalho
  const workType = page.locator("#work-type");
  await workType.selectOption("artigo_cientifico_ufla");

  // 2) Preencher campos obrigatórios do formato (ids = chaves dos metadados)
  const campos: Array<[string, string]> = [
    ["author", "Maria Silva"],
    ["title", "Impacto da irrigação na cafeicultura do Sul de Minas"],
    ["resumo", "Este resumo descreve a metodologia e os resultados principais."],
    ["referencias", "SILVA, M. Irrigação na cafeicultura. Lavras: Editora UFLA, 2024."],
    ["palavrasChave", "café; irrigação; manejo"],
    ["introducao", "A cafeicultura é a principal atividade do Sul de Minas."],
  ];
  for (const [key, value] of campos) {
    await page.locator(`#${key}`).fill(value);
  }

  // 3) Conteúdo do corpo (editor Tiptap contentEditable)
  const editor = page.locator('div.editor.rich-editor[aria-label="Editor do texto principal"]');
  await editor.click();
  await page.keyboard.insertText("# Introdução\n\nTexto introdutório do artigo.\n\n# Metodologia\n\nMétodos aplicados.\n\n# Considerações finais\n\nConclusões do estudo.");

  // 4) Gerar DOCX (download)
  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await page.getByRole("button", { name: /Gerar DOCX editável/ }).click();
  const download = await downloadPromise;
  const suggested = download.suggestedFilename();
  expect(suggested.toLowerCase()).toContain(".docx");
  expect(suggested.toLowerCase()).toMatch(/artigo/);

  // 5) Preview — sem erros de console
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.getByRole("button", { name: "Visualizar" }).click();
  await page.locator(".preview-modal, .preview-pane, [class*='preview']").first().waitFor({ state: "visible", timeout: 30_000 });
  await expect(page.locator("body")).toContainText(/Tipo de trabalho|Artigo/i);
  expect(errors.filter((e) => !/favicon|net::ERR/i.test(e))).toEqual([]);
});
