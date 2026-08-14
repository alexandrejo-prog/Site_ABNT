import { afterEach, describe, expect, it, vi } from "vitest";
import { loadDefaultLogoAsset } from "../../src/export-docx";

describe("logo padrao UFLA em ambiente Node/Vitest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("nao tenta buscar URL relativa em teste Node", async () => {
    const fetchMock = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.stubGlobal("fetch", fetchMock);

    await expect(loadDefaultLogoAsset()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
