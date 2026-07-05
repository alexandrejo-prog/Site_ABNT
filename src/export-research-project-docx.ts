import { generateDocxBlob, type DocxGenerationInput } from "./export-docx";
import { repairHeadingFragments } from "./heading-fragment-repair";
import { normalizeFieldsForSelectedModel } from "./work-type-field-normalizer";

function hasValue(value: string): boolean {
  return value.trim().length > 0;
}

function projectEditorText(input: DocxGenerationInput): string {
  if (input.editorText.trim()) return repairHeadingFragments(input.editorText);

  const sections: Array<[string, string]> = [
    ["TEMA", input.fields.tema],
    ["DELIMITACAO DO TEMA", input.fields.delimitacaoTema],
    ["PROBLEMA DE PESQUISA", input.fields.problemaPesquisa],
    ["HIPOTESE", input.fields.hipotese],
    ["OBJETIVO GERAL", input.fields.objetivoGeral],
    ["OBJETIVOS ESPECIFICOS", input.fields.objetivosEspecificos],
    ["JUSTIFICATIVA", input.fields.justificativa],
    ["REFERENCIAL TEORICO", input.fields.referencialTeorico],
    ["METODOLOGIA", input.fields.metodologia],
    ["CRONOGRAMA", input.fields.cronograma],
    ["RECURSOS/ORCAMENTO", input.fields.recursosOrcamento],
    ["RESULTADOS ESPERADOS", input.fields.resultadosEsperados],
  ];

  return repairHeadingFragments(
    sections
      .filter(([, value]) => hasValue(value))
      .flatMap(([title, value]) => [`# ${title}`, value.trim()])
      .join("\n\n"),
  );
}

export async function generateResearchProjectDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  const fields = normalizeFieldsForSelectedModel(input.fields);
  return generateDocxBlob({ ...input, fields, editorText: projectEditorText({ ...input, fields }) });
}
