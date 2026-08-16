import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { FOOTER_RULES, FOOTER_SPECIFIC_ITEMS, classifyFooterUsage } from "../../src/footer-rules";
import { generateDocxBlob } from "../../src/export-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { loadDocxParts } from "../test-utils/ooxml";

/**
 * Regressão de rodapé — testes NEGATIVOS. Devem falhar se:
 *   - uma regra obrigatória for removida ou esvaziada;
 *   - rodapé for inserido na seção errada ou em tipo sem necessidade;
 *   - rodapé/cabeçalho contiver conteúdo de outro documento;
 *   - fonte estiver com tamanho/espaçamento incorretos;
 *   - rodapé ou cabeçalho duplicado aparecer;
 *   - a classificação condicional sofrer falso negativo.
 */

const REQUIRED_RULE_IDS = ["UFLA-FOOTER-001", "UFLA-FOOTER-002", "UFLA-FOOTER-003", "UFLA-FOOTER-004", "UFLA-FOOTER-005", "UFLA-FOOTER-006", "UFLA-FOOTER-007", "UFLA-FOOTER-008"];

const REQUIRED_FIELDS: (keyof (typeof FOOTER_RULES)[number])[] = [
  "id",
  "rule",
  "appliesToWorkTypes",
  "appliesToSections",
  "requiredWhen",
  "font",
  "size",
  "spacing",
  "alignment",
  "position",
  "severity",
  "source",
];

describe("regression: rodapé — invariantes negativos", () => {
  it("remover regra obrigatória de rodapé quebra o conjunto (anti-remoção)", () => {
    const ids = FOOTER_RULES.map((r) => r.id);
    expect(ids, "conjunto de regras de rodapé incompleto (regra removida?)").toEqual(REQUIRED_RULE_IDS);
  });

  it("esvaziar campo obrigatório de regra quebra o teste (anti-esvaziamento)", () => {
    for (const rule of FOOTER_RULES) {
      for (const field of REQUIRED_FIELDS) {
        const value = rule[field];
        if (typeof value === "string") {
          expect(value.trim().length, `regra ${rule.id}: '${field}' vazio`).toBeGreaterThan(0);
        } else {
          expect((value as unknown[]).length, `regra ${rule.id}: '${field}' vazio`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("remover item específico do checklist quebra o conjunto (anti-remoção de item)", () => {
    const ids = FOOTER_SPECIFIC_ITEMS.map((i) => i.id);
    for (const required of [
      "rodape-dissertacao",
      "rodape-tese",
      "rodape-monografia",
      "rodape-artigo",
      "rodape-projeto-pesquisa",
      "rodape-notas",
      "rodape-fontes-legendas",
      "rodape-renderizacao",
    ]) {
      expect(ids, `item específico removido: ${required}`).toContain(required);
    }
  });

  it("falso negativo na classificação condicional quebra o teste", () => {
    expect(classifyFooterUsage("dissertacao", "textual", "nota").pageFooterRequired, "nota marcada como sem rodapé").toBe(true);
    expect(classifyFooterUsage("dissertacao", "textual", "pagina").pageFooterRequired, "paginação marcada no rodapé").toBe(false);
    expect(classifyFooterUsage("tese", "anexos", "referencia-anexo").pageFooterRequired, "referência de anexo sem opção de nota").toBe(true);
    expect(classifyFooterUsage("monografia", "tabelas", "tabela").pageFooterRequired, "fonte de tabela marcada como rodapé de página").toBe(false);
  });

  it("rodapé não exigido não é inserido indevidamente (nenhum tipo)", async () => {
    for (const workType of ["monografia", "dissertacao", "tese", "artigo", "projeto_pesquisa"] as const) {
      const fields = {
        ...emptyAcademicFields(),
        workType,
        author: "MARIA SILVA",
        title: "Título",
        resumo: "Resumo.",
        palavrasChave: "teste",
        year: "2026",
        ...(workType === "artigo" ? { referencias: "SILVA, M. Título. Revista, 2024." } : {}),
      };
      const blob = await generateDocxBlob({ fields, editorText: "" });
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const parts = await loadDocxParts(blob);
      expect(Object.keys(zip.files).filter((name) => /word\/footer\d+\.xml/.test(name)), `${workType}: rodapé indevido`).toEqual([]);
      expect(parts.documentXml).not.toMatch(/<w:footerReference/);
    }
  });

  it("cabeçalho e rodapé não duplicados no DOCX gerado", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      author: "MARIA SILVA",
      title: "Título",
      program: "Programa",
      advisor: "Prof. Dr. João Santos",
      resumo: "Resumo.",
      palavrasChave: "teste",
      year: "2026",
    };
    const blob = await generateDocxBlob({ fields, editorText: "# 1 INTRODUCAO\nTexto.\n" });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const parts = await loadDocxParts(blob);

    const headerNames = Object.keys(zip.files).filter((name) => /word\/header\d+\.xml/.test(name));
    const headerReferences = (parts.documentXml.match(/<w:headerReference/g) ?? []).length;
    expect(headerNames, "cabeçalho duplicado").toHaveLength(1);
    expect(headerReferences, "referência de cabeçalho duplicada").toBe(1);
    expect(Object.keys(zip.files).filter((name) => /word\/footer\d+\.xml/.test(name))).toEqual([]);
  });

  it("cabeçalho sem conteúdo estranho de outro documento (apenas campo PAGE)", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      author: "MARIA SILVA",
      title: "Título",
      program: "Programa",
      advisor: "Prof. Dr. João Santos",
      resumo: "Resumo.",
      palavrasChave: "teste",
      year: "2026",
    };
    const blob = await generateDocxBlob({ fields, editorText: "# 1 INTRODUCAO\nTexto.\n" });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const headerNames = Object.keys(zip.files).filter((name) => /word\/header\d+\.xml/.test(name));
    const headerXml = (await Promise.all(headerNames.map((name) => zip.file(name)!.async("string")))).join("");

    expect(headerXml).toContain("PAGE");
    const staticText = [...headerXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("").trim();
    expect(staticText, "cabeçalho com texto estático estranho").toBe("");
  });

  it("fonte de figura com tamanho ou espaçamento incorretos quebra o teste", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      author: "MARIA SILVA",
      title: "Título",
      program: "Programa",
      advisor: "Prof. Dr. João Santos",
      resumo: "Resumo.",
      palavrasChave: "teste",
      year: "2026",
    };
    const blob = await generateDocxBlob({
      fields,
      editorText: "# 1 INTRODUCAO\nFigura 1 - Grafico.\nFonte: elaborado pelo autor.\n",
    });
    const parts = await loadDocxParts(blob);
    const fonteParagraphs = (parts.documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).filter((p) => /Fonte: elaborado pelo autor\./.test(p));

    expect(fonteParagraphs, "'Fonte:' duplicado ou ausente").toHaveLength(1);
    const fonte = fonteParagraphs[0];
    expect(fonte).toMatch(/w:sz w:val="22"/);
    expect(fonte).not.toMatch(/w:sz w:val="24"/);
    expect(fonte).toMatch(/w:spacing[^>]*w:line="240"/);
    expect(fonte).not.toMatch(/w:spacing[^>]*w:line="360"/);
  });

  it("gate: nota de rodapé da entrada não pode desaparecer da saída (UFLA-FOOTER-001)", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      author: "MARIA SILVA",
      title: "Título",
      program: "Programa",
      advisor: "Prof. Dr. João Santos",
      resumo: "Resumo.",
      palavrasChave: "teste",
      year: "2026",
    };
    const blob = await generateDocxBlob({
      fields,
      editorText: "# 1 INTRODUCAO\nTexto com nota.[^1]\n\n[^1]: Nota de rodapé preservada na saída.\n",
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const parts = await loadDocxParts(blob);
    const footnotesXml = (await zip.file("word/footnotes.xml")?.async("string")) ?? "";

    const notePresent = /<w:footnote\b(?![^>]*w:type="(?:separator|continuationSeparator)")[\s\S]*?Nota de rodapé preservada na saída\./.test(footnotesXml);
    expect(notePresent, "UFLA-FOOTER-001 não implementada: nota de rodapé da entrada não apareceu na saída.").toBe(true);
    expect(parts.documentXml, "UFLA-FOOTER-001 não implementada: marcador da nota ausente no corpo").toMatch(/<w:footnoteReference w:id="1"/);
  });

  it("gate: marcador sem definição não vira nota fantasma; definição sem chamada não gera marcador", async () => {
    const blob = await generateDocxBlob({
      fields: {
        ...emptyAcademicFields(),
        workType: "dissertacao" as const,
        author: "MARIA SILVA",
        title: "Título",
        program: "Programa",
        advisor: "Prof. Dr. João Santos",
        resumo: "Resumo.",
        palavrasChave: "teste",
        year: "2026",
      },
      editorText: "# 1 INTRODUCAO\nMarcador sem nota.[^9]\n\n[^2]: Definição sem chamada.\n",
    });
    const parts = await loadDocxParts(blob);

    // [^9] não tem definição → permanece como texto literal (não vira referência).
    expect(parts.documentXml).toContain("[^9]");
    // A definição [^2] gera nota real em footnotes.xml mesmo sem chamada (conteúdo preservado).
    const zip = await JSZip.loadAsync(await (await generateDocxBlob({
      fields: {
        ...emptyAcademicFields(),
        workType: "dissertacao" as const,
        author: "MARIA SILVA",
        title: "Título",
        program: "Programa",
        advisor: "Prof. Dr. João Santos",
        resumo: "Resumo.",
        palavrasChave: "teste",
        year: "2026",
      },
      editorText: "# 1 INTRODUCAO\nMarcador sem nota.[^9]\n\n[^2]: Definição sem chamada.\n",
    })).arrayBuffer());
    const footnotesXml = (await zip.file("word/footnotes.xml")?.async("string")) ?? "";
    expect(footnotesXml).toContain("Definição sem chamada.");
    expect(parts.documentXml).not.toContain("[^2]");
  });

  it("gate: fonte de tabela preservada abaixo do elemento e NÃO convertida em nota (UFLA-FOOTER-006)", async () => {
    const blob = await generateDocxBlob({
      fields: {
        ...emptyAcademicFields(),
        workType: "dissertacao" as const,
        author: "MARIA SILVA",
        title: "Título",
        program: "Programa",
        advisor: "Prof. Dr. João Santos",
        resumo: "Resumo.",
        palavrasChave: "teste",
        year: "2026",
      },
      editorText: "# 1 INTRODUCAO\nTabela 1 - Dados da pesquisa.\n\nCol A | Col B\n--- | ---\n1 | 2\n\nFonte: elaborado pelo autor.\n",
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const parts = await loadDocxParts(blob);
    const footnotesXml = (await zip.file("word/footnotes.xml")?.async("string")) ?? "";

    expect(parts.documentXml, "UFLA-FOOTER-006 não implementada: fonte da tabela não foi preservada").toContain("Fonte: elaborado pelo autor.");
    // Fonte é parágrafo no corpo (document.xml), NÃO nota de rodapé (footnotes.xml).
    expect(footnotesXml).not.toContain("Fonte: elaborado pelo autor.");
    // Posição: depois da tabela (w:tbl), nunca antes.
    const tableIndex = parts.documentXml.indexOf("<w:tbl>");
    const fonteIndex = parts.documentXml.indexOf("Fonte: elaborado pelo autor.");
    expect(tableIndex, "tabela ausente no DOCX").toBeGreaterThan(-1);
    expect(fonteIndex).toBeGreaterThan(tableIndex);
    expect(parts.documentXml.indexOf("Fonte: elaborado pelo autor.")).toBeGreaterThan(parts.documentXml.lastIndexOf("</w:tbl>"));
  });

  it("gate: fonte de ilustração preservada abaixo do elemento e NÃO convertida em nota (UFLA-FOOTER-007)", async () => {
    const blob = await generateDocxBlob({
      fields: {
        ...emptyAcademicFields(),
        workType: "dissertacao" as const,
        author: "MARIA SILVA",
        title: "Título",
        program: "Programa",
        advisor: "Prof. Dr. João Santos",
        resumo: "Resumo.",
        palavrasChave: "teste",
        year: "2026",
      },
      editorText: "# 1 INTRODUCAO\nFigura 1 - Grafico da pesquisa.\nFonte: elaborado pelo autor.\n",
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const parts = await loadDocxParts(blob);
    const footnotesXml = (await zip.file("word/footnotes.xml")?.async("string")) ?? "";

    expect(parts.documentXml, "UFLA-FOOTER-007 não implementada: fonte da ilustração não foi preservada").toContain("Fonte: elaborado pelo autor.");
    expect(footnotesXml).not.toContain("Fonte: elaborado pelo autor.");
    const captionIndex = parts.documentXml.indexOf("Figura 1 - Grafico da pesquisa.");
    const fonteIndex = parts.documentXml.indexOf("Fonte: elaborado pelo autor.");
    expect(captionIndex).toBeGreaterThan(-1);
    expect(fonteIndex).toBeGreaterThan(captionIndex);
  });
});
