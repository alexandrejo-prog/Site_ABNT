import { describe, expect, it } from "vitest";
import { importDocumentFile } from "../src/import-docx";
import { normalizeFieldsForSelectedModel } from "../src/work-type-field-normalizer";
import { templateForWorkType } from "../src/document-template";
import JSZip from "jszip";
import fs from "fs";

const REAL_DOCX_PATH = "_diagnostico/andrade-2025/Andrade_2025.docx";

describe(" Auditoria do fluxo real com DOCX de Andrade (local)", () => {
  const hasRealFile = fs.existsSync(REAL_DOCX_PATH);

  it.skipIf(!hasRealFile)("valida documento XML gerado a partir do DOCX real", async () => {
    const arrayBuffer = fs.readFileSync(REAL_DOCX_PATH);
    const file = new File([arrayBuffer], "Andrade_2025.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const importResult = await importDocumentFile(file);
    const generationFields = normalizeFieldsForSelectedModel(importResult.fields);
    const blob = await templateForWorkType(generationFields.workType).generate({
      fields: generationFields,
      editorText: importResult.editorText,
      importedImages: importResult.importedImages,
      importedTables: importResult.importedTables,
    });

    const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
    const documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";

    expect(documentXml).toContain("Administração Pública");
    expect(documentXml).toContain("Gestão Pública");
    expect(documentXml).not.toContain("Mestre em Ciências");
    expect(documentXml).not.toContain("Dany Flavio Tonelli Bibliografia");
    expect(documentXml).not.toContain("Banca examinadora provisória");
    expect(documentXml).not.toContain("Ficha catalográfica provisória");

    const approvalStart = documentXml.indexOf("APROVADO EM");
    const resumoStart = documentXml.indexOf("RESUMO");
    if (approvalStart >= 0 && resumoStart >= 0) {
      expect(approvalStart).toBeLessThan(resumoStart);
    }

    const abstractStart = documentXml.indexOf("ABSTRACT");
    if (resumoStart >= 0 && abstractStart >= 0) {
      expect(resumoStart).toBeLessThan(abstractStart);
    }

    const introducaoIdx = documentXml.indexOf("INTRODUÇÃO");
    const referencialIdx = documentXml.indexOf("REFERENCIAL TEÓRICO");
    const metodologiaIdx = documentXml.indexOf("METODOLOGIA");
    const resultadosIdx = documentXml.indexOf("RESULTADOS E DISCUSSÃO");
    const conclusaoIdx = documentXml.indexOf("CONCLUSÃO");
    const referenciasIdx = documentXml.lastIndexOf("REFERÊNCIAS");

    expect(introducaoIdx).toBeGreaterThanOrEqual(0);
    expect(referencialIdx).toBeGreaterThan(introducaoIdx);
    expect(metodologiaIdx).toBeGreaterThan(referencialIdx);
    expect(resultadosIdx).toBeGreaterThan(metodologiaIdx);
    expect(conclusaoIdx).toBeGreaterThan(resultadosIdx);
    expect(referenciasIdx).toBeGreaterThan(conclusaoIdx);
  });

  it.skipIf(!hasRealFile)("import não classifica documento como patente", async () => {
    const arrayBuffer = fs.readFileSync(REAL_DOCX_PATH);
    const file = new File([arrayBuffer], "Andrade_2025.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const result = await importDocumentFile(file);
    expect(result.fields.workType).toBe("dissertacao");
    expect(result.fields.workNature).toContain("Administração Pública");
    expect(result.fields.workNature).toContain("Gestão Pública");
  });

  it.skipIf(!hasRealFile)("folha de aprovação não captura resumo nem agradecimentos", async () => {
    const arrayBuffer = fs.readFileSync(REAL_DOCX_PATH);
    const file = new File([arrayBuffer], "Andrade_2025.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const result = await importDocumentFile(file);
    const approvalContent = [
      result.fields.aprovalDate,
      ...(result.fields.approvalMembers ?? []),
    ].join(" ");

    expect(approvalContent).not.toContain("A presente pesquisa teve como objetivo");
    expect(approvalContent).not.toContain("A Universidade Federal de Lavras");
    expect(approvalContent).not.toContain("Palavras-chave");
  });

  it.skipIf(hasRealFile)("pula se o arquivo de diagnóstico não existir", () => {
    expect(hasRealFile).toBe(false);
  });
});
