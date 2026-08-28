// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DraftStatus } from "../../src/components/DraftStatus";
import { runA11yAudit } from "../a11y-test-utils";

function managerProps(overrides: Partial<Parameters<typeof DraftStatus>[0]> = {}) {
  return {
    draftStatus: "idle" as const,
    hasDraft: false,
    drafts: [],
    activeDraftId: null,
    onCreateDraft: () => {},
    onRenameDraft: () => {},
    onDeleteDraft: () => {},
    onExportBackup: () => {},
    onImportBackup: () => {},
    onSelectDraft: () => {},
    onClearDraft: () => {},
    onSaveDraft: () => {},
    ...overrides,
  };
}

describe("B4 — DraftStatus (foco/aria do gerenciador de rascunhos)", () => {
  afterEach(() => {
    cleanup();
  });

  it("abrir o gerenciador expõe role=dialog + aria-modal", async () => {
    render(<DraftStatus {...managerProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /Rascunhos/ }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby");
  });

  it("dialog aberto sem violações critical/serious no axe", async () => {
    const { container } = render(<DraftStatus {...managerProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /Rascunhos/ }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const results = await runA11yAudit(container);
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    if (blocking.length) {
      console.error(`Violações no DraftStatus:\n${blocking.map((v) => `${v.id} (${v.impact}): ${v.help}`).join("\n")}`);
    }
    expect(blocking).toEqual([]);
  });

  it("fechar com Escape devolve o foco ao botão que abriu o gerenciador", async () => {
    render(<DraftStatus {...managerProps()} />);
    const toggle = screen.getByRole("button", { name: /Rascunhos/ });
    toggle.focus();
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(toggle);
  });

  it("fechar pelo botão X também devolve o foco ao gatilho", async () => {
    render(<DraftStatus {...managerProps()} />);
    const toggle = screen.getByRole("button", { name: /Rascunhos/ });
    toggle.focus();
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Fechar gerenciador de rascunhos" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(toggle);
  });
});
