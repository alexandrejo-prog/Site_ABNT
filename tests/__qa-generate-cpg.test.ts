import { mkdirSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { generateCpgDocxBlob } from "../src/export-cpg-docx";
import { generateCpgPdfBlob } from "../src/export-cpg-pdf";
import { emptyAcademicFields, type AcademicFields } from "../src/ufla-rules";

function fields(workType: AcademicFields["workType"]): AcademicFields {
  return {
    ...emptyAcademicFields(),
    workType,
    title: "Práxis na Pós-Graduação em Educação",
    author: "Maria Silva, João Souza",
    program: "Universidade Federal de Lavras\nPrograma de Pós-Graduação em Educação",
    course: "maria@ufla.br, joao@ufla.br",
    resumo: "Educação, Ciências, Docência e Práxis orientam esta pesquisa no contexto da pós-graduação.",
    palavrasChave: "Educação; Ciências; Docência; Práxis",
    abstractText: "Education, Science, Teaching and Praxis guide this research in graduate education.",
    keywords: "Education; Science; Teaching; Praxis",
    referencias: "SILVA, M. **Práxis educativa**. Lavras: UFLA, 2026.",
    agradecimentos: "À Universidade Federal de Lavras.",
  };
}

function body(repetitions: number): string {
  return Array.from({ length: repetitions }, (_, index) =>
    `# ${index + 1} Introdução\nEste parágrafo avalia Pós-Graduação, Educação, Ciências, Docência e Práxis com texto suficiente para observar margens, espaçamento e quebra de página no modelo CPG/UFLA.`,
  ).join("\n");
}

async function writeBlob(path: string, blob: Blob): Promise<void> {
  writeFileSync(path, Buffer.from(await blob.arrayBuffer()));
}

describe("gera arquivos CPG para QA visual", () => {
  it("escreve DOCX e PDF reais", async () => {
    mkdirSync("tmp/pdfs", { recursive: true });
    await writeBlob("tmp/pdfs/resumo-cpg.docx", await generateCpgDocxBlob({ fields: fields("resumo_cpg"), editorText: body(1) }));
    await writeBlob(
      "tmp/pdfs/resumo-expandido-cpg.docx",
      await generateCpgDocxBlob({ fields: fields("resumo_expandido_cpg"), editorText: body(18) }),
    );
    await writeBlob(
      "tmp/pdfs/artigo-completo-cpg.docx",
      await generateCpgDocxBlob({ fields: fields("artigo_completo_cpg"), editorText: body(50) }),
    );
    await writeBlob(
      "tmp/pdfs/resumo-expandido-cpg.pdf",
      await generateCpgPdfBlob({ fields: fields("resumo_expandido_cpg"), editorText: body(18) }),
    );
    await writeBlob(
      "tmp/pdfs/artigo-completo-cpg.pdf",
      await generateCpgPdfBlob({ fields: fields("artigo_completo_cpg"), editorText: body(50) }),
    );
  });
});
