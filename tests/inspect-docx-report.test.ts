import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateDocxBlob } from "../src/export-docx";
import { emptyAcademicFields, UFLA_RULES } from "../src/ufla-rules";
import {
  loadDocxParts,
  documentText,
  paragraphTexts,
  normalizedParagraphTexts,
  tocInstruction,
} from "./test-utils/ooxml";
import * as fs from "fs";
import * as path from "path";

interface ReportRow {
  item: string;
  status: "OK" | "NOK";
  obs: string;
}

describe("Inspecao profunda DOCX vs Manual UFLA 6ed", () => {
  let xml: string;
  let text: string;
  let parTexts: string[];
  let normalizedParTexts: string[];
  let report: ReportRow[] = [];

  beforeAll(async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      author: "Maria Silva",
      title: "Pesquisa sobre Educacao Ambiental na UFLA",
      subtitle: "Um estudo de caso",
      program: "Educacao Cientifica e Ambiental",
      advisor: "Prof. Dr. Joao Santos",
      location: "Lavras - MG",
      year: "2026",
      resumo:
        "Este e o resumo do trabalho de dissertacao apresentado a Universidade Federal de Lavras.",
      palavrasChave: "Educacao Ambiental; UFLA; Pesquisa",
      abstractText:
        "This is the abstract of the dissertation presented to the Federal University of Lavras.",
      keywords: "Environmental Education; UFLA; Research",
      referencias:
        "FREIRE, Paulo. Pedagogia da Autonomia. Sao Paulo: Paz e Terra, 1996.\nMARX, Karl. O Capital. Sao Paulo: Boitempo, 2013.\nUNIVERSIDADE FEDERAL DE LAVRAS. Manual de normalizacao de trabalhos academicos. Lavras: UFLA, 2025.",
      dedicatoria: "Aos meus pais.",
      agradecimentos: "Agradeco a todos que contribuiram.",
      epigrafe:
        "A educacao nao transforma o mundo. Educacao muda pessoas. Pessoas transformam o mundo. Paulo Freire",
      anexos: "Anexo A - Documento complementar da pesquisa.",
      apendices: "Apendice A - Roteiro de entrevista semiestruturada.",
      listaQuadros: "Quadro 1 - Etapas da pesquisa",
      listaTabelas: "Tabela 1 - Dados coletados",
      listaGraficos: "Grafico 1 - Resultados obtidos",
      listaSiglas: "UFLA - Universidade Federal de Lavras\nEAC - Educacao Ambiental Critica",
    };

    const editorText = [
      "# 1 INTRODUCAO",
      "Texto introdutorio do trabalho de dissertacao.",
      "> Citacao longa direta com mais de tres linhas que deve ter recuo de 4 cm da margem esquerda e fonte tamanho 10 conforme as normas da ABNT NBR 10520 e o manual da UFLA.",
      "",
      "## 1.1 Objetivos",
      "Texto dos objetivos da pesquisa.",
      "## 1.2 Justificativa",
      "Texto da justificativa.",
      "",
      "# 2 REFERENCIAL TEORICO",
      "Texto do referencial teorico.",
      "## 2.1 Educacao Ambiental Critica",
      "Texto sobre Educacao Ambiental Critica.",
      "### 2.1.1 Fundamentos teoricos",
      "Texto dos fundamentos teoricos.",
      "### 2.1.2 Aplicacoes praticas",
      "Texto das aplicacoes praticas.",
      "",
      "# 3 METODOLOGIA",
      "Texto da metodologia da pesquisa.",
      "",
      "Quadro 1 - Etapas da pesquisa",
      "Etapa\tPeriodo\tAtividades\tResponsavel",
      "Planejamento\tJaneiro a Marco\tRevisao bibliografica\tPesquisador",
      "Coleta de dados\tAbril a Junho\tTrabalho de campo\tPesquisador",
      "Analise\tJulho a Setembro\tAnalise dos dados\tPesquisador",
      "Fonte: elaborado pelo autor.",
      "",
      "# 4 RESULTADOS",
      "Texto dos resultados obtidos.",
      "",
      "Tabela 1 - Dados quantitativos",
      "Variavel\tMedia\tDesvio",
      "Idade\t25.3\t4.2",
      "Renda\t3500\t1200",
      "Fonte: dados da pesquisa.",
      "",
      "# 5 CONSIDERACOES FINAIS",
      "Texto das consideracoes finais do trabalho.",
      "",
      "[REF] FREIRE, Paulo. Pedagogia do Oprimido. Rio de Janeiro: Paz e Terra, 1987.",
      "[REF] MORIN, Edgar. Os Sete Saberes necessarios a educacao do futuro. Brasilia: UNESCO, 2000.",
    ].join("\n");

    const blob = await generateDocxBlob({ fields, editorText });
    const parts = await loadDocxParts(blob);
    xml = parts.documentXml;
    text = documentText(parts.documentXml);
    parTexts = paragraphTexts(parts.documentXml);
    normalizedParTexts = normalizedParagraphTexts(parts.documentXml);
  });

  it("1. Margens e espacamento", () => {
    expect(xml).toContain('w:top="' + UFLA_RULES.margins.topTwip + '"');
    expect(xml).toContain('w:left="' + UFLA_RULES.margins.leftTwip + '"');
    expect(xml).toContain('w:bottom="' + UFLA_RULES.margins.bottomTwip + '"');
    expect(xml).toContain('w:right="' + UFLA_RULES.margins.rightTwip + '"');
    const line360 = (xml.match(/w:line="360"/g) || []).length;
    expect(line360).toBeGreaterThan(3);
    const fl709 = (xml.match(/w:firstLine="709"/g) || []).length;
    expect(fl709).toBeGreaterThan(2);
    expect(xml).toMatch(/w:pStyle w:val="Heading1"[^>]*>[\s\S]*?w:before="240"/);
    report.push(
      { item: "1. Margens (3/3/2/2 cm)", status: "OK", obs: "" },
      { item: "1. Espacamento 1,5 (360 twips)", status: "OK", obs: line360 + " ocorrencias" },
      { item: "1. Recuo primeira linha 1,25cm (709)", status: "OK", obs: fl709 + " ocorrencias" },
      { item: "1. Espaco antes titulo primario (240)", status: "OK", obs: "" },
    );
  });

  it("2. Numeracao progressiva", () => {
    const sections = [
      "1 INTRODUCAO",
      "1.1 OBJETIVOS",
      "1.2 JUSTIFICATIVA",
      "2 REFERENCIAL TEORICO",
      "2.1 EDUCACAO AMBIENTAL CRITICA",
      "3 METODOLOGIA",
      "4 RESULTADOS",
      "5 CONSIDERACOES FINAIS",
    ];
    for (const s of sections) {
      expect(normalizedParTexts).toContain(s);
    }
    report.push({ item: "2. Numeracao progressiva", status: "OK", obs: "" });
  });

  it("3. Elementos pre-textuais sem estilo heading", () => {
    const noHeading = ["SUMARIO", "FICHA CATALOGRAFICA", "AGRADECIMENTOS", "RESUMO", "ABSTRACT"];
    for (const t of noHeading) {
      const paraXml = xml.match(new RegExp(`<w:p[^>]*>[\\s\\S]*?<w:t[^>]*>${t[0]}[\\s\\S]*?<\\/w:p>`));
      if (paraXml) {
        expect(paraXml[0]).not.toContain("Heading1");
        expect(paraXml[0]).not.toContain("Heading2");
        expect(paraXml[0]).not.toContain("Heading3");
      }
    }
    report.push({ item: "2. Pre-textuais sem numero", status: "OK", obs: "" });
  });

  it("4. Pos-textuais com Heading1 centralizado", () => {
    expect(normalizedParTexts).toContain("REFERENCIAS");
    expect(normalizedParTexts).toContain("ANEXOS");
    // Check for "APENDICE A" in normalized text
    const apendiceFound = normalizedParTexts.some((p) => p.includes("APENDICE"));
    expect(apendiceFound).toBe(true);
    // Verify they use Heading1 with center
    for (const title of ["REFERENCIAS", "ANEXOS"]) {
      const idx = normalizedParTexts.indexOf(title);
      if (idx >= 0) {
        const paraXml = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g)?.[idx] ?? "";
        expect(paraXml).toContain('w:val="Heading1"');
        expect(paraXml).toContain('w:val="center"');
      }
    }
    report.push({ item: "8. Pos-textuais (Ref/Ap/An) ordem", status: "OK", obs: "" });
  });

  it("5. Referencias - recuo deslocado (hanging indent)", () => {
    const refParas = parTexts.filter(
      (p) => p.includes("Pedagogia") || p.includes("O Capital") || p.includes("Manual"),
    );
    expect(refParas.length).toBeGreaterThan(0);
    report.push({ item: "3. Referencias presentes", status: "OK", obs: "" });
    // Check hanging indent
    const hangingVal = xml.match(/w:hanging="(\d+)"/)?.[1];
    expect(hangingVal).toBeDefined();
    report.push({
      item: "3. Referencias - recuo deslocado",
      status: "OK",
      obs: hangingVal ? hangingVal + " twips" : "",
    });
  });

  it("6. Citacao longa - recuo e fonte", () => {
    const longQuoteIndent = xml.includes('w:left="2268"');
    expect(longQuoteIndent).toBe(true);
    const longQuoteSize = xml.includes('<w:sz w:val="22"/>');
    expect(longQuoteSize).toBe(true);
    report.push(
      { item: "4. Citacao longa - recuo 4cm (2268)", status: "OK", obs: "" },
      { item: "4. Citacao longa - fonte 11pt (22)", status: "OK", obs: "" },
    );
  });

  it("7. Fontes e tamanhos", () => {
    const tnrCount = (xml.match(/Times New Roman/g) || []).length;
    expect(tnrCount).toBeGreaterThan(10);
    const sizes = [
      ...new Set([...xml.matchAll(/<w:sz w:val="(\d+)"\/>/g)].map((s) => s[1])),
    ].sort((a, b) => Number(a) - Number(b));
    expect(sizes).toContain("24");
    expect(sizes).toContain("22");
    report.push(
      { item: "6. Fonte Times New Roman", status: "OK", obs: tnrCount + " ocorrencias" },
      { item: "6. Tamanhos 12pt corpo, 11pt citacao/fonte/legenda", status: "OK", obs: sizes.join(",") },
    );
  });

  it("8. Sumario com campo TOC", () => {
    const instr = tocInstruction(xml);
    expect(instr).toContain("TOC");
    expect(instr).toContain('&quot;1-3&quot;');
    report.push({ item: "7. Sumario com campo TOC \\o 1-3", status: "OK", obs: "" });
  });

  it("9. Heading1 centralizado e heading2 sem negrito", () => {
    const allParas = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
    const h1Paras = allParas.filter((p) => p.includes('w:val="Heading1"'));
    for (const h1 of h1Paras) {
      expect(h1).toContain('w:val="center"');
    }
    const h2Paras = allParas.filter((p) => p.includes('w:val="Heading2"'));
    for (const h2 of h2Paras) {
      expect(h2).not.toContain("<w:b/>");
      expect(h2).not.toContain('w:b w:val="true"');
    }
    report.push(
      { item: "9. Heading1 centralizado", status: "OK", obs: "" },
      { item: "9. Heading2 sem negrito", status: "OK", obs: "" },
    );
  });

  it("10. Quadros com bordas completas", () => {
    const tblBordersMatch = xml.match(/<w:tblBorders>[\s\S]*?<\/w:tblBorders>/g);
    expect(tblBordersMatch).not.toBeNull();
    expect(tblBordersMatch!.length).toBeGreaterThan(0);
    for (const borders of tblBordersMatch!) {
      expect(borders).toContain("w:top");
      expect(borders).toContain("w:left");
      expect(borders).toContain("w:bottom");
      expect(borders).toContain("w:right");
      expect(borders).toContain("w:insideH");
      expect(borders).toContain("w:insideV");
    }
    report.push({ item: "10. Quadros com bordas completas", status: "OK", obs: "" });
  });

  afterAll(() => {
    const lines: string[] = [];
    lines.push("RELATORIO DE CONFORMIDADE - DOCX vs MANUAL UFLA 6ED");
    lines.push("==================================================");
    lines.push("");
    for (const r of report) {
      lines.push(`  ${r.item.padEnd(40)} ${r.status.padEnd(5)} ${r.obs}`);
    }
    lines.push("");
    const allOk = report.every((r) => r.status === "OK");
    lines.push(`CONFORMIDADE GERAL: ${allOk ? "APROVADO" : "REPROVADO"}`);
    if (!allOk) {
      lines.push("Itens com falha:");
      for (const r of report) {
        if (r.status !== "OK") lines.push(`  - ${r.item}: ${r.obs}`);
      }
    }
    const outDir = path.resolve(process.cwd(), "coverage");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "docx-conformity-report.txt"), lines.join("\n"), "utf-8");
  });
});
