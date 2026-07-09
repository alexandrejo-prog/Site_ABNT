import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("interface estática", () => {
  const app = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
  const sidebar = readFileSync(join(process.cwd(), "src", "components", "ValidationSidebar.tsx"), "utf8");
  const importBlock = readFileSync(join(process.cwd(), "src", "components", "ImportBlock.tsx"), "utf8");
  const workTypeSelector = readFileSync(join(process.cwd(), "src", "components", "WorkTypeSelector.tsx"), "utf8");
  const adherence = readFileSync(join(process.cwd(), "src", "components", "AdherencePanel.tsx"), "utf8");
  const styles = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
  const combined = `${app}\n${sidebar}\n${adherence}`;
  const uiComponents = `${importBlock}\n${workTypeSelector}`;

  it("mantém regiões nomeadas para revisão", () => {
    expect(combined).toContain('aria-label="Campos acadêmicos"');
    expect(combined).toContain('aria-label="Editor do texto"');
    expect(combined).toContain('aria-label="Validação"');
  });

  it("bloco de importação aparece no topo com título e explicação", () => {
    expect(uiComponents).toContain("Importar arquivo existente");
    expect(uiComponents).toContain("Importe DOCX, TXT ou Markdown para extrair texto e metadados. Revise tudo antes de gerar.");
    expect(uiComponents).toContain('type="file"');
    expect(uiComponents).toContain('accept=".docx,.txt,.md"');
  });

  it("seletor de tipo de trabalho organiza tipos em grupos", () => {
    expect(uiComponents).toContain("Trabalhos acadêmicos longos");
    expect(uiComponents).toContain("Projeto");
    expect(uiComponents).toContain("Artigos e CPG");
    expect(uiComponents).toContain("Coleção Produção Acadêmica UFLA");
    expect(uiComponents).toContain("Outros");
  });

  it("mantém avisos anunciáveis", () => {
    expect(combined).toContain('aria-live="polite"');
    expect(combined).toContain('role="alert"');
    expect(combined).toContain('role="status"');
  });

  it("mantém breakpoints para tablet e celular", () => {
    expect(styles).toContain("@media (max-width: 1180px)");
    expect(styles).toContain("@media (max-width: 780px)");
    expect(styles).toContain("min-width: 320px");
  });

  it("mantém foco visível para navegação por teclado", () => {
    expect(styles).toContain("button:focus-visible");
    expect(styles).toContain(".rich-editor:focus");
    expect(styles).toContain("outline:");
  });

  it("orienta atualização do sumário no Word/LibreOffice", () => {
    expect(app).toContain("Atualizar o índice inteiro");
    expect(app).toContain("Ctrl+A e F9");
    expect(app).toContain("Ferramentas");
    expect(app).toContain("Atualizar tudo");
  });

  it("botão de geração usa linguagem de rascunho editável", () => {
    expect(app).toContain("Gerar DOCX editável");
    expect(app).not.toContain("Gerar versão final");
  });

  it("mensagem pós-geração orienta atualização no Word/LibreOffice", () => {
    expect(app).toContain("Rascunho gerado. Abra no Word/LibreOffice, atualize o sumário e substitua campos provisórios antes da submissão.");
    expect(app).toContain("DOCX gerado. Se o sumário aparecer vazio, atualize os campos no Word/LibreOffice. Isso é esperado.");
  });
});
