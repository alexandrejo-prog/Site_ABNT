import { describe, expect, it } from "vitest";
import * as nodeFs from "node:fs";

const raw = nodeFs.readFileSync(new URL("../../vercel.json", import.meta.url), "utf8");
const config = JSON.parse(raw);
const first = config.headers?.[0];
const headerMap = new Map<string, string>();
for (const header of first?.headers ?? []) headerMap.set(header.key, header.value);

describe("cabeçalhos de segurança no deploy Vercel", () => {
  it("vercel.json existe e define headers para todas as rotas", () => {
    expect(config.headers).toBeDefined();
    expect(first.source).toBe("/(.*)");
  });

  it("define Content-Security-Policy com frame-ancestors 'none' e object-src 'none'", () => {
    const csp = headerMap.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("define Referrer-Policy", () => {
    expect(headerMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("define X-Content-Type-Options", () => {
    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("define Permissions-Policy restritiva", () => {
    const policy = headerMap.get("Permissions-Policy") ?? "";
    expect(policy).toContain("camera=()");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
  });

  it("define X-Frame-Options", () => {
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
  });
});
