import { describe, expect, it } from "vitest";
import { buildPreviewHtml } from "../../src/preview-html";
import { emptyAcademicFields, type AcademicFields } from "../../src/ufla-rules";

function baseFields(overrides: Partial<AcademicFields> = {}): AcademicFields {
  return {
    ...emptyAcademicFields(),
    workType: "monografia",
    author: "Maria Silva",
    title: "Qualidade do cafe no sul de Minas",
    location: "Lavras - MG",
    year: "2026",
    course: "Bacharelado em Biologia",
    advisor: "Prof. Dr. Joao Silva",
    workNature: "Monografia apresentada a Universidade Federal de Lavras.",
    resumo: "Resumo do trabalho.",
    palavrasChave: "cafe; qualidade",
    abstractText: "Abstract text.",
    keywords: "coffee; quality",
    referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
    ...overrides,
  };
}

const EDITOR_TEXT = [
  "# 1 Introducao",
  "Texto comum.",
  "> Citação longa de exemplo com recuo de quatro centimetros.",
  "## 1.1 Contexto",
  "Texto.",
  "Tabela 1 - Resultados das analises",
  "Fonte: elaborado pelo autor (2026).",
  "# 2 Metodologia",
  "Texto.",
].join("\n");

function previewFor(fields: AcademicFields = baseFields(), editorText = EDITOR_TEXT): string {
  return buildPreviewHtml({ fields, editorText });
}

describe("buildPreviewHtml - fidelidade estrutural", () => {
  it("Gera uma página A4 para cada elemento pré-textual obrigatório", () => {
    const html = previewFor();
    expect(html).toContain("preview-page");
    expect(html).toContain("preview-cover");
    expect(html).toContain("preview-title-page");
  });

  it("Inclui capa com autor, título e local/ano", () => {
    const html = previewFor();
    expect(html).toContain("MARIA SILVA");
    expect(html).toContain("QUALIDADE DO CAFE NO SUL DE MINAS");
    expect(html).toContain("LAVRAS - MG");
    expect(html).toContain("2026");
  });

  it("Inclui folha de rosto com natureza, curso, orientador, local e ano", () => {
    const html = previewFor();
    expect(html).toContain("Monografia apresentada a Universidade Federal de Lavras.");
    expect(html).toContain("Curso: Bacharelado em Biologia");
    expect(html).toContain("Orientador(a): Prof. Dr. Joao Silva");
    expect(html).toContain("2026");
  });

  it("Inclui Resumo e Abstract em páginas separadas", () => {
    const html = previewFor();
    const resumoIndex = html.indexOf(">RESUMO<");
    const abstractIndex = html.indexOf(">ABSTRACT<");
    expect(resumoIndex).toBeGreaterThan(-1);
    expect(abstractIndex).toBeGreaterThan(resumoIndex);
  });

  it("Inclui palavras-chave e keywords com prefixo em negrito", () => {
    const html = previewFor();
    expect(html).toContain("<strong>Palavras-chave: </strong>");
    expect(html).toContain("<strong>Keywords: </strong>");
    expect(html).toContain("cafe; qualidade");
    expect(html).toContain("coffee; quality");
  });

  it("Gera sumário apenas quando há títulos, referências, apêndices ou anexos", () => {
    const html = previewFor(baseFields(), "# 1 Introducao\nTexto.\n");
    expect(html).toContain("SUMÁRIO");

    const withoutSummary = previewFor(baseFields({ referencias: "" }), "Texto sem títulos.\n");
    expect(withoutSummary).not.toContain("SUMÁRIO");
  });

  it("Sumário fica dentro de uma página branca (preview-page), não sobre o fundo escuro do modal", () => {
    const html = previewFor(baseFields(), "# 1 Introducao\nTexto.\n");
    const summaryIndex = html.indexOf("preview-summary-block");
    expect(summaryIndex).toBeGreaterThan(-1);
    const pageStart = html.lastIndexOf('<section class="preview-page', summaryIndex);
    const pageEnd = html.indexOf("</section>", summaryIndex);
    expect(pageStart).toBeGreaterThan(-1);
    expect(pageEnd).toBeGreaterThan(summaryIndex);
    expect(html.slice(pageStart, pageEnd)).toContain("SUMÁRIO");
  });

  it("Lista entradas do sumário na ordem do texto (nível 1 em negrito)", () => {
    const html = previewFor();
    expect(html).toContain("1 INTRODUCAO");
    expect(html).toContain("1.1 Contexto");
    expect(html).toContain("REFERÊNCIAS");
  });

  it("Entradas do sumário têm número de página calculado à direita com dot leader", () => {
    const html = previewFor();
    expect(html).toContain("preview-summary-leader");
    const pagePattern = /preview-summary-page">\d+<\/span>/;
    expect(html).toMatch(pagePattern);
    const intro = html.match(/1 INTRODUCAO<\/span><span class="preview-summary-leader"[^>]*><\/span><span class="preview-summary-page">(\d+)<\/span>/);
    expect(intro).not.toBeNull();
    const introPage = Number(intro![1]);
    const refs = html.match(/REFERÊNCIAS<\/span><span class="preview-summary-leader"[^>]*><\/span><span class="preview-summary-page">(\d+)<\/span>/);
    expect(refs).not.toBeNull();
    expect(Number(refs![1])).toBeGreaterThan(introPage);
  });

  it("Números de página do sumário iniciam após os pré-textuais (corpo não começa na página 1)", () => {
    const html = previewFor(baseFields(), "# 1 Introducao\nTexto.\n");
    const pages = [...html.matchAll(/preview-summary-page">(\d+)<\/span>/g)].map((m) => Number(m[1]));
    expect(pages.length).toBeGreaterThan(0);
    expect(Math.min(...pages)).toBeGreaterThan(1);
  });

  it("Paginação real por altura: conteúdo longo espalha seções por mais páginas", () => {
    const longPara = Array.from({ length: 60 }, (_, i) => `Paragrafo ${i + 1} com texto suficiente para encher a pagina A4 e forcar quebra de pagina.`).join("\n");
    const html = previewFor(
      baseFields(),
      ["# 1 Introducao", longPara, "# 2 Metodologia", "Curto.", "# 3 Resultados", "Curto."].join("\n"),
    );
    const pagesOf = (label: string): number => {
      const match = html.match(new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/span><span class="preview-summary-leader"[^>]*><\\/span><span class="preview-summary-page">(\\d+)<\\/span>`));
      return Number(match?.[1]);
    };
    const intro = pagesOf("1 INTRODUCAO");
    const metodo = pagesOf("2 METODOLOGIA");
    const resultados = pagesOf("3 RESULTADOS");
    expect(Number.isFinite(intro)).toBe(true);
    expect(Number.isFinite(metodo)).toBe(true);
    expect(Number.isFinite(resultados)).toBe(true);
    expect(metodo).toBeGreaterThan(intro);
    expect(resultados).toBeGreaterThanOrEqual(metodo);
    expect(resultados - intro).toBeGreaterThan(1);
  });

  it("Paginação real por altura: cada seção inicia em página própria após texto denso", () => {
    const longPara = Array.from({ length: 90 }, (_, i) => `Paragrafo ${i + 1} com conteudo longo o bastante para ocupar varias linhas em Times 12pt com espacamento 1,5.`).join("\n");
    const html = previewFor(
      baseFields(),
      ["# 1 Introducao", longPara, "# 2 Metodologia", longPara, "# 3 Resultados", longPara].join("\n"),
    );
    const pages = [...html.matchAll(/preview-summary-page">(\d+)<\/span>/g)].map((m) => Number(m[1]));
    const sectionPages = pages.slice(0, 3);
    expect(sectionPages.length).toBe(3);
    expect(sectionPages[1]).toBeGreaterThan(sectionPages[0]);
    expect(sectionPages[2]).toBeGreaterThan(sectionPages[1]);
  });
});

describe("buildPreviewHtml - estilos fiéis ao DOCX", () => {
  it("Aplica recuo de primeira linha de 1,25cm no corpo via data attribute", () => {
    const html = previewFor();
    expect(html).toContain('data-first-line-cm="1.25"');
  });

  it("Aplica recuo de 4cm para citação longa", () => {
    const html = previewFor();
    expect(html).toContain("preview-long-quote");
    expect(html).toContain('data-long-quote-cm="4"');
    expect(html).toContain('data-font-size="11pt"');
  });

  it("Referências com espaçamento simples e recuo deslocante (hanging)", () => {
    const html = previewFor();
    expect(html).toContain("preview-reference");
    expect(html).toContain("SILVA, M.");
    expect(html).toContain("Lavras: UFLA, 2024.");
  });

  it("Títulos primários em maiúsculas", () => {
    const html = previewFor();
    expect(html).toContain("1 INTRODUCAO");
  });

  it("Legendas de tabela centralizadas e em negrito", () => {
    const html = previewFor();
    expect(html).toContain("preview-caption");
    expect(html).toContain("Tabela 1 - Resultados das analises");
  });

  it("Fonte da tabela com classe de fonte", () => {
    const html = previewFor();
    expect(html).toContain("preview-source");
    expect(html).toContain("Fonte: elaborado pelo autor (2026).");
  });
});

describe("buildPreviewHtml - matriz por tipo de trabalho", () => {
  it("Monografia/Dissertação/Tese incluem capa e folha de rosto", () => {
    for (const workType of ["monografia", "dissertacao", "tese"] as const) {
      const html = previewFor(baseFields({ workType, program: workType === "monografia" ? "" : "Ciencia do Solo" }));
      expect(html).toContain("preview-cover");
      expect(html).toContain("preview-title-page");
    }
  });

  it("Dissertação/Tese incluem indicadores de impacto", () => {
    for (const workType of ["dissertacao", "tese"] as const) {
      const html = previewFor(
        baseFields({
          workType,
          program: "Ciencia do Solo",
          indicadoresImpacto: "Impacto social: informado.",
        }),
      );
      expect(html).toContain("INDICADORES DE IMPACTO");
    }
  });

  it("Artigo não inclui capa, folha de rosto nem sumário", () => {
    const html = previewFor(baseFields({ workType: "artigo" }), "# 1 Introducao\nTexto.\n");
    expect(html).not.toContain("preview-cover");
    expect(html).not.toContain("preview-title-page");
    expect(html).not.toContain("SUMÁRIO");
  });

  it("Artigo inclui título e autor centralizados", () => {
    const html = previewFor(baseFields({ workType: "artigo" }));
    expect(html).toContain("QUALIDADE DO CAFE NO SUL DE MINAS");
    expect(html).toContain("MARIA SILVA");
  });

  it("CPG não inclui capa, folha de rosto nem sumário", () => {
    for (const workType of ["resumo_expandido_cpg", "artigo_completo_cpg"] as const) {
      const html = previewFor(baseFields({ workType }), "# 1 Introducao\nTexto.\n");
      expect(html).not.toContain("preview-cover");
      expect(html).not.toContain("preview-title-page");
      expect(html).not.toContain("SUMÁRIO");
    }
  });

  it("CPG inclui título, autores e resumo", () => {
    const html = previewFor(baseFields({ workType: "resumo_expandido_cpg" }));
    expect(html).toContain("QUALIDADE DO CAFE NO SUL DE MINAS");
    expect(html).toContain("MARIA SILVA");
    expect(html).toContain("Resumo do trabalho.");
  });

  it("Projeto de pesquisa inclui capa, folha de rosto, resumo, abstract e sumário", () => {
    const html = previewFor(
      baseFields({
        workType: "projeto_pesquisa",
        program: "Ciencia da Computacao",
        resumo: "Resumo do projeto.",
        abstractText: "Project abstract.",
      }),
      "# 1 TEMA\nTexto do tema.\n",
    );
    expect(html).toContain("preview-cover");
    expect(html).toContain("preview-title-page");
    expect(html).toContain("RESUMO");
    expect(html).toContain("ABSTRACT");
    expect(html).toContain("SUMÁRIO");
  });
});

describe("buildPreviewHtml - template detectado por workType", () => {
  it("Marca o template correto no data attribute", () => {
    expect(previewFor(baseFields({ workType: "monografia" }))).toContain('data-template="general"');
    expect(previewFor(baseFields({ workType: "artigo" }))).toContain('data-template="article"');
    expect(previewFor(baseFields({ workType: "resumo_expandido_cpg" }))).toContain('data-template="cpg"');
    expect(previewFor(baseFields({ workType: "projeto_pesquisa" }))).toContain('data-template="research-project"');
  });
});

describe("buildPreviewHtml - regressões dos bugs corrigidos", () => {
  const RESUME_TEXT =
    "O presente estudo objetiva investigar.\nPalavras-chave: Ensino de Geometria; Currículo.";

  it("Bug 1 - quebras de linha do resumo são preservadas no preview", () => {
    const html = previewFor(
      baseFields({
        resumo: RESUME_TEXT,
        abstractText: "First.\nSecond.",
      }),
    );
    const simpleMatches = html.match(/class="preview-simple"/g) ?? [];
    expect(simpleMatches.length).toBeGreaterThan(0);
    expect(html).toContain("O presente estudo objetiva investigar.");
    expect(html).toContain("Palavras-chave: Ensino de Geometria; Currículo.");
    expect(html).toContain("First.");
    expect(html).toContain("Second.");
  });

  it("Bug 2 - imagem importada com data Uint8Array renderiza <img> no preview", () => {
    const data = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const html = buildPreviewHtml({
      fields: baseFields(),
      editorText: EDITOR_TEXT,
      importedImages: [
        {
          id: "img-1",
          caption: "Figura 1 - Grafico de barras",
          data,
          position: 0,
          status: "preserved",
        },
      ],
    });
    expect(html).toContain("<img");
    expect(html).not.toContain("[IMAGEM DETECTADA]");
  });

  it("Bug 3 - editor com # REFERENCIAS + campo igual não duplica no preview", () => {
    const ref = "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.";
    const html = previewFor(
      baseFields({ referencias: ref }),
      "# 1 Introducao\nTexto.\n# REFERENCIAS\n" + ref,
    );
    const occurrences = html.split("SILVA, M.").length - 1;
    expect(occurrences).toBe(1);
    expect(html).toContain("REFERÊNCIAS");
  });

  it("Bug 4 - imagem importada com legenda/fonte também no corpo não duplica no body-flow do preview", () => {
    const caption = "Figura 1 - Bandeirinhas Geometricas, de Alfredo Volpi";
    const source = "Fonte: elaborado pelo autor (2026).";
    const data = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const html = buildPreviewHtml({
      fields: baseFields(),
      editorText: ["# 1 Introducao", "Texto.", caption, "[[Imagem importada preservada: img-1]]", source, "# 2 Metodologia", "Texto."].join("\n"),
      importedImages: [
        {
          id: "img-1",
          caption,
          source,
          data,
          position: 0,
          status: "preserved",
        },
      ],
    });
    const bodyFlow = html.slice(html.indexOf("preview-body-flow"));
    const bodyAfterLists = bodyFlow.slice(0, bodyFlow.indexOf("preview-references"));
    const captionRuns = bodyAfterLists.match(/preview-caption/g) ?? [];
    const sourceRuns = bodyAfterLists.match(/preview-source/g) ?? [];
    expect(captionRuns.length).toBe(1);
    expect(sourceRuns.length).toBe(1);
  });
});
