// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import App from "../../src/App";
import { runA11yAudit } from ".././a11y-test-utils";

const DRAFT_KEY = "site-abnt:draft:v3";

function seedDraft() {
  window.localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      fields: { author: "Autor de teste", title: "Título de teste" },
      editorText: "Texto de exemplo para auditoria.",
      references: [],
      workType: "monografia",
      updatedAt: new Date().toISOString(),
    }),
  );
}

function summarizeViolations(results: Awaited<ReturnType<typeof runA11yAudit>>) {
  return results.violations
    .map((violation) => {
      const nodes = violation.nodes.map((node) => node.html).join("\n");
      return `${violation.id} (${violation.impact}): ${violation.help}\n${nodes}`;
    })
    .join("\n\n");
}

describe("auditoria axe do App principal", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("tela inicial sem violacoes critical/serious", async () => {
    const { container } = render(createElement(App));

    const results = await runA11yAudit(container);
    const blocking = results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );

    if (blocking.length) {
      // Não mascarar violações reais: expõe detalhes para correção.
      console.error(`Violações críticas/sérias encontradas pelo axe:\n${summarizeViolations(results)}`);
    }

    expect(blocking).toEqual([]);
  });

  it("expoe landmarks acessiveis (main, main-content, banner e complementary)", () => {
    render(createElement(App));

    const main = document.querySelector("main#main-content");
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute("tabindex", "-1");

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Validação" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Campos acadêmicos" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Editor do texto" })).toBeInTheDocument();
  });

  it("botoes principais possuem nome acessivel", () => {
    seedDraft();
    render(createElement(App));

    for (const name of ["Limpar rascunho", "Validar trabalho", "Gerar DOCX editável"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("campos principais possuem label acessivel", () => {
    render(createElement(App));

    for (const name of ["Autor", "Título", "Curso", "Orientador", "Resumo", "Palavras-chave"]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
  });

  it("editor de texto possui nome acessivel via aria", () => {
    render(createElement(App));

    const editor = screen.getByRole("textbox", { name: "Editor do texto principal" });
    expect(editor).toHaveAttribute("aria-describedby", "editor-mode-note");
  });
});
