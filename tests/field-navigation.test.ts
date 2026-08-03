import { describe, expect, it } from "vitest";
import { resolveFieldTarget, FIELD_TARGET_EDITOR, FIELD_TARGET_WORK_TYPE, isAcademicFieldKey, targetsEditor } from "../src/field-navigation";

describe("resolveFieldTarget (UX-02)", () => {
  it("campos acadêmicos apontam para input com o mesmo id", () => {
    expect(resolveFieldTarget("author")).toEqual({ kind: "field", id: "author" });
    expect(resolveFieldTarget("referencias")).toEqual({ kind: "field", id: "referencias" });
  });

  it("alvo de editor resolve para kind editor", () => {
    expect(resolveFieldTarget(FIELD_TARGET_EDITOR)).toEqual({ kind: "editor" });
    expect(targetsEditor({ kind: "editor" })).toBe(true);
  });

  it("alvo de tipo de trabalho resolve para kind workType", () => {
    expect(resolveFieldTarget(FIELD_TARGET_WORK_TYPE)).toEqual({ kind: "workType" });
  });

  it("chaves de campos de metadados são reconhecidas", () => {
    expect(isAcademicFieldKey("advisor")).toBe(true);
    expect(isAcademicFieldKey("title")).toBe(true);
    expect(isAcademicFieldKey("listaAbreviaturas")).toBe(true);
  });
});