import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { importDocumentFile } from "../src/import-docx";

const TMP_DIR = join(process.cwd(), "tmp");

interface ExpectedPretextual {
  file: string;
  author: string;
  titleContains: string;
  advisor: string;
  program?: string;
  coadvisor?: string;
}

// Valores conferidos contra os PDFs reais de benchmark (não sintéticos).
const CASES: ExpectedPretextual[] = [
  {
    file: "DISSERTACAO_Redes e propriedade intelectual ....pdf",
    author: "NIVALDO OLIVEIRA",
    titleContains: "REDES E PROPRIEDADE INTELECTUAL",
    advisor: "Prof. Dr. Luiz Marcelo Antonialli",
    program: "Administração",
  },
  {
    file: "DISSERTAÇÃO_Política pública de acesso aberto à produção científica o caso do Repositório Institucional da Universidade Federal de Lavras.pdf",
    author: "SIMONE ASSIS MEDEIROS",
    titleContains: "POLÍTICA PÚBLICA DE ACESSO ABERTO",
    advisor: "Profª Dra Patrícia Aparecida Ferreira",
  },
  {
    file: "Tese Texto completo.pdf",
    author: "LUÍS OTÁVIO PELOSO SILVESTRE",
    titleContains: "PEIXES COMO SENTINELAS",
    advisor: "Prof. Dr. Paulo dos Santos Pompeu",
    program: "Ecologia Aplicada",
  },
  {
    file: "Tese1 exto completo.pdf",
    author: "JULIANA CRISTINA DOS REIS CANAAN",
    titleContains: "EFEITOS DOS TREINAMENTOS AERÓBIO",
    advisor: "Prof. Dr. Luciano José Pereira",
    program: "Ciências Veterinárias",
    coadvisor: "Prof. Dr. Eric Francelino de Andrade",
  },
  {
    file: "Texto completo2.pdf",
    author: "LUIZ DAVID COSTA SILVA",
    titleContains: "ESTUDO SOBRE INTERFERÔMETRO",
    advisor: "Prof. Dr. Jefferson Esquina Tsuchida",
    program: "Física",
  },
  {
    file: "Texto completo3.pdf",
    author: "JULIA APARECIDA RODRIGUES SILVA",
    titleContains: "EFEITOS DA EXPOSIÇÃO DIGITAL",
    advisor: "Profa. Dra. Jéssica Ferreira Rodrigues",
    program: "Nutrição e Saúde",
    coadvisor: "Profa. Dra. Katiúcia Alves Amorim",
  },
  {
    file: "Texto completo4.pdf",
    author: "MARIA EDUARDA SOUZA DOS REIS",
    titleContains: "EDUCAÇÃO FÍSICA",
    advisor: "Prof. Dr. Alessandro Teodoro Bruzi",
    program: "Educação",
  },
];

describe("auditoria de campos pretextuais de PDFs reais da UFLA", () => {
  for (const expected of CASES) {
    it(`extrai corretamente os campos pretextuais de "${expected.file}"`, async () => {
      const path = join(TMP_DIR, expected.file);
      expect(existsSync(path), `PDF de benchmark ausente: ${expected.file}`).toBe(true);

      const buffer = readFileSync(path);
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
      const file = new File([arrayBuffer], expected.file, { type: "application/pdf" });
      const result = await importDocumentFile(file);

      expect(result.sourceKind).toBe("pdf");
      expect(result.fields.author.trim().toUpperCase()).toBe(expected.author);
      expect(result.fields.title.toUpperCase()).toContain(expected.titleContains);
      expect(result.fields.title.trim().length, "título não pode ser omitido silenciosamente").toBeGreaterThan(10);
      expect(
        /título de mestre|para a obtenção|apresentada à/i.test(result.fields.title),
        "título não deve vazar natureza ou nome de orientadora",
      ).toBe(false);

      expect(result.fields.advisor).toBe(expected.advisor);
      expect(result.fields.advisor.startsWith("Orientador"), "advisor não deve conter o rótulo").toBe(false);
      expect(result.fields.advisor.startsWith("**"), "advisor não deve conter markdown").toBe(false);

      if (expected.coadvisor !== undefined) {
        expect(result.fields.coadvisor, "coorientador não deve ser perdido").toBe(expected.coadvisor);
      }

      if (expected.program !== undefined) {
        expect(result.fields.program.trim()).toBe(expected.program);
      }
      expect(
        result.fields.program.toUpperCase().startsWith("**NATUREZA"),
        "program não deve conter a natureza inteira",
      ).toBe(false);
      expect(
        result.fields.program.includes("apresentada à"),
        "program não deve conter o texto da natureza",
      ).toBe(false);

      expect(
        /[–—]/.test(result.fields.location),
        "local não deve vazar hífen especial (en/em dash)",
      ).toBe(false);

      expect(Array.isArray(result.fields.approvalMembers)).toBe(true);
      for (const member of result.fields.approvalMembers) {
        expect(member.startsWith("**"), "approvalMembers não deve conter markdown").toBe(false);
        expect(member.trim().length).toBeGreaterThan(0);
      }
    }, 120_000);
  }

  it("detecta imagens reais nos PDFs e avisa explicitamente quando não as reconstrói", async () => {
    const prev = process.env.PDF_FIGURE_RASTERIZE;
    process.env.PDF_FIGURE_RASTERIZE = "0";
    try {
      const file = "DISSERTACAO_Redes e propriedade intelectual ....pdf";
      const path = join(TMP_DIR, file);
      const buffer = readFileSync(path);
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
      const result = await importDocumentFile(new File([arrayBuffer], file, { type: "application/pdf" }));

      const totalImages = result.pdfDiagnostic
        ? result.pdfDiagnostic.pages.reduce((sum, page) => sum + (page.imageCount || 0), 0)
        : 0;

      expect(totalImages, "o PDF real possui imagens/figuras que o pipeline deve contar").toBeGreaterThan(0);
      expect(result.fields.imageWarnings, "deve haver aviso explícito de imagens não reconstruídas").toBeTruthy();
      expect(result.fields.imageWarnings.toLowerCase()).toContain("imag");
    } finally {
      process.env.PDF_FIGURE_RASTERIZE = prev as string | undefined;
    }
  }, 120_000);

  it("diferencia aviso de tabelas do aviso de imagens e admite não reconstrução", async () => {
    const file = "Texto completo4.pdf";
    const path = join(TMP_DIR, file);
    const buffer = readFileSync(path);
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    const result = await importDocumentFile(new File([arrayBuffer], file, { type: "application/pdf" }));

    expect(result.fields.imageWarnings.toLowerCase()).toContain("imag");
    expect(result.fields.imageWarnings.toLowerCase()).toContain("tabela");
    expect(
      /NÃO (RECONSTR|PRESERV)|PARCIALMENTE PRESERV|PRESERVADAS/i.test(result.fields.imageWarnings),
      "aviso deve admitir explicitamente perda, preservação parcial ou preservação total de conteúdo",
    ).toBe(true);
    expect(result.importedImages.length, "figuras do corpo do PDF são detectadas (legenda)").toBeGreaterThan(0);
    expect(
      result.importedImages.every((i) => i.status === "preserved" && (i.data?.byteLength ?? 0) > 100),
      "figuras detectadas são rasterizadas de fato (Chromium disponível neste ambiente)",
    ).toBe(true);
  }, 120_000);

  it("reconstrói tabelas do corpo do PDF como tabelas reais no DOCX (reconstrução mínima verificável)", async () => {
    const file = "Texto completo4.pdf";
    const path = join(TMP_DIR, file);
    const buffer = readFileSync(path);
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    const result = await importDocumentFile(new File([arrayBuffer], file, { type: "application/pdf" }));

    expect(result.importedTables.length, "deve haver tabelas reconstruídas do PDF").toBeGreaterThan(0);
    const { generateDocxBlob } = await import("../src/export-docx");
    const blob = await generateDocxBlob({
      fields: result.fields,
      editorText: result.editorText,
      importedImages: result.importedImages,
      importedTables: result.importedTables,
    });
    const JSZip = await import("jszip");
    const zip = await JSZip.default.loadAsync(await blob.arrayBuffer());
    const doc = (await zip.file("word/document.xml")?.async("string")) || "";

    const tableCount = (doc.match(/<w:tbl>/g) || []).length;
    expect(tableCount, "DOCX deve conter elementos <w:tbl> reais vindo do PDF").toBe(result.importedTables.length);

    const first = result.importedTables[0];
    expect(first.caption, "tabela reconstruída deve preservar a legenda").toBeTruthy();
    expect(first.rowCount, "tabela reconstruída deve ter linhas").toBeGreaterThan(1);
    expect(
      result.importedTables.every((t) => t.status === "preserved"),
      "tabelas reconstruídas devem estar marcadas como preservadas",
    ).toBe(true);
  }, 120_000);

  it("leva título e orientador corretos para o DOCX exportado", async () => {
    const file = "Texto completo3.pdf";
    const path = join(TMP_DIR, file);
    const buffer = readFileSync(path);
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    const result = await importDocumentFile(new File([arrayBuffer], file, { type: "application/pdf" }));

    const { generateDocxBlob } = await import("../src/export-docx");
    const blob = await generateDocxBlob({
      fields: result.fields,
      editorText: result.editorText,
      importedImages: result.importedImages,
      importedTables: result.importedTables,
    });
    const JSZip = await import("jszip");
    const zip = await JSZip.default.loadAsync(await blob.arrayBuffer());
    const doc = (await zip.file("word/document.xml")?.async("string")) || "";

    expect(doc.includes(result.fields.title.slice(0, 12)), "título deve aparecer no DOCX").toBe(true);
    expect(
      doc.includes(result.fields.advisor.split(" ").slice(-2).join(" ")),
      "orientador deve aparecer no DOCX",
    ).toBe(true);
    expect(
      /<w:drawing>|<w:pic>|<a:blip>/.test(doc),
      "DOCX agora reconstrói imagens do PDF via rasterização (Chromium)",
    ).toBe(true);
  }, 120_000);

  it("insere aviso de rascunho incompleto no prórprio DOCX quando há perda visual (Frente 1)", async () => {
    const prev = process.env.PDF_FIGURE_RASTERIZE;
    process.env.PDF_FIGURE_RASTERIZE = "0";
    try {
      const file = "DISSERTACAO_Redes e propriedade intelectual ....pdf";
      const path = join(TMP_DIR, file);
      const buffer = readFileSync(path);
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
      const result = await importDocumentFile(new File([arrayBuffer], file, { type: "application/pdf" }));

    const { generateDocxBlob } = await import("../src/export-docx");
    const blob = await generateDocxBlob({
      fields: result.fields,
      editorText: result.editorText,
      importedImages: result.importedImages,
      importedTables: result.importedTables,
    });
    const JSZip = await import("jszip");
    const zip = await JSZip.default.loadAsync(await blob.arrayBuffer());
    const doc = (await zip.file("word/document.xml")?.async("string")) || "";

    expect(doc, "DOCX deve carregar aviso interno de rascunho incompleto").toContain("RASCUNHO INCOMPLETO");
    expect(doc.toLowerCase()).toContain("pdf");
    expect(doc.toLowerCase()).toContain("imag");
    expect(doc.toLowerCase()).toContain("tabela");
    expect(doc.toLowerCase()).toContain("revis");
    } finally {
      process.env.PDF_FIGURE_RASTERIZE = prev as string | undefined;
    }
  }, 120_000);

  it("não insere aviso de rascunho quando não há perda relevante (ausência indevida)", async () => {
    const file = "Texto completo4.pdf";
    const path = join(TMP_DIR, file);
    const buffer = readFileSync(path);
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    const result = await importDocumentFile(new File([arrayBuffer], file, { type: "application/pdf" }));
    // Remove explicitamente o aviso de perda para simular documento sem risco.
    result.fields.imageWarnings = "";

    const { generateDocxBlob } = await import("../src/export-docx");
    const blob = await generateDocxBlob({
      fields: result.fields,
      editorText: result.editorText,
      importedImages: result.importedImages,
      importedTables: result.importedTables,
    });
    const JSZip = await import("jszip");
    const zip = await JSZip.default.loadAsync(await blob.arrayBuffer());
    const doc = (await zip.file("word/document.xml")?.async("string")) || "";
    expect(doc, "sem perda relevante não deve haver selo de rascunho").not.toContain("RASCUNHO INCOMPLETO");
  }, 120_000);

  it("reduz fragmentação de colunas e não confunde figuras com tabelas (Frente 2 + R5.3)", async () => {
    // completo2: só tem legendas de FIGURA; portanto NÃO deve virar tabela,
    // mas as figuras devem ser detectadas como ilustrações.
    const file2 = "Texto completo2.pdf";
    const buf2 = readFileSync(join(TMP_DIR, file2));
    const ab2 = buf2.buffer.slice(buf2.byteOffset, buf2.byteOffset + buf2.byteLength) as ArrayBuffer;
    const res2 = await importDocumentFile(new File([ab2], file2, { type: "application/pdf" }));
    expect(res2.importedImages.length, "completo2 deve detectar figuras (legendas Figura X)").toBeGreaterThan(0);
    expect(res2.importedTables.length, "completo2 não tem TABELA/QUADRO: 0 tabelas").toBe(0);

    // completo4: tabelas reais (TABELA/QUADRO) reconstruídas, sem fragmentação absurda.
    const file4 = "Texto completo4.pdf";
    const buf4 = readFileSync(join(TMP_DIR, file4));
    const ab4 = buf4.buffer.slice(buf4.byteOffset, buf4.byteOffset + buf4.byteLength) as ArrayBuffer;
    const res4 = await importDocumentFile(new File([ab4], file4, { type: "application/pdf" }));
    expect(res4.importedTables.length, "completo4 deve reconstruir tabelas reais").toBeGreaterThan(0);
    expect(
      res4.importedTables.every((t) => t.columnCount <= 20),
      "nenhuma tabela reconstruída deve ter fragmentação absurda de colunas",
    ).toBe(true);
  }, 120_000);

  it("R5: detecta figuras do PDF sem convertê-las em tabelas e reflete perdas no banner", async () => {
    const file = "DISSERTACAO_Redes e propriedade intelectual ....pdf";
    const path = join(TMP_DIR, file);
    const buffer = readFileSync(path);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const result = await importDocumentFile(new File([arrayBuffer], file, { type: "application/pdf" }));

    expect(result.importedImages.length, "deve detectar figuras (legenda Figura/Imagem/etc.)").toBeGreaterThan(0);
    expect(
      result.importedImages.every((f) => /FIGURA|IMAGEM|ESQUEMA|FLUXOGRAMA|GR[AÁ]FICO/i.test(f.caption || "")),
      "toda figura detectada deve ter legenda de ilustração",
    ).toBe(true);
    expect(result.importedTables.length, "figuras NÃO devem virar tabelas (R5.3)").toBeLessThan(result.importedImages.length);
    expect(
      result.importedImages.every((i) => i.status === "preserved" && (i.data?.byteLength ?? 0) > 100),
      "figuras devem ser preservadas (rasterizadas) no ambiente com Chromium",
    ).toBe(true);

    const { generateDocxBlob } = await import("../src/export-docx");
    const blob = await generateDocxBlob({
      fields: result.fields,
      editorText: result.editorText,
      importedImages: result.importedImages,
      importedTables: result.importedTables,
    });
    const JSZip = await import("jszip");
    const zip = await JSZip.default.loadAsync(await blob.arrayBuffer());
    const doc = (await zip.file("word/document.xml")?.async("string")) || "";
    expect(
      doc.toLowerCase(),
      "DOCX deve conter as imagens rasterizadas (drawings/pic) quando preservadas",
    ).toContain("graphic");
    // O selo de rascunho só aparece quando há perda parcial/total; com preservação
    // parcial ele PODE aparecer. Isso é coberto pelo teste da Frente 1 (rasterização desligada).
  }, 120_000);

  it("R6: tabelas reconstruídas carregam larguras proporcionais e mesclagem vertical detectada", async () => {
    const file = "Texto completo4.pdf";
    const path = join(TMP_DIR, file);
    const buffer = readFileSync(path);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const result = await importDocumentFile(new File([arrayBuffer], file, { type: "application/pdf" }));

    expect(result.importedTables.length, "deve haver tabelas reconstruídas").toBeGreaterThan(0);
    const withWidths = result.importedTables.filter(
      (t) => Array.isArray(t.estimatedColumnWidths) && t.estimatedColumnWidths.length === t.columnCount,
    );
    expect(withWidths.length, "tabelas devem ter larguras de coluna proporcionais").toBe(result.importedTables.length);
    const mergeTotal = result.importedTables.reduce((s, t) => s + (t.cellMerges?.length || 0), 0);
    expect(mergeTotal, "deve detectar alguma mesclagem vertical").toBeGreaterThan(0);
  }, 120_000);
});
