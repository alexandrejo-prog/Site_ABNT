// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { PreviewModal } from "../../src/components/PreviewModal";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { runA11yAudit } from ".././a11y-test-utils";

function baseFields() {
  return {
    ...emptyAcademicFields(),
    workType: "monografia",
    author: "Autor",
    title: "Título",
    location: "Lavras - MG",
    year: "2026",
    course: "Bacharelado em Biologia",
    resumo: "Resumo do trabalho.",
    palavrasChave: "cafe; qualidade",
    abstractText: "Abstract text.",
    keywords: "coffee; quality",
    referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
  };
}

const EDITOR_TEXT = "# 1 Introducao\nTexto comum.\n# 2 Metodologia\nTexto.\n";

function modalProps(overrides: Partial<Parameters<typeof PreviewModal>[0]> = {}) {
  return {
    input: {
      fields: baseFields(),
      editorText: EDITOR_TEXT,
      importedImages: [],
      importedTables: [],
      ...overrides.input,
    },
    onClose: () => {},
    onCommitEditorText: () => {},
    onUpdateField: () => {},
    onGenerate: () => {},
    ...overrides,
  } as Parameters<typeof PreviewModal>[0];
}

describe("axe PreviewModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("modal aberto não tem violações critical/serious", async () => {
    const props = modalProps();
    const { container } = render(<PreviewModal {...props} />);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const results = await runA11yAudit(container);
    const blocking = results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );

    if (blocking.length) {
      console.error(`Violações no PreviewModal:\n${blocking.map((v) => `${v.id} (${v.impact}): ${v.help}`).join("\n")}`);
    }

    expect(blocking).toEqual([]);
  });

  it("expõe role=dialog e aria-modal", async () => {
    const props = modalProps();
    render(<PreviewModal {...props} />);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("role", "dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("fecha com Escape", async () => {
    let closed = false;
    const onClose = () => { closed = true; };
    const props = modalProps({ onClose });
    const { unmount } = render(<PreviewModal {...props} />);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const dialog = screen.getByRole("dialog");
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(closed).toBe(true);

    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});

describe("PreviewModal - focus trap", () => {
  afterEach(() => {
    cleanup();
  });

  it("foco inicial permanece dentro do dialog", async () => {
    const props = modalProps();
    render(<PreviewModal {...props} />);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("Tab cíclico mantém foco dentro do dialog (último → primeiro)", async () => {
    const props = modalProps();
    render(<PreviewModal {...props} />);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const dialog = screen.getByRole("dialog");
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    expect(focusable.length).toBeGreaterThan(0);

    const last = focusable[focusable.length - 1];
    last.focus();
    expect(document.activeElement).toBe(last);

    const user = userEvent.setup();
    await user.tab();

    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(focusable[0]);
  });

  it("Shift+Tab cíclico mantém foco dentro do dialog (primeiro → último)", async () => {
    const props = modalProps();
    render(<PreviewModal {...props} />);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const dialog = screen.getByRole("dialog");
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    expect(focusable.length).toBeGreaterThan(0);

    const first = focusable[0];
    first.focus();
    expect(document.activeElement).toBe(first);

    const user = userEvent.setup();
    await user.tab({ shift: true });

    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(focusable[focusable.length - 1]);
  });

  it("Tab avança o foco entre elementos focáveis do dialog", async () => {
    const props = modalProps();
    render(<PreviewModal {...props} />);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const dialog = screen.getByRole("dialog");
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    expect(focusable.length).toBeGreaterThan(1);

    const first = focusable[0];
    first.focus();
    expect(document.activeElement).toBe(first);

    const user = userEvent.setup();
    await user.tab();

    expect(document.activeElement).toBe(focusable[1]);
  });

  it("Foco não escapa do dialog após Tab a partir do último elemento", async () => {
    const props = modalProps();
    render(<PreviewModal {...props} />);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const dialog = screen.getByRole("dialog");
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    const last = focusable[focusable.length - 1];
    last.focus();
    expect(document.activeElement).toBe(last);

    const user = userEvent.setup();
    await user.tab();

    expect(document.activeElement).not.toBe(last);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
