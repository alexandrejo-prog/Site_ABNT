import { describe, expect, it } from "vitest";
import { importDocumentFile } from "../src/import-docx";
import { normalizeFieldsForSelectedModel } from "../src/work-type-field-normalizer";
import { templateForWorkType } from "../src/document-template";
import { extractDocxStructure } from "../src/word-structure-extractor";
import { documentText } from "./test-utils/ooxml";
import JSZip from "jszip";
import fs from "fs";

const REAL_DOCX_PATH = "_diagnostico/andrade-2025/Andrade_2025.docx";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
    const listEntries = result.fields.listaQuadros.split("\n").filter((line) => /^Quadro \d+/i.test(line));
    expect(listEntries.length).toBeGreaterThanOrEqual(3);
    expect(listEntries.some((line) => /^Quadro 1 -/.test(line))).toBe(true);
    expect(listEntries.some((line) => /^Quadro 2 -/.test(line))).toBe(true);
    expect(listEntries.some((line) => /^Quadro 3 -/.test(line))).toBe(true);
    expect(listEntries.some((line) => /^Quadro 16 -/.test(line))).toBe(true);
    expect(result.fields.listaQuadros).not.toContain("Fonte:");
    expect(result.fields.listaGraficos).not.toContain("Fonte:");
    expect(result.fields.listaGraficos).not.toContain("GrÃ¡fico 12 -");
    expect(result.fields.referencias).not.toContain("Fonte:");
    expect(result.fields.referencias).not.toContain("Quadro ");
    expect(result.fields.referencias).not.toContain("GrÃ¡fico ");

    const firstReferenceLine = result.fields.referencias.split(/\n+/).map((line) => line.trim()).find(Boolean) ?? "";
    expect(firstReferenceLine).not.toMatch(/^1995\.\s+Se/);
    expect(firstReferenceLine).not.toMatch(/^(Fonte:|Quadro|Grafico|â€“ aprimorar|â€“ as modalidades|\(4,4%\))/);
    const sectionOneIndex = result.fields.referencias.indexOf("1995. Se");
    if (sectionOneIndex >= 0) {
      expect(result.fields.referencias.indexOf("BRASIL. Decreto")).toBeGreaterThanOrEqual(0);
      expect(result.fields.referencias.indexOf("BRASIL. Decreto")).toBeLessThan(sectionOneIndex);
    }
    const textReferencesStart = text.lastIndexOf("REFERÃŠNCIAS");
    const textReferencesSection = textReferencesStart >= 0 ? text.slice(textReferencesStart) : text;
    expect(textReferencesSection).not.toMatch(/REFERÃŠNCIAS\s+1995\.\s+Se/);

    expect(documentXml).toContain("<w:tbl>");
    expect(text).not.toContain("[Imagem detectada: rId");
    expect(text).not.toContain("[[Imagem importada preservada");
    expect(text).not.toContain("[[Tabela importada preservada");
    expect(sourceStructure.images.length).toBeGreaterThan(0);
    const preservedCount = result.importedImages.filter((image) => image.status === "preserved").length;
    expect(result.fields.imageWarnings).toContain(
      `${sourceStructure.images.length} imagem(ns)/grafico(s) detectado(s) no DOCX original`,
    );
    expect(result.fields.imageWarnings).toContain(`${preservedCount} preservado(s) automaticamente`);
    expect(result.fields.imageWarnings).toContain("exigem revisao manual");
    expect(result.fields.imageWarnings).toContain("Revise e reinsira manualmente");
    expect(result.fields.imageWarnings).toContain("Graficos/imagens do corpo podem ter sido deslocados");
  });

  it.skipIf(!hasRealFile)("Quadro 2 nao tem sequencia longa de celulas vazias", async () => {
    const arrayBuffer = fs.readFileSync(REAL_DOCX_PATH);
    const file = new File([arrayBuffer], "Andrade_2025.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const result = await importDocumentFile(file);
    const quadro2 = result.importedTables.find((t) => /Quadro\s+2\b/i.test(t.caption || ""));

    if (!quadro2) {
      expect(true).toBe(true);
      return;
    }

    for (const row of quadro2.rows) {
      let emptyStreak = 0;
      for (const cell of row) {
        if (!cell.text.trim()) {
          emptyStreak += 1;
        } else {
          emptyStreak = 0;
        }
        if (emptyStreak > 3) {
          throw new Error(`Quadro 2 tem sequencia longa de celulas vazias: ${JSON.stringify(row)}`);
        }
      }
    }
  });

  it.skipIf(!hasRealFile)("Quadro 5 e Quadro 6 tem estrutura logica de 3 colunas sem coluna fantasma", async () => {
    const arrayBuffer = fs.readFileSync(REAL_DOCX_PATH);
    const file = new File([arrayBuffer], "Andrade_2025.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const result = await importDocumentFile(file);
    const quadro5 = result.importedTables.find((t) => /Quadro\s+5\b/i.test(t.caption || ""));
    const quadro6 = result.importedTables.find((t) => /Quadro\s+6\b/i.test(t.caption || ""));

    if (!quadro5 && !quadro6) {
      expect(true).toBe(true);
      return;
    }

    if (quadro5) {
      expect(quadro5.status).not.toBe("rendered-as-structured-text");
      expect(quadro5.columnCount).toBe(3);
      expect(quadro5.groupColumnIndex).toBe(0);
      expect(quadro5.groupSpans?.length).toBeGreaterThanOrEqual(1);
      const texts = quadro5.groupSpans?.map((s) => s.text) ?? [];
      expect(texts).toEqual(
        expect.arrayContaining(["Organização", "Trabalhador"]),
      );
      expect(quadro5.rows[0].map((c) => c.text)).toEqual(
        expect.arrayContaining(["Vantagens", "Autores"]),
      );
      expect(quadro5.hasReconstructedVerticalMerge).toBe(true);
    }

    if (quadro6) {
      expect(quadro6.status).not.toBe("rendered-as-structured-text");
      expect(quadro6.columnCount).toBe(3);
      expect(quadro6.rows[0].map((c) => c.text)).toEqual(
        expect.arrayContaining(["Organização", "Pontos críticos", "Autores"]),
      );
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

    if (quadro5) {
      expect(documentXml).toContain("<w:tbl>");
      expect(documentXml).toContain("Organização");
      expect(documentXml).toContain("Trabalhadores");
      expect(documentXml).toContain("Vantagens");
      expect(documentXml).toContain("Autores");
    }

    if (quadro6) {
      expect(documentXml).toContain("<w:tbl>");
      expect(documentXml).toContain("Pontos críticos");
      expect(documentXml).toContain("Autores");
    }
  });

  it.skipIf(!hasRealFile)("Quadro 5 e Quadro 6 seguem regra geral e geram XML com 3 colunas úteis, sem coluna vazia e sem duplicar legenda/fonte", async () => {
    const arrayBuffer = fs.readFileSync(REAL_DOCX_PATH);
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
    expect(documentXml.length).toBeGreaterThan(0);

    // 1. O fluxo real não quebra se o arquivo local existir.
    expect(result.importedTables.length).toBeGreaterThan(0);

    const quadro5 = result.importedTables.find((t) => /Quadro\s+5\b/i.test(t.caption || ""));
    const quadro6 = result.importedTables.find((t) => /Quadro\s+6\b/i.test(t.caption || ""));
    expect(quadro5).toBeDefined();
    expect(quadro6).toBeDefined();

    // 2/3/4/11. Tratados por regra geral de tabela agrupada (padrão estrutural, não pelo nº do quadro).
    for (const quadro of [quadro5!, quadro6!]) {
      expect(quadro.renderMode).toBe("semantic-reconstructed-table");
      expect(quadro.reconstructedTable?.pattern).toMatch(/^(grouped-with-authors|advantages-disadvantages|critical-points)$/);
      expect(quadro.caption).toMatch(/Quadro\s+[56]\b/i);
      expect(quadro.status).not.toBe("detected-but-layout-fragile");
    }

    // 12. Nunca exporta tabela quebrada: reconstrução com confiança baixa vira texto estruturado ou revisão manual.
    for (const t of result.importedTables) {
      if (t.renderMode === "semantic-reconstructed-table") {
        expect(t.reconstructionConfidence).not.toBe("low");
      }
      const fragile = t.status === "detected-but-layout-fragile" || t.reconstructionConfidence === "low";
      if (fragile) {
        expect(["structured-text", "manual-review"]).toContain(t.renderMode);
      }
    }

    const tblMatches = [...documentXml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)];
    const parseHeader = (raw: string): string[] => {
      const firstRow = raw.match(/<w:tr>([\s\S]*?)<\/w:tr>/);
      if (!firstRow) return [];
      return [...firstRow[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).map((s) => s.trim());
    };

    const quadro5Tbl = tblMatches.find((m) => {
      const h = parseHeader(m[1]);
      return h[0] === "Grupo" && h[1] === "Vantagens" && h[2] === "Autores";
    });
    const quadro6Tbl = tblMatches.find((m) => {
      const h = parseHeader(m[1]);
      return h[0] === "Grupo" && h[1] === "Pontos críticos" && h[2] === "Autores";
    });

    // 5/6. Quadro 5 e Quadro 6 geram w:tbl com 3 colunas úteis no XML final.
    expect(quadro5Tbl, "Quadro 5 deve gerar w:tbl").toBeDefined();
    expect(quadro6Tbl, "Quadro 6 deve gerar w:tbl").toBeDefined();

    for (const [label, tbl] of [["Quadro 5", quadro5Tbl], ["Quadro 6", quadro6Tbl]] as const) {
      const raw = tbl![0];
      const gridCols = (raw.match(/<w:gridCol\b/g) ?? []).length;
      // 5/6. w:tbl com 3 colunas úteis.
      expect(gridCols, `${label} deve ter 3 colunas`).toBe(3);
      const header = parseHeader(raw);
      expect(header.length, `${label} cabeçalho com 3 colunas`).toBe(3);
      // 7/8. Não há coluna vazia final: última coluna (Autores) tem conteúdo em linhas de dados.
      const rows = [...raw.matchAll(/<w:tr>([\s\S]*?)<\/w:tr>/g)];
      const lastColCells = rows.slice(1).map((r) => {
        const cells = [...r[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).map((s) => s.trim());
        return cells[cells.length - 1] ?? "";
      });
      expect(lastColCells.some((c) => c.length > 0), `${label} coluna final não deve ser vazia`).toBe(true);
    }

    // 9/10. Legenda e fonte aparecem uma vez (rótulo da tabela, sem duplicação).
    const caption5 = quadro5!.caption ?? "";
    const source5 = quadro5!.source ?? "";
    expect((documentXml.match(new RegExp(escapeRegExp(caption5), "g")) ?? []).length, "legenda Quadro 5 aparece uma vez").toBe(1);
    expect((documentXml.match(new RegExp(escapeRegExp(source5), "g")) ?? []).length, "fonte Quadro 5 aparece uma vez").toBe(1);
  });
});
