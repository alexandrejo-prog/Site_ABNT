import { describe, expect, it } from "vitest";
import { importDocumentFile } from "../src/import-docx";
import { normalizeFieldsForSelectedModel } from "../src/work-type-field-normalizer";
import { templateForWorkType } from "../src/document-template";
import { extractDocxStructure } from "../src/word-structure-extractor";
import { documentText } from "./test-utils/ooxml";
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

  it.skipIf(!hasRealFile)("folha de rosto nao contem orientador colado nem local/ano na natureza", async () => {
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

    const titlePageEnd = documentXml.indexOf("RESUMO");
    const titlePageXml = titlePageEnd >= 0 ? documentXml.slice(0, titlePageEnd) : documentXml;

    expect(titlePageXml).not.toContain("título de Mestre. Prof.");
    expect(titlePageXml).not.toContain("Orientador LAVRAS-MG");
    expect(titlePageXml).toContain("Orientador(a):");
  });

  it.skipIf(!hasRealFile)("folha de aprovacao nao tem data duplicada nem banca colada", async () => {
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

    expect(documentXml).not.toContain("Aprovado em: APROVADA");
    expect(documentXml).not.toContain("2025..");
    expect(documentXml).not.toContain("UFCG Dr.");
    expect(documentXml).not.toContain("UFMG Prof.");
  });

  it.skipIf(!hasRealFile)("pre-textuais aparecem antes do sumario quando detectados", async () => {
    const arrayBuffer = fs.readFileSync(REAL_DOCX_PATH);
    const file = new File([arrayBuffer], "Andrade_2025.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const result = await importDocumentFile(file);
    const hasAnyPreTextual =
      (result.fields.agradecimentos || "").trim().length > 0 ||
      (result.fields.indicadoresImpacto || "").trim().length > 0 ||
      (result.fields.impactIndicators || "").trim().length > 0 ||
      (result.fields.listaQuadros || "").trim().length > 0 ||
      (result.fields.listaGraficos || "").trim().length > 0 ||
      (result.fields.listaSiglas || "").trim().length > 0;

    if (!hasAnyPreTextual) {
      expect(true).toBe(true);
      return;
    }

    const generationFields = normalizeFieldsForSelectedModel(result.fields);
    const blob = await templateForWorkType(generationFields.workType).generate({
      fields: generationFields,
      editorText: result.editorText,
      importedImages: result.importedImages,
      importedTables: result.importedTables,
    });

    const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
    const documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";

    const preTextualOrder = [
      "AGRADECIMENTOS",
      "RESUMO",
      "ABSTRACT",
      "INDICADORES DE IMPACTO",
      "IMPACT INDICATORS",
      "LISTA DE QUADROS",
      "LISTA DE GRÁFICOS",
      "LISTA DE SIGLAS",
      "SUMÁRIO",
      "INTRODUÇÃO",
    ];

    const positions = preTextualOrder.map((title) => documentXml.indexOf(title));
    const validPositions = positions.filter((pos) => pos >= 0);

    for (let i = 1; i < validPositions.length; i++) {
      expect(validPositions[i]).toBeGreaterThan(validPositions[i - 1]);
    }
  });

  it.skipIf(!hasRealFile)("import nao classifica documento como patente", async () => {
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

  it.skipIf(!hasRealFile)("bloqueadores finais ficam isolados no fluxo real", async () => {
    const arrayBuffer = fs.readFileSync(REAL_DOCX_PATH);
    const sourceStructure = await extractDocxStructure(arrayBuffer, { includeMediaData: true });
    const file = new File([arrayBuffer], "Andrade_2025.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const result = await importDocumentFile(file);
    const generationFields = normalizeFieldsForSelectedModel(result.fields);
    const blob = await templateForWorkType(generationFields.workType).generate({
      fields: generationFields,
      editorText: result.editorText,
      importedImages: result.importedImages,
      importedTables: result.importedTables,
    });

    const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
    const documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    const text = documentText(documentXml);

    expect(result.fields.agradecimentos).not.toContain("A presente pesquisa teve como objetivo");
    expect(result.fields.resumo).toContain("A presente pesquisa teve como objetivo");
    expect((text.match(/Palavras-chave:/g) ?? []).length).toBe(1);
    expect((text.match(/Keywords:/g) ?? []).length).toBe(1);
    expect(text.split("\n")).not.toContain("Prof.");
    expect(text).toMatch(/Prof\.\s+Dr\.\s+Dany Flavio Tonelli.*Orientador/);

    expect(result.fields.indicadoresImpacto).toContain("Revise manualmente");
    expect(result.fields.impactIndicators).toContain("Revise manualmente");
    expect(result.fields.listaSiglas).toContain("Revise manualmente");
    expect(result.fields.listaQuadros).not.toContain("Fonte:");
    expect(result.fields.listaGraficos).not.toContain("Fonte:");
    expect(result.fields.listaQuadros).not.toContain("Quadro 4 -");
    expect(result.fields.listaGraficos).not.toContain("GrÃ¡fico 12 -");
    expect(result.fields.referencias).not.toContain("Fonte:");
    expect(result.fields.referencias).not.toContain("Quadro ");
    expect(result.fields.referencias).not.toContain("GrÃ¡fico ");

    expect(documentXml).toContain("<w:tbl>");
    expect(text).not.toContain("[Imagem detectada: rId");
    expect(text).not.toContain("[[Imagem importada preservada");
    expect(sourceStructure.images.length).toBeGreaterThan(0);
    if (result.importedImages.length === 0) {
      expect(result.fields.imageWarnings).toContain(`${sourceStructure.images.length} imagem(ns)/grafico(s) detectado(s)`);
      expect(result.fields.imageWarnings).toContain("0 preservado(s) automaticamente");
      expect(result.fields.imageWarnings).toContain("exigem revisao manual");
    }
  });
});
