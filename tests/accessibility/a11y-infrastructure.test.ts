// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { criticalA11yViolations, runA11yAudit } from ".././a11y-test-utils";

describe("infraestrutura de acessibilidade automatizada", () => {
  it("carrega o utilitario de auditoria", () => {
    expect(runA11yAudit).toBeTypeOf("function");
    expect(criticalA11yViolations).toBeTypeOf("function");
  });

  it("executa axe em HTML simples sem violacoes", async () => {
    const container = document.createElement("main");
    container.innerHTML = `
      <h1>Documento academico</h1>
      <button type="button">Validar trabalho</button>
      <label for="titulo">Titulo</label>
      <input id="titulo" name="titulo" />
    `;
    document.body.appendChild(container);

    const results = await runA11yAudit(container);

    expect(results.violations).toEqual([]);
    expect(criticalA11yViolations(results)).toEqual([]);
  });
});
