// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FirstUseGuide } from "../../src/components/FirstUseGuide";
import { runA11yAudit } from "../a11y-test-utils";

describe("B4 — FirstUseGuide (foco/aria)", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("expõe região nomeada (role=region + aria-label), não modal", () => {
    render(<FirstUseGuide visible onDismiss={() => {}} />);
    const region = screen.getByRole("region", { name: "Primeiros passos" });
    expect(region).toBeInTheDocument();
    expect(region).not.toHaveAttribute("aria-modal");
  });

  it("sem violações critical/serious no axe", async () => {
    const { container } = render(<FirstUseGuide visible onDismiss={() => {}} />);
    const results = await runA11yAudit(container);
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    if (blocking.length) {
      console.error(`Violações no FirstUseGuide:\n${blocking.map((v) => `${v.id} (${v.impact}): ${v.help}`).join("\n")}`);
    }
    expect(blocking).toEqual([]);
  });

  it("fechar o guia devolve o foco ao elemento que estava focado antes", async () => {
    const onDismiss = vi.fn();
    function Harness() {
      return (
        <>
          <button type="button">Botão de fora</button>
          <FirstUseGuide visible onDismiss={onDismiss} />
        </>
      );
    }
    render(<Harness />);
    const outside = screen.getByRole("button", { name: "Botão de fora" });
    outside.focus();
    expect(document.activeElement).toBe(outside);

    fireEvent.click(screen.getByRole("button", { name: "Entendi, começar" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    // Após o unmount, o foco volta para o botão externo (rAF).
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(document.activeElement).toBe(outside);
  });
});
