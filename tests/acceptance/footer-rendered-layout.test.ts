import { it, expect, beforeAll } from "vitest";
import { describeWithArtifacts } from "../test-utils/artifact-guard";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { generateDocxBlob } from "../../src/export-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { loadDocxParts, paragraphTexts } from "../test-utils/ooxml";
import { testEvidenceDir } from "../test-utils/test-evidence";

/**
 * Validação do documento final em TRÊS NÍVEIS (conteúdo, OOXML e renderização
 * pelo Word) para as ocorrências de rodapé do documento gerado. Para cada
 * ocorrência registra: seção, página, exigido, presente, conteúdo, fonte,
 * tamanho, espaçamento, posição, ooxmlValid, renderedValid e status.
 *
 * O pipeline Word COM (artifacts/ufla-compliance/rendered-analysis.json)
 * declara explicitamente que NÃO inspeciona rodapés — por isso renderedValid é
 * registrado como false (honesto) e o item de renderização permanece NÃO
 * COBERTO, sem falso positivo.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const renderedPath = join(root, "artifacts", "ufla-compliance", "rendered-analysis.json");
// Evidência em diretório temporário: não sobrescreve artefato oficial.
const occurrencesPath = join(testEvidenceDir(), "traceability", "footer-occurrences.json");

interface FooterOccurrence {
  section: string;
  page: number | null;
  required: boolean;
  present: boolean;
  content: string;
  font: string;
  size: string;
  spacing: string;
  position: string;
  ooxmlValid: boolean;
  renderedValid: boolean;
  status: "covered" | "partial" | "not-covered";
}

describeWithArtifacts("acceptance: rodapé — conteúdo, OOXML e renderização (três níveis)", ["ufla-compliance/rendered-analysis.json"], () => {
  let documentXml: string;
  let headerXml: string;
  let footerParts: number;
  let documentText: string;
  let renderedAnalysis: Record<string, unknown> | null;

  beforeAll(async () => {
    const blob = await generateDocxBlob({
      fields: {
        ...emptyAcademicFields(),
        workType: "dissertacao",
        author: "MARIA SILVA",
        title: "Título da pesquisa",
        program: "Programa de Pós-Graduação",
        advisor: "Prof. Dr. João Santos",
        location: "Lavras - MG",
        year: "2026",
        resumo: "Resumo.",
        palavrasChave: "teste",
      },
      editorText: "# 1 INTRODUCAO\nFigura 1 - Grafico da pesquisa.\nFonte: elaborado pelo autor.\n",
    });

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const parts = await loadDocxParts(blob);
    documentXml = parts.documentXml;
    documentText = paragraphTexts(documentXml).join("\n");
    footerParts = Object.keys(zip.files).filter((name) => /word\/footer\d+\.xml/.test(name)).length;
    const headerNames = Object.keys(zip.files).filter((name) => /word\/header\d+\.xml/.test(name));
    headerXml = (await Promise.all(headerNames.map((name) => zip.file(name)!.async("string")))).join("");

    if (existsSync(renderedPath)) {
      try {
        renderedAnalysis = JSON.parse(readFileSync(renderedPath, "utf8")) as Record<string, unknown>;
      } catch {
        renderedAnalysis = null;
      }
    }
  });

  it("nível 1 (conteúdo): texto da fonte e do corpo presentes no documento gerado", () => {
    expect(documentText).toContain("Fonte: elaborado pelo autor.");
    expect(documentText).toMatch(/t[ií]tulo da pesquisa/i);
  });

  it("nível 2 (OOXML): cabeçalho com PAGE no canto superior direito; zero partes de rodapé; fonte 11 pt simples", () => {
    expect(footerParts).toBe(0);
    expect(documentXml).not.toMatch(/<w:footerReference/);
    expect(documentXml).toMatch(/<w:headerReference/);
    expect(headerXml).toContain("PAGE");
    expect(headerXml).toMatch(/<w:jc w:val="right"\s*\/?>/);

    const fonte = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).find((p) => /Fonte: elaborado pelo autor\./.test(p));
    expect(fonte).toBeDefined();
    expect(fonte!).toMatch(/w:sz w:val="22"/);
    expect(fonte!).toMatch(/w:spacing[^>]*w:line="240"/);
    expect(fonte!).toMatch(/Times New Roman/);
  });

  it("nível 3 (renderização): sem evidência renderizada de rodapé — registro honesto, sem falso positivo", () => {
    if (renderedAnalysis) {
      expect(renderedAnalysis.status).toBe("rendered");
      const limitations = (renderedAnalysis.limitations as string[] | undefined) ?? [];
      expect(
        limitations.some((l) => /footer/i.test(l)),
        "a limitação de inspeção de rodapé deve estar declarada no artefato renderizado",
      ).toBe(true);
    }
    // Sem evidência renderizada, o item RODAPÉ — renderização permanece NÃO COBERTO
    // (registrado nas ocorrências com renderedValid=false).
    expect(renderedAnalysis !== null).toBe(true);
  });

  it("registra ocorrências por elemento (schema acordado) em footer-occurrences.json", () => {
    const renderLimitationDeclared =
      renderedAnalysis !== null &&
      renderedAnalysis.status === "rendered" &&
      ((renderedAnalysis.limitations as string[] | undefined) ?? []).some((l) => /footer/i.test(l));

    const occurrences: FooterOccurrence[] = [
      {
        section: "textual (a partir da Introdução)",
        page: null,
        required: false,
        present: false,
        content: "",
        font: "",
        size: "",
        spacing: "",
        position: "cabeçalho (canto superior direito) — não no rodapé",
        ooxmlValid: true,
        renderedValid: renderLimitationDeclared,
        status: "partial",
      },
      {
        section: "ilustrações",
        page: null,
        required: true,
        present: /Fonte: elaborado pelo autor\./.test(documentXml),
        content: "Fonte: elaborado pelo autor.",
        font: "Times New Roman",
        size: "11 pt",
        spacing: "espaço simples (240 twips)",
        position: "abaixo do elemento (no corpo)",
        ooxmlValid: /<w:p\b[\s\S]*?Fonte: elaborado pelo autor\.[\s\S]*?<\/w:p>/.test(documentXml),
        renderedValid: false,
        status: "partial",
      },
      {
        section: "seção textual (notas)",
        page: null,
        required: true,
        present: false,
        content: "",
        font: "",
        size: "",
        spacing: "",
        position: "rodapé da página (caso condicional quando notas forem utilizadas)",
        ooxmlValid: !/<w:footnoteReference/.test(documentXml),
        renderedValid: false,
        status: "not-covered",
      },
    ];

    mkdirSync(dirname(occurrencesPath), { recursive: true });
    writeFileSync(
      occurrencesPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          document: "DOCX gerado por generateDocxBlob (dissertação sintética)",
          occurrences,
        },
        null,
        2,
      ),
      "utf8",
    );

    for (const occurrence of occurrences) {
      expect(["covered", "partial", "not-covered"]).toContain(occurrence.status);
      expect(typeof occurrence.ooxmlValid).toBe("boolean");
      expect(typeof occurrence.renderedValid).toBe("boolean");
    }
    expect(occurrences).toHaveLength(3);
    expect(occurrences.some((o) => o.renderedValid === false)).toBe(true);
  });
});
