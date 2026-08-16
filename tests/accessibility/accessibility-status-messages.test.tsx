// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import App from "../../src/App";

// Guardrail de mensagens acessíveis. Não substitui revisão manual, mas impede
// regressões em que erros/sucesso/avisos ficassem visíveis só para quem enxergue
// a cor, ou deixassem leitores de tela sem anúncio.
describe("mensagens de status acessiveis", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  // 1. Pelo menos uma região acessível de status informativo.
  it("expoe ao menos uma regiao de status informativo", () => {
    render(createElement(App));
    // Linha de status (role=status) e DraftStatus (role=status) estao presentes.
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });

  // 2. Erros importantes usam role="alert" (anuncio assertivo).
  it("erros de validacao usam role=alert", () => {
    render(createElement(App));
    fireEvent.click(screen.getByRole("button", { name: "Validar trabalho" }));
    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
  });

  // 3. Avisos nao críticos usam semântica informativa, nunca alert assertivo.
  it("avisos de validacao usam role=status e nao role=alert", () => {
    render(createElement(App));
    fireEvent.click(screen.getByRole("button", { name: "Validar trabalho" }));
    const warningsRegion = screen.getByRole("region", { name: "Alertas de validação" });
    // Nenhum alerta assertivo dentro da região de avisos.
    expect(within(warningsRegion).queryAllByRole("alert")).toEqual([]);
    // Avisos usam semântica informativa (status), nao alert.
    expect(within(warningsRegion).getAllByRole("status").length).toBeGreaterThan(0);
  });

  // 4. Regiões dinâmicas usam aria-live="polite" para atualização sem interrupção.
  it("a linha de status usa aria-live polite", () => {
    render(createElement(App));
    const statusLine = document.querySelector(".status-line");
    expect(statusLine).toHaveAttribute("aria-live", "polite");
  });

  // 5. Campos/grupos com ajuda clara usam aria-describedby.
  it("editor de texto conecta texto de ajuda via aria-describedby", () => {
    render(createElement(App));
    const editor = screen.getByRole("textbox", { name: "Editor do texto principal" });
    const describedBy = editor.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const help = document.getElementById(describedBy as string);
    expect(help).toBeInTheDocument();
    expect(help?.textContent?.trim().length).toBeGreaterThan(0);
  });

  // 6. Botões de ação expõem nome acessível (contexto textual suficiente; sem ícone solitário).
  it("botoes de acao expoem nome acessivel", () => {
    render(createElement(App));
    for (const name of ["Validar trabalho", "Gerar DOCX editável", "Montar rascunho a partir dos campos"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    const generate = screen.getByRole("button", { name: "Gerar DOCX editável" });
    // O botão carrega texto ("Gerando...") quando indisponível, preservando contexto.
    expect(generate).toBeEnabled();
  });

  // 7. Mensagens não dependem apenas de cor: erros trazem texto acessível.
  it("mensagens de erro trazem texto acessivel, nao so cor", () => {
    render(createElement(App));
    fireEvent.click(screen.getByRole("button", { name: "Validar trabalho" }));
    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
    for (const alert of alerts) {
      expect(alert.textContent?.trim().length).toBeGreaterThan(0);
    }
  });
});
