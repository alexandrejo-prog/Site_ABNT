// Acesso seguro a `process.env` a partir de código que roda no browser.
// No browser `process` não existe; essas flags são sempre "ligadas" por
// padrão (comportamento esperado do app web). No Node (CLI/repro/testes)
// respeitam a variável de ambiente real.
function envFlag(name: string, defaultValue = true): boolean {
  try {
    const value = typeof process !== "undefined" && process.env ? process.env[name] : undefined;
    if (value === undefined) return defaultValue;
    if (value === "0" || value === "false" || value === "FALSE") return false;
    return true;
  } catch {
    return defaultValue;
  }
}

function envString(name: string, defaultValue: string): string {
  try {
    const value = typeof process !== "undefined" && process.env ? process.env[name] : undefined;
    return value && value.length ? value : defaultValue;
  } catch {
    return defaultValue;
  }
}

export const safeEnv = { flag: envFlag, string: envString };
