// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import App from "../../src/App";

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

  it("possui skip link funcional para um unico conteudo principal", () => {
    const { container } = render(createElement(App));

    const skipLink = screen.getByRole("link", { name: "Pular para o conte\u00fado principal" });
    const skipLinks = container.querySelectorAll(".skip-link");
    const targetId = skipLink.getAttribute("href")?.replace("#", "");
    const targets = targetId ? container.querySelectorAll(`[id="${targetId}"]`) : [];
    const main = document.querySelector("main#main-content");
    const focusableElements = Array.from(
      container.querySelectorAll("a[href], button, input, select, textarea, [role='button'], [role='textbox']"),
    ).filter((element) => !isHiddenUploadInput(element));

    expect(skipLinks).toHaveLength(1);
    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(focusableElements[0]).toBe(skipLink);
    expect(targets).toHaveLength(1);
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(main?.tagName.toLowerCase()).toBe("main");

    skipLink.focus();
    expect(skipLink).toHaveFocus();
    fireEvent.click(skipLink);
    expect(main).toHaveFocus();
    expect(window.location.hash).toBe("#main-content");
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

  it("nao mantem logs temporarios em codigo TypeScript", () => {
    const temporaryLogs = [resolve(process.cwd(), "src"), resolve(process.cwd(), "tests")]
      .flatMap(sourceFiles)
      .flatMap((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return [...source.matchAll(/console\.(log|debug|info)\b/g)].map((match) => `${filePath}: ${match[0]}`);
      });

    expect(temporaryLogs).toEqual([]);
  });

  it("preserva mensagens de erro necessarias", () => {
    const errorBoundarySource = readFileSync(resolve(process.cwd(), "src/ErrorBoundary.tsx"), "utf8");
    const draftStorageSource = readFileSync(resolve(process.cwd(), "src/draft-storage.ts"), "utf8");

    expect(errorBoundarySource).toContain("console.error");
    expect(draftStorageSource).toContain("console.error");
  });
});
