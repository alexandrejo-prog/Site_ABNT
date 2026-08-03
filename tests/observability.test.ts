import { afterEach, describe, expect, it } from "vitest";
import { clearTraces, recentTraces, traceEvent } from "../src/observability";

describe("observability (OP-01)", () => {
  afterEach(() => {
    clearTraces();
  });

  it("registra eventos na ordem", () => {
    traceEvent("a");
    traceEvent("b");
    expect(recentTraces().map((e) => e.name)).toEqual(["a", "b"]);
  });

  it("cada evento tem um timestamp numérico", () => {
    traceEvent("x");
    const [event] = recentTraces();
    expect(event.name).toBe("x");
    expect(typeof event.at).toBe("number");
  });

  it("clearTraces esvazia o rastreio", () => {
    traceEvent("a");
    clearTraces();
    expect(recentTraces()).toEqual([]);
  });

  it("não lança mesmo sem performance.mark", () => {
    const originalMark = (performance as { mark?: unknown }).mark;
    (performance as { mark?: unknown }).mark = undefined;
    try {
      expect(() => traceEvent("sem-mark")).not.toThrow();
      expect(recentTraces()).toHaveLength(1);
    } finally {
      (performance as { mark?: unknown }).mark = originalMark;
    }
  });
});