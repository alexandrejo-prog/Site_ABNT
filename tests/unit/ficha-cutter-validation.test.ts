import { describe, expect, it } from "vitest";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { validateWork } from "../../src/validators";

function fieldsWithFicha(ficha: string, workType: "monografia" | "dissertacao" | "tese" = "monografia") {
  return {
    ...emptyAcademicFields(),
    workType,
    title: "Título",
    author: "Maria Silva",
    resumo: "Resumo com conteúdo suficiente para a validação do trabalho acadêmico.",
    referencias: "SILVA, M. Título. Lavras: UFLA, 2024.",
    fichaCatalografica: ficha,
  };
}

describe("ficha catalográfica: Cutter bloqueante no validateWork", () => {
  it("ficha em texto com número de Cutter passa (sem ficha-cutter-missing)", () => {
    const issues = validateWork(
      fieldsWithFicha("Ficha catalográfica elaborada pela Biblioteca Universitária da UFLA. S586f Silva, M. A. Título. Lavras: UFLA, 2024."),
      "# 1 Introdução\n\nTexto.",
    );
    expect(issues.some((i) => i.code === "ficha-cutter-missing")).toBe(false);
  });

  it("ficha em texto sem Cutter vira ERROR bloqueante", () => {
    const issues = validateWork(
      fieldsWithFicha("Ficha catalográfica elaborada pela Biblioteca Universitária da UFLA com autoria título e descritores."),
      "# 1 Introdução\n\nTexto.",
    );
    const cutter = issues.find((i) => i.code === "ficha-cutter-missing");
    expect(cutter).toBeDefined();
    expect(cutter!.severity).toBe("error");
    expect(cutter!.message).toMatch(/Cutter/);
  });

  it("ficha vazia não gera o erro de Cutter (ausência é pendência de versão final)", () => {
    const issues = validateWork(fieldsWithFicha(""), "# 1 Introdução\n\nTexto.");
    expect(issues.some((i) => i.code === "ficha-cutter-missing")).toBe(false);
  });

  it("texto placeholder não dispara o erro de Cutter", () => {
    const issues = validateWork(
      fieldsWithFicha("Inserir aqui a ficha catalografica oficial gerada pela Biblioteca"),
      "# 1 Introdução\n\nTexto.",
    );
    expect(issues.some((i) => i.code === "ficha-cutter-missing")).toBe(false);
  });

  it("não aplica para artigo/CPG (ficha não exigida)", () => {
    const issues = validateWork(
      { ...fieldsWithFicha("Texto sem Cutter nenhum aqui."), workType: "artigo" as const },
      "# 1 Introdução\n\nTexto.",
    );
    expect(issues.some((i) => i.code === "ficha-cutter-missing")).toBe(false);
  });
});
