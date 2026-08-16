import { describe, it, expect } from "vitest";
import { generateCatalogCard, cutterNumberFromSurname, authorSurname, hasCutterNumber } from "../../src/catalog-card";

const FIELDS = {
  workType: "monografia",
  author: "Maria Aparecida Silva",
  title: "Pesquisa sobre educação ambiental na UFLA",
  subtitle: "um estudo de caso",
  course: "Ciências Biológicas",
  advisor: "Prof. Dr. João Santos",
  coadvisor: "",
  areaConcentracao: "",
  location: "Lavras",
  year: "2026",
  palavrasChave: "Educação ambiental; UFLA; Estudo de caso",
};

describe("cutterNumberFromSurname", () => {
  it("usa o valor da tabela Cutter-Sanborn para Silva (S586) + letra do título", () => {
    expect(cutterNumberFromSurname("Silva", "Pesquisa sobre educação ambiental")).toBe("S586p");
  });

  it("aceita sobrenome composto e ignora partículas", () => {
    expect(authorSurname("João Santos de Souza")).toBe("SOUZA");
    expect(cutterNumberFromSurname("Santos de Souza")).toMatch(/^S\d{2,3}[a-z]?$/);
  });

  it("fallback determinístico mantém o formato [A-Z]\\d{1,4}[a-z]?", () => {
    const c1 = cutterNumberFromSurname("Gonçalves", "Título");
    const c2 = cutterNumberFromSurname("Gonçalves", "Título");
    expect(c1).toMatch(/^[A-Z]\d{1,4}[a-z]?$/);
    expect(c1).toBe(c2); // determinístico
  });

  it("sem título não acrescenta letra", () => {
    expect(cutterNumberFromSurname("Lima")).toBe("L732");
  });
});

describe("generateCatalogCard", () => {
  it("gera ficha com Cutter detectável, autor, título e natureza", () => {
    const card = generateCatalogCard(FIELDS);
    expect(card).toBeTruthy();
    expect(hasCutterNumber(card)).toBe(true);
    expect(card).toMatch(/S586p/);
    expect(card).toMatch(/SILVA, Maria Aparecida/);
    expect(card).toMatch(/Pesquisa sobre educação ambiental na UFLA: um estudo de caso/);
    expect(card).toMatch(/Trabalho de Conclusão de Curso \(Ciências Biológicas\) - Universidade Federal de Lavras, 2026\./);
    expect(card).toMatch(/Orientador: Prof\. Dr\. João Santos/);
  });

  it("inclui descritores numerados das palavras-chave", () => {
    const card = generateCatalogCard(FIELDS);
    expect(card).toMatch(/1\. Educação ambiental\. 2\. UFLA\. 3\. Estudo de caso\./);
  });

  it("retorna vazio sem autor ou título", () => {
    expect(generateCatalogCard({ ...FIELDS, author: "" })).toBe("");
    expect(generateCatalogCard({ ...FIELDS, title: "" })).toBe("");
  });

  it("usa programa quando não há curso (dissertação)", () => {
    const card = generateCatalogCard({ ...FIELDS, workType: "dissertacao", course: "", program: "Educação Científica e Ambiental" });
    expect(card).toMatch(/Dissertação \(Educação Científica e Ambiental\) - Universidade Federal de Lavras, 2026\./);
    expect(card).toMatch(/I\. Título\./);
  });

  it("gerada a partir do mesmo autor/título passa na validação de Cutter do app", () => {
    const card = generateCatalogCard(FIELDS);
    // o validateWork usa hasCutterNumber — garante que a ficha gerada desbloqueia a versão final
    expect(hasCutterNumber(card)).toBe(true);
    expect(card.toUpperCase()).not.toMatch(/INSERIR AQUI A FICHA CATALOGRAFICA/);
  });
});
