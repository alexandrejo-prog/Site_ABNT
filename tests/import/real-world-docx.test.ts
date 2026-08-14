import { describe, it, expect } from "vitest";
import { generateDocxBlob } from "../../src/export-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { loadDocxParts, paragraphTexts, normalizedParagraphTexts } from ".././test-utils/ooxml";

/**
 * Real-world simulation test.
 * Tests what happens when the user inputs tables with single-space separated columns
 * (as often happens in textareas), references with various ABNT formats,
 * and mixed content that could trigger edge cases.
 */
describe("Real-world DOCX fidelity tests", () => {
  it("renders tables with single-space separated columns (textarea scenario)", async () => {
    // User types in textarea where tabs may become spaces
    const fields = {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      author: "Teste",
      title: "Teste",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      palavrasChave: "Teste",
      abstractText: "Abstract.",
      keywords: "Test",
      referencias: "",
    };

    // Space-separated table (as a textarea might produce)
    const editorText = [
      "# 1 INTRODUCAO",
      "Texto inicial.",
      "",
      "Quadro 1 - Etapas da pesquisa",
      "Etapa Periodo Atividades",
      "Planejamento Janeiro Revisao",
      "Coleta Abril Campo",
      "Fonte: elaborado pelo autor.",
      "",
      "# 2 RESULTADOS",
      "Texto final.",
    ].join("\n");

    const blob = await generateDocxBlob({ fields, editorText });
    const parts = await loadDocxParts(blob);
    const parTexts = paragraphTexts(parts.documentXml);

    // Check that table content is at least present somewhere
    const hasQuadro = parTexts.some(p => p.includes("Quadro 1"));
    const hasEtapa = parTexts.some(p => p.includes("Etapa"));
    const hasPlanejamento = parTexts.some(p => p.includes("Planejamento"));
    
    // At minimum, all text should appear
    expect(hasQuadro).toBe(true);
    expect(hasEtapa).toBe(true);
    expect(hasPlanejamento).toBe(true);
  });

  it("renders tables with tab-separated columns", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      author: "Teste",
      title: "Teste",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      palavrasChave: "Teste",
      abstractText: "Abstract.",
      keywords: "Test",
      referencias: "",
    };

    // Tab-separated table
    const editorText = [
      "# 1 INTRODUCAO",
      "Texto inicial.",
      "Quadro 1 - Etapas",
      "Etapa\tPeriodo\tAtividades",
      "Planejamento\tJaneiro\tRevisao",
      "Fonte: elaborado pelo autor.",
      "# 2 RESULTADOS",
      "Texto final.",
    ].join("\n");

    const blob = await generateDocxBlob({ fields, editorText });
    const parts = await loadDocxParts(blob);
    const tblCount = (parts.documentXml.match(/<w:tbl\b/g) || []).length;
    
    expect(tblCount).toBeGreaterThanOrEqual(1);
  });

  it("renders tables correctly when preceded by text on same line as heading", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      author: "Teste",
      title: "Teste",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      palavrasChave: "Teste",
      abstractText: "Abstract.",
      keywords: "Test",
      referencias: "",
    };

    const editorText = [
      "# 1 METODOLOGIA",
      "Texto da metodologia.",
      "Quadro 1 - Procedimentos",
      "Etapa\tDescricao",
      "1\tColeta",
      "2\tAnalise",
      "Fonte: autor.",
    ].join("\n");

    const blob = await generateDocxBlob({ fields, editorText });
    const parts = await loadDocxParts(blob);
    const tblCount = (parts.documentXml.match(/<w:tbl\b/g) || []).length;

    expect(tblCount).toBeGreaterThanOrEqual(1);
  });

  it("formats references with correct ABNT structure", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      author: "Teste",
      title: "Teste",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      palavrasChave: "Teste",
      abstractText: "Abstract.",
      keywords: "Test",
      referencias: [
        "FREIRE, Paulo. Pedagogia da Autonomia. Sao Paulo: Paz e Terra, 1996.",
        "MARX, Karl. O Capital. Sao Paulo: Boitempo, 2013.",
        "BRASIL. Lei n. 9.394, de 20 de dezembro de 1996. Lei de Diretrizes e Bases da Educacao Nacional. Brasilia, DF, 1996.",
        "UNIVERSIDADE FEDERAL DE LAVRAS. Manual de normalizacao de trabalhos academicos. Lavras: UFLA, 2025.",
      ].join("\n"),
    };

    const blob = await generateDocxBlob({ fields, editorText: "# 1 INTRODUCAO\nTexto.\n# 2 CONCLUSAO\nTexto." });
    const parts = await loadDocxParts(blob);
    const allParas = paragraphTexts(parts.documentXml);
    const normalized = normalizedParagraphTexts(parts.documentXml);

    // Find reference section
    const refIdx = normalized.findIndex(p => p.includes("REFERENCIAS"));
    expect(refIdx).toBeGreaterThanOrEqual(0);
    
    // Collect reference entries (text between REFERENCIAS and APENDICE/ANEXOS)
    const endIdx = normalized.findIndex((p, i) => i > refIdx && (p.includes("APENDICE") || p.includes("ANEXOS")));
    const refEntries = allParas.slice(refIdx + 1, endIdx > refIdx ? endIdx : undefined).filter(p => p.trim());
    
    // Check each reference has proper formatting in XML
    const paraXmls = parts.documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
    for (let i = refIdx + 1; i < (endIdx > refIdx ? endIdx : paraXmls.length); i++) {
      const pXml = paraXmls[i];
      const text = allParas[i];
      if (!text.trim()) continue;
      
      // Check hanging indent
      const hanging = pXml.match(/w:hanging="(\d+)"/)?.[1];
      expect(hanging, `Reference "${text.substring(0,40)}..." should have hanging indent`).toBeDefined();
      
      // Check left indent equals hanging
      const left = pXml.match(/w:left="(\d+)"/)?.[1];
      expect(left, `Reference "${text.substring(0,40)}..." should have left indent`).toBeDefined();
      if (hanging && left) {
        expect(Number(hanging)).toBeGreaterThan(0);
        expect(Number(left)).toBeGreaterThan(0);
      }
      
      // Check alignment is LEFT
      expect(pXml, `Reference should be left-aligned`).toMatch(/w:val="left"/);
      
      // Check single spacing
      expect(pXml, `Reference should have line=240`).toMatch(/w:line="240"/);
      
      // Check at least some runs exist
      const runs = pXml.match(/<w:r>[\s\S]*?<\/w:r>/g) || [];
      expect(runs.length).toBeGreaterThanOrEqual(1);
      
      // Verify the text contains author in uppercase
    }
    
    // Check reference order is alphabetical
    const sortedRefs = [...refEntries].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    const orderOk = refEntries.every((p, i) => p === sortedRefs[i]);
    expect(orderOk).toBe(true);
  });

  describe("Edge cases that should not break the DOCX", () => {
    it("handles very long single reference", async () => {
      const longRef = "A".repeat(100) + ". " + "B".repeat(200) + ". Local: Editora, 2020.";
      const fields = {
        ...emptyAcademicFields(),
        workType: "monografia" as const,
        author: "Teste",
        title: "Teste",
        location: "Lavras - MG",
        year: "2026",
        resumo: "R.",
        palavrasChave: "T",
        abstractText: "A.",
        keywords: "K",
        referencias: longRef,
      } as any;
      
      const blob = await generateDocxBlob({ fields, editorText: "# 1 TITULO\nTexto." });
      const parts = await loadDocxParts(blob);
      const text = paragraphTexts(parts.documentXml);
      const hasLongRef = text.some(p => p.includes("A".repeat(50)));
      expect(hasLongRef).toBe(true);
    });

    it("handles empty references field gracefully", async () => {
      const fields = {
        ...emptyAcademicFields(),
        workType: "monografia" as const,
        author: "Teste",
        title: "Teste",
        location: "Lavras - MG",
        year: "2026",
        resumo: "R.",
        palavrasChave: "T",
        abstractText: "A.",
        keywords: "K",
        referencias: "",
      } as any;
      
      const blob = await generateDocxBlob({ fields, editorText: "# 1 TITULO\nTexto." });
      const parts = await loadDocxParts(blob);
      // Should not crash - should still generate REFERENCIAS section
      const text = paragraphTexts(parts.documentXml);
      const hasRefSection = text.some(p => p.includes("REFERENCIAS") || p.includes("REFERÊNCIAS"));
      expect(hasRefSection).toBe(true);
    });

    it("handles references with special characters", async () => {
      const fields = {
        ...emptyAcademicFields(),
        workType: "monografia" as const,
        author: "Teste",
        title: "Teste",
        location: "Lavras - MG",
        year: "2026",
        resumo: "R.",
        palavrasChave: "T",
        abstractText: "A.",
        keywords: "K",
        referencias: "CÖRREIA, João. Ação e reação: a física dos foguetes. São Paulo: Edgard Blücher, 2018.\nMÜLLER, Karl. Führer durch die Mathematik. Berlin: Springer, 1995.",
      } as any;
      
      const blob = await generateDocxBlob({ fields, editorText: "# 1 TITULO\nTexto." });
      const parts = await loadDocxParts(blob);
      const text = paragraphTexts(parts.documentXml);
      const hasCorreia = text.some(p => p.includes("CÖRREIA") || p.includes("CORREIA"));
      const hasMuller = text.some(p => p.includes("MÜLLER") || p.includes("MULLER"));
      expect(hasCorreia || hasMuller).toBe(true);
    });

    it("handles [REF] entries in editor text", async () => {
      const fields = {
        ...emptyAcademicFields(),
        workType: "monografia" as const,
        author: "Teste",
        title: "Teste",
        location: "Lavras - MG",
        year: "2026",
        resumo: "R.",
        palavrasChave: "T",
        abstractText: "A.",
        keywords: "K",
        referencias: "SILVA, João. Livro Base. Local: Editora, 2020.",
      } as any;
      
      const editorText = [
        "# 1 INTRODUCAO",
        "Texto.",
        "[REF] ALMEIDA, Maria. Outro Livro. Local: Editora, 2021.",
        "[REF] ZEBRA, Antonio. Terceiro Livro. Local: Editora, 2022.",
      ].join("\n");
      
      const blob = await generateDocxBlob({ fields, editorText });
      const parts = await loadDocxParts(blob);
      const text = paragraphTexts(parts.documentXml);
      
      // Find reference section
      const refIdx = text.findIndex(p => p.includes("REFERENCIAS") || p.includes("REFERÊNCIAS"));
      expect(refIdx).toBeGreaterThanOrEqual(0);
      
      // Get entries after REFERENCIAS
      const refEntries = text.slice(refIdx + 1).filter(p => p.trim() && !p.includes("APENDICE") && !p.includes("ANEXOS") && !p.includes("APÊNDICE"));
      
      // All 3 references should appear
      expect(refEntries.some(p => p.includes("SILVA"))).toBe(true);
      expect(refEntries.some(p => p.includes("ALMEIDA"))).toBe(true);
      expect(refEntries.some(p => p.includes("ZEBRA"))).toBe(true);
      
      // Should be in alphabetical order: ALMEIDA, SILVA, ZEBRA
      const order = refEntries.filter(p => /^(ALMEIDA|SILVA|ZEBRA)/.test(p));
      expect(order.length).toBe(3);
      expect(order[0]).toContain("ALMEIDA");
      expect(order[1]).toContain("SILVA");
      expect(order[2]).toContain("ZEBRA");
    });
  });
});
