import { useState } from "react";
import type { AcademicFields, AcademicFieldKey, Confidence } from "../ufla-rules";
import { ACADEMIC_FIELD_KEYS, emptyAcademicFields, emptyConfidenceMap } from "../ufla-rules";
import { normalizeFieldsForSelectedModel } from "../work-type-field-normalizer";

function shouldNormalizeAfterFieldChange(key: AcademicFieldKey): boolean {
  return key === "program" || key === "course";
}

function modelConfidence(workType: AcademicFields["workType"]): boolean {
  return ["monografia", "dissertacao", "tese", "projeto_pesquisa"].includes(workType);
}

export function useFormModel() {
  const [fields, setFields] = useState<AcademicFields>(emptyAcademicFields);
  const [confidence, setConfidence] = useState<Record<AcademicFieldKey, Confidence>>(emptyConfidenceMap);

  function updateField(key: AcademicFieldKey, value: string) {
    setFields((current) => {
      const next = { ...current, [key]: value };
      return shouldNormalizeAfterFieldChange(key) ? normalizeFieldsForSelectedModel(next) : next;
    });
    setConfidence((current) => ({
      ...current,
      [key]: current[key] === "nao-identificado" ? "baixa" : current[key],
      ...(shouldNormalizeAfterFieldChange(key) && modelConfidence(fields.workType) ? { workNature: "media" as Confidence } : {}),
    }));
  }

  function updateWorkType(workType: AcademicFields["workType"]) {
    const nextFields = normalizeFieldsForSelectedModel({ ...fields, workType });
    setFields(nextFields);
    setConfidence((current) => ({
      ...current,
      workNature: modelConfidence(workType) ? "media" : current.workNature,
      program: modelConfidence(workType) ? "media" : current.program,
    }));
    return nextFields;
  }

  function replaceFields(importedFields: Partial<AcademicFields>, importedConfidence?: Record<AcademicFieldKey, Confidence>) {
    setFields(() => normalizeFieldsForSelectedModel({ ...emptyAcademicFields(), ...importedFields }));
    setConfidence(() => {
      const next = emptyConfidenceMap();
      if (importedConfidence) for (const key of ACADEMIC_FIELD_KEYS) next[key] = importedConfidence[key];
      return next;
    });
  }

  function resetFields() {
    setFields(emptyAcademicFields());
    setConfidence(emptyConfidenceMap());
  }

  return { fields, setFields, confidence, setConfidence, updateField, updateWorkType, replaceFields, resetFields };
}
