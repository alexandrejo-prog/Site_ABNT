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
  const wordToolbar = readFileSync(join(process.cwd(), "src", "word-toolbar.css"), "utf8");
  const uxFixes = readFileSync(join(process.cwd(), "src", "ux-fixes.css"), "utf8");
  const ruler = readFileSync(join(process.cwd(), "src", "components", "EditorRuler.tsx"), "utf8");
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

  it("ribbon tem aba Página Inicial e grupos compactos", () => {
    expect(app).toContain("word-ribbon-tab");
    expect(app).toContain("Página Inicial");
    expect(app).toContain("Área de Transferência");
    expect(app).toContain("Espaçamento");
    expect(app).toContain('data-group="Fonte"');
    expect(app).toContain('data-group="Parágrafo"');
  });

  it("seletores de fonte são visuais e desabilitados", () => {
    expect(app).toContain("Times New Roman");
    expect(app).toContain("FontSelector");
  });

  it("régua é componente funcional, mostra valores e não usa pseudo-elemento CSS", () => {
    expect(app).toContain("EditorRuler");
    expect(ruler).toContain("editor-ruler-controls");
    expect(ruler).toContain("Passo: 0,25 cm por clique");
    expect(ruler).toContain("Primeira linha:");
    expect(ruler).toContain("Recuo esquerdo:");
    expect(ruler).toContain("Recuo direito:");
    expect(ruler).toContain("formatCm(values.firstLine)");
    expect(ruler).toContain("formatCm(values.left)");
    expect(ruler).toContain("formatCm(values.right)");
    expect(ruler).toContain("editor-ruler-indent-marker first-line");
    expect(ruler).toContain("editor-ruler-indent-marker left-indent");
    expect(ruler).toContain("editor-ruler-indent-marker right-indent");
    expect(wordToolbar).toContain(".editor-ruler-controls");
    expect(wordToolbar).toContain(".editor-ruler-indent-marker");
    expect(uxFixes).not.toContain(".editor-toolbar-sticky::after");
  });
  it("botão de referência bibliográfica não usa REF isolado", () => {
    expect(app).toContain("Marcar como referência bibliográfica");
    expect(app).toContain("Marca o parágrafo como referência bibliográfica para a seção REFERÊNCIAS do DOCX.");
    expect(app).toContain('glyph="Ref. ABNT"');
    expect(app).not.toContain('glyph="REF"');
  });

  it("editor tem paginação visual aproximada fora do contenteditable", () => {
    expect(app).toContain('className="editor-page-stack"');
    expect(app).toContain('className="editor-page-shell"');
    expect(app).toContain("Paginação visual aproximada");
    const editorMarkup = readFileSync(join(process.cwd(), "src", "editor-markup.ts"), "utf8");
    expect(editorMarkup).not.toContain("Paginação visual aproximada");
    expect(editorMarkup).not.toContain("editor-page-stack");
  });

  it("paginação visual aproximada tem navegação e não corta o conteúdo", () => {
    expect(app).toContain('className="editor-pagination-toolbar"');
    expect(app).toContain('className="editor-page-viewport"');
    expect(app).toContain("Página anterior");
    expect(app).toContain("Próxima página");
    expect(app).toContain('aria-label="Ir para a página visual anterior"');
    expect(app).toContain('aria-label="Ir para a próxima página visual"');
    expect(app).toContain('title="Paginação visual aproximada do editor; a paginação final depende do Word/LibreOffice."');
    expect(app).toContain("Página {currentPage} de {totalPages}");
    expect(wordToolbar).toContain(".editor-pagination-toolbar");
    expect(wordToolbar).toContain(".editor-page-viewport");
    expect(wordToolbar).toContain("overflow-y: auto");
    expect(wordToolbar).not.toContain("overflow: hidden");
    expect(app).toContain('disabled={currentPage <= 1}');
    expect(app).toContain('disabled={currentPage >= totalPages}');
  });

  it("paginação visual não insere marcadores dentro do editorText", () => {
    expect(app).not.toContain("[PAGE]");
    expect(app).not.toContain("[QUEBRA DE PÁGINA]");
    expect(app).not.toContain("PageBreak");
    const editorMarkup = readFileSync(join(process.cwd(), "src", "editor-markup.ts"), "utf8");
    expect(editorMarkup).not.toContain("Página anterior");
    expect(editorMarkup).not.toContain("Próxima página");
    expect(editorMarkup).not.toContain("Página 1 de");
    expect(editorMarkup).not.toContain("[PAGE]");
    expect(editorMarkup).not.toContain("[QUEBRA DE PÁGINA]");
  });
});
