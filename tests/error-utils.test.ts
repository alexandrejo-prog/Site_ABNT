import { describe, expect, it } from "vitest";
import { friendlyGenerationError, reportTechnicalError } from "../src/error-utils";

describe("friendlyGenerationError (TEC-03)", () => {
  it("traduz erro genérico de unknown em mensagem amigável", () => {
    expect(friendlyGenerationError(new Error("boom"))).toMatch(/Falha ao gerar o DOCX/);
  });

  it("retorna string não vazia para unknown indefinido", () => {
    expect(friendlyGenerationError(undefined)).toMatch(/Falha ao gerar o DOCX/);
  });

  it("aceita string diretamente", () => {
    expect(friendlyGenerationError("erro de teste")).toMatch(/erro de teste/);
  });

  it("detecta erro de reparo/corrupção e sugere revisão", () => {
    const msg = friendlyGenerationError(new Error("The file cannot be opened because it is corrupt"));
    expect(msg).toMatch(/não foi possível montar o arquivo DOCX/i);
    expect(msg).toMatch(/revise tabelas, imagens e formatação/i);
  });

  it("reportTechnicalError não lança para undefined/Error", () => {
    expect(() => reportTechnicalError("ctx", new Error("x"))).not.toThrow();
    expect(() => reportTechnicalError("ctx", undefined)).not.toThrow();
  });
});