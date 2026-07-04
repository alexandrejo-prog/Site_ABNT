import { generateDocxBlob, type DocxGenerationInput } from "./export-docx";

function hasValue(value: string): boolean {
  return value.trim().length > 0;
}

function projectEditorText(input: DocxGenerationInput): string {
  if (input.editorText.trim()) return input.editorText;

  const sections: Array<[string, string]> = [
    ["TEMA", input.fields.tema],
    ["DELIMITAÇÃO DO TEMA", input.fields.delimitacaoTema],
    ["PROBLEMA DE PESQUISA", input.fields.problemaPesquisa],
    ["HIPÓTESE", input.fields.hipotese],
    ["OBJETIVO GERAL", input.fields.objetivoGeral],
    ["OBJETIVOS ESPECÍFICOS", input.fields.objetivosEspecificos],
    ["JUSTIFICATIVA", input.fields.justificativa],
    ["REFERENCIAL TEÓRICO", input.fields.referencialTeorico],
    ["METODOLOGIA", input.fields.metodologia],
    ["CRONOGRAMA", input.fields.cronograma],
    ["RECURSOS/ORÇAMENTO", input.fields.recursosOrcamento],
    ["RESULTADOS ESPERADOS", input.fields.resultadosEsperados],
  ];

  return sections
    .filter(([, value]) => hasValue(value))
    .flatMap(([title, value]) => [`# ${title}`, value.trim()])
    .join("\n\n");
}

export async function generateResearchProjectDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  return generateDocxBlob({ ...input, editorText: projectEditorText(input) });
}
