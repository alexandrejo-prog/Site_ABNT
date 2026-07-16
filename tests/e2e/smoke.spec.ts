import { expect, test } from "@playwright/test";

test("o aplicativo abre e renderiza a interface principal sem erros fatais", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Assistente de estrutura/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Importar arquivo existente" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gerar DOCX editável" })).toBeVisible();

  expect(pageErrors, `Erros JavaScript:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleErrors, `Erros de console:\n${consoleErrors.join("\n")}`).toEqual([]);
});
