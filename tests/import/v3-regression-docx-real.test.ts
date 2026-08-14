import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { writeFileSync, unlinkSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { generateDocxBlob } from "../../src/export-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { analyzeDocx } from "../../skills/ufla-docx-compliance/src/docx-analyzer";
import { checkCompliance } from "../../skills/ufla-docx-compliance/src/checklist-checker";
import type { AcademicFields } from "../../src/ufla-rules";

const LOGO = new Uint8Array(Buffer.from("logo-placeholder", "utf8"));
const dir = mkdtempSync(join(tmpdir(), "site-abnt-v3-"));
const DOCX = join(dir, "monografia-real.docx");

function baseFields(): AcademicFields {
  const f = emptyAcademicFields();
  f.workType = "monografia" as never;
  f.author = "MARIA SILVA";
  f.title = "PESQUISA SOBRE NORMALIZACAO";
  f.subtitle = "um estudo aplicado";
  f.location = "LAVRAS - MG";
  f.year = "2026";
  f.advisor = "Prof. Dr. Joao";
  f.course = "Ciencia da Computacao";
  f.resumo = "Este resumo possui uma quantidade suficiente de palavras para se situar dentro da faixa usual de extensao de textos academicos conforme os parametros do manual de normalizacao da universidade.";
  f.palavrasChave = "normalizacao; DOCX; UFLA";
  f.abstractText = "This abstract has a sufficient number of words to sit within the usual length range according to the university normalization manual parameters.";
  f.keywords = "normalization; DOCX; UFLA";
  f.referencias = "SILVA, M. Normalizacao academica. Lavras: UFLA, 2026.";
  f.apendices = "APENDICE A - Instrumento\nTexto.";
  f.anexos = "ANEXO A - Portaria\nTexto.";
  return f;
}

const editorText = `
# 1 Introducao

Texto academico para validacao DOCX real.

# 2 Desenvolvimento

[[Tabela importada preservada: tabela1]]
Fonte: Pesquisa propria (2026).

# 3 Conclusao

Conclusao do estudo.
`;

const importedTables = [
  {
    id: "tabela1",
    caption: "Tabela 1 - Dados de Validacao",
    source: "Fonte: Pesquisa propria (2026).",
    rowCount: 2,
    columnCount: 2,
    rows: [
      [{ text: "Item" }, { text: "Valor" }],
      [{ text: "Margem" }, { text: "3 cm" }],
    ],
    hasGridSpan: false,
    hasVerticalMerge: false,
    status: "preserved" as const,
    position: 1,
    origin: "docx-table" as const,
  },
];

beforeAll(async () => {
  const blob = await generateDocxBlob({ fields: baseFields(), editorText, importedTables, logo: { data: LOGO, width: 265, height: 108 } });
  writeFileSync(DOCX, Buffer.from(await blob.arrayBuffer()));
});

afterAll(() => {
  try {
    unlinkSync(DOCX);
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* noop */
  }
});

describe("regressao DOCX-real (checklist v3 - C.1/C.2/C.3/C.5/C.7)", () => {
  let analysis: Awaited<ReturnType<typeof analyzeDocx>>;

  it("gera DOCX e o analisador o le sem erro", async () => {
    analysis = await analyzeDocx(DOCX);
    expect(analysis.paragraphCount).toBeGreaterThan(0);
  });

  it("C.1 - A4 e margens corroboradas", () => {
    expect(analysis.page.widthTwip).toBe(11906);
    expect(analysis.page.heightTwip).toBe(16838);
    expect(Math.abs(analysis.page.marginTopCm - 3)).toBeLessThan(0.1);
    expect(Math.abs(analysis.page.marginLeftCm - 3)).toBeLessThan(0.1);
    expect(Math.abs(analysis.page.marginBottomCm - 2)).toBeLessThan(0.1);
  });

  it("C.2 - capa gera autor e titulo", () => {
    expect(analysis.cover.exists).toBe(true);
    expect(analysis.cover.authorUppercase).toBe(true);
    expect(analysis.cover.titleUppercase).toBe(true);
  });

  it("C.5 - listas e sumario presentes", () => {
    expect(analysis.summary.exists).toBe(true);
    expect(analysis.summary.headingCentered).toBe(true);
  });

  it("checkCompliance(monografia) nao reprova (58 ok / 0 falha)", () => {
    const items = checkCompliance(analysis, "monografia");
    const fail = items.filter((i) => i.status === "fail");
    const ok = items.filter((i) => i.status === "ok");
    expect(fail).toHaveLength(0);
    expect(ok.length).toBe(58);
  });
});