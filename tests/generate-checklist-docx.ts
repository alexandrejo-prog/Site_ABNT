import { generateDocxBlob } from "../src/export-docx";
import { emptyAcademicFields } from "../src/ufla-rules";
import { writeFileSync } from "fs";
import { Buffer } from "buffer";

const fields = emptyAcademicFields();
fields.workType = "tese";
fields.author = "João Silva";
fields.title = "Título de Teste para Validação";
fields.advisor = "Dr. Fulano de Tal";
fields.coadvisor = "Dra. Siclana de Tal";
fields.approvalMembers = ["Prof. Avaliador 1", "Prof. Avaliador 2", "Prof. Avaliador 3"];
fields.resumo = "Este é um resumo de teste para validar a correção dos erros de TypeScript.";
fields.palavrasChave = "teste; validação; typescript";
fields.abstractText = "This is a test abstract for validation.";
fields.keywords = "test; validation; typescript";
fields.year = "2026";
fields.location = "Lavras - MG";
fields.course = "Ciência da Computação";
fields.program = "Programa de Pós-Graduação em Ciência da Computação";
fields.workNature = "Tese apresentada ao Programa de Pós-Graduação em Ciência da Computação da Universidade Federal de Lavras como parte dos requisitos para obtenção do título de Doutor.";

const blob = await generateDocxBlob({
  fields,
  editorText: "# 1 Introdução\n\nEste é um texto de introdução de teste.\n\n## 1.1 Objetivos\n\nTexto de objetivos.\n\n# 2 Desenvolvimento\n\nTexto do desenvolvimento.\n\n# 3 Conclusão\n\nTexto da conclusão.",
  importedImages: [],
  importedTables: [],
});

const buffer = Buffer.from(await blob.arrayBuffer());
writeFileSync("tmp/checklist-validation.docx", buffer);