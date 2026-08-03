import { describe, expect, it } from "vitest";
import { dismissOnboarding, isOnboardingDismissed, FIRST_USE_STEPS } from "../src/onboarding";

function memoryStorage(): Storage & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as Storage & { store: Map<string, string> };
}

describe("onboarding primeiro uso (PROD-01)", () => {
  it("exibe por padrão quando nunca descartado", () => {
    expect(isOnboardingDismissed(memoryStorage())).toBe(false);
  });

  it("deixa de exibir após descartar", () => {
    const storage = memoryStorage();
    dismissOnboarding(storage);
    expect(isOnboardingDismissed(storage)).toBe(true);
  });

  it("toleria armazenamento indisponível (get)", () => {
    const bad = { getItem: () => { throw new Error("denied"); } } as unknown as Storage;
    expect(isOnboardingDismissed(bad)).toBe(false);
  });

  it("toleria armazenamento indisponível (set)", () => {
    const bad = { setItem: () => { throw new Error("denied"); } } as unknown as Storage;
    expect(() => dismissOnboarding(bad)).not.toThrow();
  });

  it("oferece 3 passos com título e descrição", () => {
    expect(FIRST_USE_STEPS).toHaveLength(3);
    for (const s of FIRST_USE_STEPS) {
      expect(s.title).toBeTruthy();
      expect(s.description).toBeTruthy();
    }
  });
});