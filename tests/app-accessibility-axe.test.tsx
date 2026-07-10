// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import App from "../src/App";
import { runA11yAudit } from "./a11y-test-utils";

const DRAFT_KEY = "site-abnt:draft:v3";

type Impact = "minor" | "moderate" | "serious" | "critical" | null | undefined;

function impactsAtOrAbove(impact: Impact): boolean {
  return impact === "serious" || impact === "critical";
}

function seedDraft() {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
    fields: { title: "Titulo salvo", author: "Autor salvo", workType: "artigo" },
    editorText: "Texto salvo.",
    references: [],
    workType: "artigo",
    updatedAt: new Date().toISOString(),
  }));
}

describe("auditoria axe do App principal", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renderiza a tela inicial sem violacoes axe serious ou critical", async () => {
    seedDraft();
    const { container } = render(createElement(App));

    // O utilitario desabilita apenas color-contrast porque jsdom nao calcula contraste visual de forma confiavel.
    // Demais regras axe permanecem ativas para capturar problemas estruturais reais.
    const results = await runA11yAudit(container);
    const blockingViolations = results.violations.filter((violation) => impactsAtOrAbove(violation.impact));

    expect(blockingViolations).toEqual([]);
  });

  it("exibe landmarks principais com nomes e destinos acessiveis", () => {
    render(createElement(App));

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("complementary", { name: /valida/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /campos acad/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /editor do texto/i })).toBeInTheDocument();
  });

  it("mantem botoes principais com nome acessivel", () => {
    seedDraft();
    render(createElement(App));

    expect(screen.getByRole("button", { name: /limpar rascunho/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /validar trabalho/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gerar docx edit/i })).toBeInTheDocument();
  });

  it("mantem campos principais associados a labels acessiveis", () => {
    render(createElement(App));

    expect(screen.getByLabelText("Tipo de trabalho")).toBeInTheDocument();
    expect(screen.getByLabelText("Autor")).toBeInTheDocument();
    expect(screen.getByLabelText(/^t.tulo$/i, { selector: "input" })).toBeInTheDocument();
    expect(screen.getByLabelText("Resumo")).toBeInTheDocument();
    expect(screen.getByLabelText(/^refer.ncias$/i, { selector: "textarea" })).toBeInTheDocument();
  });

  it("mantem o editor com nome acessivel e descricao associada", () => {
    render(createElement(App));

    const editor = screen.getByRole("textbox", { name: /editor do texto principal/i });
    expect(editor).toHaveAttribute("aria-describedby", "editor-mode-note");
    expect(document.getElementById("editor-mode-note")).toBeInTheDocument();
  });
});
