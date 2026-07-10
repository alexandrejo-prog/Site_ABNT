// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import App from "../src/App";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) return sourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

function accessibleName(element: Element): string {
  const ariaLabel = element.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
      .join(" ")
      .trim();
    if (label) return label;
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    const explicitLabel = element.id ? document.querySelector(`label[for="${element.id}"]`)?.textContent?.trim() : "";
    if (explicitLabel) return explicitLabel;
    const wrappingLabel = element.closest("label")?.textContent?.trim();
    if (wrappingLabel) return wrappingLabel;
  }

  return element.textContent?.trim() || element.getAttribute("title")?.trim() || "";
}
function isHiddenUploadInput(element: Element): boolean {
  return element instanceof HTMLInputElement && element.type === "file" && element.style.display === "none";
}

describe("acessibilidade por teclado", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("possui skip link para o conteudo principal", () => {
    render(createElement(App));

    const skipLink = screen.getByRole("link", { name: "Pular para o conte\u00fado principal" });
    const main = document.querySelector("main#main-content");

    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("botoes principais sao focaveis por teclado", () => {
    render(createElement(App));

    for (const name of ["Validar trabalho", "Gerar DOCX edit\u00e1vel", "Montar rascunho a partir dos campos"]) {
      const button = screen.getByRole("button", { name });
      button.focus();
      expect(button).toHaveFocus();
    }
  });

  it("elementos interativos expostos tem nome acessivel", () => {
    const { container } = render(createElement(App));
    const interactiveElements = Array.from(
      container.querySelectorAll("button, a[href], input, select, textarea, [role='button'], [role='textbox']"),
    ).filter((element) => !isHiddenUploadInput(element));

    expect(interactiveElements.length).toBeGreaterThan(10);

    for (const element of interactiveElements) {
      expect(accessibleName(element), element.outerHTML).not.toBe("");
    }
  });

  it("nao usa div ou span clicavel sem semantica de botao", () => {
    const clickableTextElements = sourceFiles(resolve(process.cwd(), "src"))
      .flatMap((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return [...source.matchAll(/<(div|span)\b[^>]*onClick=[^>]*>/g)].map((match) => `${filePath}: ${match[0]}`);
      })
      .filter((snippet) => !/role=["']button["']/.test(snippet));

    expect(clickableTextElements).toEqual([]);
  });

  it("nao usa tabindex positivo", () => {
    const positiveTabIndex = sourceFiles(resolve(process.cwd(), "src"))
      .flatMap((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return [...source.matchAll(/tabIndex=\{?[1-9][0-9]*/g)].map((match) => `${filePath}: ${match[0]}`);
      });

    expect(positiveTabIndex).toEqual([]);
  });
});
