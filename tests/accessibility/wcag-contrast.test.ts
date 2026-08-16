// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Guardrail automatizado de contraste WCAG.
// Referência: WCAG 2.1 AA exige razão de contraste mínima de 4.5:1 para texto
// normal e 3:1 para texto grande (>=18pt ou >=14pt negrito) ou indicadores de
// foco/contorno. Este teste NÃO substitui revisão manual completa de contraste
// (cores podem mudar de fundo para fundo), mas impede regressões óbvias.

const CSS_PATH = resolve(process.cwd(), "src/styles.css");
const css = readFileSync(CSS_PATH, "utf8");

// --- Funções de contraste WCAG (pequenas e testáveis) ---

function normalizeHex(input: string): string {
  let hex = input.trim().replace(/^#/, "").toLowerCase();
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  return `#${hex.toUpperCase()}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex).replace(/^#/, "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function channelToLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const r = channelToLinear(rgb.r);
  const g = channelToLinear(rgb.g);
  const b = channelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(hexToRgb(fg));
  const l2 = relativeLuminance(hexToRgb(bg));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Texto normal precisa de 4.5:1; texto grande/indicador de foco precisa de 3:1.
function meetsAA(ratio: number, largeOrFocusIndicator = false): boolean {
  return ratio >= (largeOrFocusIndicator ? 3 : 4.5);
}

// Extrai o valor de uma variável CSS definida em :root do arquivo lido.
function cssVarValue(name: string): string {
  const match = css.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  if (!match) throw new Error(`Token CSS --${name} não encontrado em src/styles.css`);
  return match[1].trim();
}

// Mapa de tokens institucionais UFLA extraídos do CSS real.
const tokens = {
  blue: cssVarValue("ufla-blue"),
  green: cssVarValue("ufla-green"),
  white: cssVarValue("ufla-white"),
  grayLight: cssVarValue("ufla-gray-light"),
  blueLight: cssVarValue("ufla-blue-light"),
  greenLight: cssVarValue("ufla-green-light"),
  grayDark: cssVarValue("ufla-gray-dark"),
  blueDark: cssVarValue("ufla-blue-dark"),
  greenDark: cssVarValue("ufla-green-dark"),
  focusRing: cssVarValue("ufla-focus-ring"),
};

// Cores literais usadas diretamente na interface (também conferidas no CSS).
const literal = {
  bodyText: "#1f2933",
  lightBg: "#f5f7f4",
  panelBlueBg: "#eef4fc",
  secondaryBlueText: tokens.blue,
  errorText: "#741c1c",
  errorBg: "#ffe0dd",
  warningText: "#5d4300",
  warningBg: "#fff0bf",
  helpGray: "#52616c",
  paneBg: "#fffdfa",
  panelGrayBg: "#e7ece9",
  eyebrowBg: tokens.blue,
  eyebrowText: tokens.greenLight,
  toolbarLabel: "#6b7280",
  toolbarLabelBg: "#f9fafb",
};

describe("funções de contraste WCAG", () => {
  it("normaliza hex curto e longo", () => {
    expect(normalizeHex("#fff")).toBe("#FFFFFF");
    expect(normalizeHex("004b80")).toBe("#004B80");
  });

  it("converte hex para RGB", () => {
    expect(hexToRgb("#004B80")).toEqual({ r: 0, g: 75, b: 128 });
  });

  it("canal sRGB para linear aproxima valores conhecidos", () => {
    expect(channelToLinear(255)).toBeCloseTo(1, 5);
    expect(channelToLinear(0)).toBeCloseTo(0, 5);
    expect(channelToLinear(128)).toBeCloseTo(0.2158, 3);
  });

  it("calcula luminância relativa do branco e do preto", () => {
    expect(relativeLuminance(hexToRgb("#FFFFFF"))).toBeCloseTo(1, 5);
    expect(relativeLuminance(hexToRgb("#000000"))).toBeCloseTo(0, 5);
  });

  it("calcula razão de contraste branco/azul-UFLA", () => {
    const ratio = contrastRatio("#FFFFFF", tokens.blue);
    expect(ratio).toBeGreaterThan(4.5);
  });

  it("valida AA para texto normal e foco", () => {
    expect(meetsAA(4.5, false)).toBe(true);
    expect(meetsAA(4.49, false)).toBe(false);
    expect(meetsAA(3, true)).toBe(true);
    expect(meetsAA(2.9, true)).toBe(false);
  });
});

describe("contraste WCAG da interface UFLA", () => {
  // Texto normal: mínimo 4.5:1.
  it("1. texto branco sobre Azul-UFLA", () => {
    expect(contrastRatio(tokens.white, tokens.blue)).toBeGreaterThanOrEqual(4.5);
  });

  it("2. texto branco sobre Azul-UFLA escuro", () => {
    expect(contrastRatio(tokens.white, tokens.blueDark)).toBeGreaterThanOrEqual(4.5);
  });

  it("3. texto escuro sobre fundo branco", () => {
    expect(contrastRatio(literal.bodyText, tokens.white)).toBeGreaterThanOrEqual(4.5);
  });

  it("4. texto escuro sobre fundos claros", () => {
    expect(contrastRatio(literal.bodyText, literal.lightBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(literal.bodyText, literal.panelBlueBg)).toBeGreaterThanOrEqual(4.5);
  });

  it("5. botão primário (texto/fundo)", () => {
    // Botão azul: texto branco sobre azul-UFLA.
    expect(contrastRatio(tokens.white, tokens.blue)).toBeGreaterThanOrEqual(4.5);
    // Botão verde (strong): texto branco sobre verde-UFLA escuro (tom institucional
    // mais escuro, pois o verde-UFLA #00943E não atinge 4.5:1 com nenhuma cor de texto).
    expect(contrastRatio(tokens.white, tokens.greenDark)).toBeGreaterThanOrEqual(4.5);
    // Verde-UFLA brilhante preservado como cor de marca; com branco atinge 3:1 (texto grande/foco).
    expect(contrastRatio(tokens.white, tokens.green)).toBeGreaterThanOrEqual(3);
  });

  it("6. botão secundário/neutro (texto azul-UFLA sobre fundo claro)", () => {
    expect(contrastRatio(literal.secondaryBlueText, tokens.white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(literal.secondaryBlueText, literal.lightBg)).toBeGreaterThanOrEqual(4.5);
  });

  it("7. alertas e mensagens importantes", () => {
    expect(contrastRatio(literal.errorText, literal.errorBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(literal.warningText, literal.warningBg)).toBeGreaterThanOrEqual(4.5);
  });

  it("8. estado de foco visível (anel sólido do focus ring)", () => {
    // Indicador de foco/contorno precisa de 3:1 contra o fundo.
    expect(contrastRatio(tokens.focusRing, tokens.white)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.focusRing, literal.lightBg)).toBeGreaterThanOrEqual(3);
  });

  it("9. links e elementos clicáveis principais (texto azul-UFLA)", () => {
    expect(contrastRatio(tokens.blue, tokens.white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.blueDark, tokens.white)).toBeGreaterThanOrEqual(4.5);
  });

  it("10. texto de ajuda/descrição não usa cinza claro demais", () => {
    expect(contrastRatio(literal.helpGray, literal.paneBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(literal.helpGray, literal.panelGrayBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(literal.toolbarLabel, literal.toolbarLabelBg)).toBeGreaterThanOrEqual(4.5);
  });

  it("preserva os tokens institucionais UFLA esperados", () => {
    expect(tokens.blue.toLowerCase()).toBe("#004b80");
    expect(tokens.green.toLowerCase()).toBe("#00943e");
    expect(tokens.white.toLowerCase()).toBe("#ffffff");
    // Eyebrow verde-claro sobre azul-UFLA continua legível (>=4.5:1).
    expect(contrastRatio(literal.eyebrowText, literal.eyebrowBg)).toBeGreaterThanOrEqual(4.5);
  });
});
