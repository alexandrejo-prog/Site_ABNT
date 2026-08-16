import { describe, expect, it } from "vitest";
import { emptyAcademicFields } from "../../src/ufla-rules";
import {
  expectedGraduateNatureStart,
  isGraduateNatureMismatch,
  workTypeConsistency,
} from "../../src/work-type-consistency";

describe("consistencia entre tipo e natureza do trabalho", () => {
  it("detecta projeto usado como natureza de monografia", () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      workNature: "Projeto de pesquisa apresentado à Universidade Federal de Lavras, como parte das atividades do Programa.",
    };

    expect(isGraduateNatureMismatch(fields)).toBe(true);
    expect(workTypeConsistency(fields)).toMatchObject({
      level: "warning",
      expectedNatureStart: "Monografia apresentada à Universidade Federal de Lavras",
    });
  });

  it("detecta projeto usado como natureza de tese", () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "tese" as const,
      workNature: "Projeto de pesquisa apresentado à Universidade Federal de Lavras, como parte das exigências do Programa.",
    };

    expect(isGraduateNatureMismatch(fields)).toBe(true);
    expect(workTypeConsistency(fields)).toMatchObject({
      level: "warning",
      expectedNatureStart: "Tese apresentada à Universidade Federal de Lavras",
    });
  });

  it("detecta projeto usado como natureza de dissertacao", () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      workNature: "Projeto de pesquisa apresentado à Universidade Federal de Lavras, como parte das atividades do Programa.",
    };

    expect(isGraduateNatureMismatch(fields)).toBe(true);
    expect(expectedGraduateNatureStart(fields.workType)).toBe("Dissertação apresentada à Universidade Federal de Lavras");
  });

  it("aceita projeto quando o tipo tambem e projeto", () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      workNature: "Projeto de pesquisa apresentado à Universidade Federal de Lavras.",
    };

    expect(workTypeConsistency(fields)).toMatchObject({ level: "ok" });
  });
});
