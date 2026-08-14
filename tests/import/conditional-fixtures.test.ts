import { it, expect } from "vitest";
import JSZip from "jszip";
import { readFileSync } from "node:fs";
import { describeWithArtifacts } from "../test-utils/artifact-guard";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");
const fixturesDir = join(root, "artifacts", "ufla-compliance", "fixtures");

function countFootnoteReferences(xml: string): number {
  const matches = xml.match(/<w:footnoteReference\b[^>]*>/g);
  return matches ? matches.length : 0;
}

describeWithArtifacts(
  "Fixtures condicionais — validação OOXML",
  [
    "ufla-compliance/fixtures/fixture-monografia-anexo-referencias.docx",
    "ufla-compliance/fixtures/fixture-artigo-referencias-rodape.docx",
    "ufla-compliance/fixtures/fixture-projeto-notas.docx",
    "ufla-compliance/fixtures/fixture-fonte-tabela.docx",
    "ufla-compliance/fixtures/fixture-fonte-ilustracao.docx",
  ],
  () => {

  it("monografia com anexo contendo referências deve gerar notas de rodapé", async () => {
    const data = readFileSync(join(fixturesDir, "fixture-monografia-anexo-referencias.docx"));
    const zip = await JSZip.loadAsync(data);
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain("ANEXO");
    expect(countFootnoteReferences(xml)).toBeGreaterThan(0);
    const footnotes = await zip.file("word/footnotes.xml")?.async("string");
    expect(footnotes).toBeTruthy();
    expect(footnotes).toContain("SILVA");
    expect(footnotes).toContain("SOUZA");
  });

  it("artigo com referências no rodapé deve gerar notas de rodapé e não seção de referências", async () => {
    const data = readFileSync(join(fixturesDir, "fixture-artigo-referencias-rodape.docx"));
    const zip = await JSZip.loadAsync(data);
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(countFootnoteReferences(xml)).toBeGreaterThan(0);
    const footnotes = await zip.file("word/footnotes.xml")?.async("string");
    expect(footnotes).toBeTruthy();
    expect(footnotes).toContain("SILVA");
    expect(footnotes).toContain("SOUZA");
    expect(xml).not.toContain("REFERÊNCIAS");
  });

  it("projeto de pesquisa com notas deve conter footnotes", async () => {
    const data = readFileSync(join(fixturesDir, "fixture-projeto-notas.docx"));
    const zip = await JSZip.loadAsync(data);
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain("footnote");
    const footnotes = await zip.file("word/footnotes.xml")?.async("string");
    expect(footnotes).toBeTruthy();
  });

  it("fixture com fonte de tabela deve separar legenda e fonte", async () => {
    const data = readFileSync(join(fixturesDir, "fixture-fonte-tabela.docx"));
    const zip = await JSZip.loadAsync(data);
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain("Fonte:");
  });

  it("fixture com fonte de ilustração deve separar legenda e fonte", async () => {
    const data = readFileSync(join(fixturesDir, "fixture-fonte-ilustracao.docx"));
    const zip = await JSZip.loadAsync(data);
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain("Fonte:");
  });
});
