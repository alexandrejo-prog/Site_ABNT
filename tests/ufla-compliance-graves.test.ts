import { describe, it, expect } from "vitest";
import { generateDocxBlob } from "../src/export-docx";
import { emptyAcademicFields } from "../src/ufla-rules";
import { loadDocxParts, paragraphTexts, extractFileFromZip } from "./test-utils/ooxml";

async function getXml(editorText: string, fields: Record<string, unknown> = {}) {
  const blob = await generateDocxBlob({ fields: { ...emptyAcademicFields(), ...fields }, editorText });
  const parts = await loadDocxParts(blob);
  return parts.documentXml;
}

describe("UFLA Compliance - Grave Issues Detection", () => {
  it("1. NÃO deve ter espaço extra entre Resumo e Palavras-chave", async () => {
    const fields = {
      workType: "monografia" as const,
      author: "Maria Silva",
      title: "Teste de Qualidade",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo de teste com conteúdo relevante.",
      palavrasChave: "teste; qualidade; academia",
      abstractText: "Abstract test content.",
      keywords: "test; quality; academia",
      advisor: "Prof. João",
    };
    const editorText = "# 1 INTRODUCAO\nTexto do conteúdo.";
    const xml = await getXml(editorText, fields);
    const text = paragraphTexts(xml).join("\n");
    
    const resumoIdx = text.indexOf("RESUMO");
    const palavrasIdx = text.indexOf("Palavras-chave");
    
    expect(resumoIdx).toBeGreaterThan(-1);
    expect(palavrasIdx).toBeGreaterThan(-1);
    expect(palavrasIdx).toBeGreaterThan(resumoIdx);
    expect(palavrasIdx).toBeLessThan(resumoIdx + 300);
  });

  it("2. Sumário deve ser campo TOC real (w:instrText com TOC)", async () => {
    const fields = {
      workType: "dissertacao" as const,
      author: "João da Silva",
      title: "Análise da Qualidade",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo da dissertação.",
      abstractText: "Abstract of the dissertation.",
      advisor: "Prof. Carlos",
    };
    const editorText = "# 1 INTRODUCAO\nTexto de exemplo.\n## 1.1 CONTEXTO\nContexto detalhado.";
    const blob = await generateDocxBlob({ fields: { ...emptyAcademicFields(), ...fields }, editorText });
    
    const docxBuffer = Buffer.from(await blob.arrayBuffer());
    const xml = await extractFileFromZip(docxBuffer, "word/document.xml");
    
    const hasTocField = xml.includes('<w:instrText') && xml.includes("TOC");
    expect(hasTocField).toBe(true);
  });

  it("3. NÃO deve ter fontes duplicadas para a mesma imagem", async () => {
    const fields = {
      workType: "tese" as const,
      author: "Teste Author",
      title: "Teste Tese",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo da tese.",
      abstractText: "Abstract.",
      advisor: "Prof. Teste",
    };
    const editorText = `
# 1 INTRODUCAO
Texto explicativo.

Figura 1 - Teste de imagem.
Texto da figura.

Fonte: elaborado pelo autor (2026).

Table 1 - Teste de tabela.
| Coluna 1 | Coluna 2 |
| Dados    | Valores  |

Fonte: elaborado pelo autor (2026).
`;
    const xml = await getXml(editorText, fields);
    const fonteMatches = xml.match(/Fonte:/gi) || [];
    
    expect(fonteMatches.length).toBeLessThanOrEqual(2);
  });

  it("4. Referências NÃO podem estar duplicadas", async () => {
    const fields = {
      workType: "monografia" as const,
      author: "Teste Author",
      title: "Teste Monografia",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      abstractText: "Abstract.",
      advisor: "Prof. Teste",
      referencias: "SILVA, João. Livro Teste. Lavras: UFLA, 2024.",
    };
    const editorText = "# 1 INTRODUCAO\nTexto.\n[REF] SILVA, João. Livro Teste. Lavras: UFLA, 2024.";
    const xml = await getXml(editorText, fields);
    const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
    
    let refCount = 0;
    for (const p of paragraphs) {
      if (p.includes("REFERÊNCIAS") || p.includes("SILVA")) {
        refCount++;
      }
    }
    
    expect(refCount).toBeLessThanOrEqual(3);
  });

  it("5. Capa deve mostrar autor REAL (não 'AUTOR')", async () => {
    const fields = {
      workType: "monografia" as const,
      author: "João da Silva",
      title: "Título da Monografia",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      abstractText: "Abstract.",
    };
    const editorText = "# 1 INTRODUCAO\nTexto.";
    const xml = await getXml(editorText, fields);
    
    const hasAutorPlaceholder = xml.includes("AUTOR");
    expect(hasAutorPlaceholder).toBe(false);
  });

  it("6. Capa deve ter título separado do autor (não grudado)", async () => {
    const fields = {
      workType: "monografia" as const,
      author: "Carlos Oliveira",
      title: "Qualidade do Café",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      abstractText: "Abstract.",
    };
    const editorText = "# 1 INTRODUCAO\nTexto.";
    const xml = await getXml(editorText, fields);
    
    const authorHasTitle = xml.includes("CARLOS OLIVEIRAQUALIDADE");
    expect(authorHasTitle).toBe(false);
  });

  it("7. Fonte/Fonte: NÃO deve estar em itálico", async () => {
    const fields = {
      workType: "monografia" as const,
      author: "Teste Author",
      title: "Teste",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      abstractText: "Abstract.",
    };
    const editorText = "Figura 1 - Teste.\nTexto da figura.\nFonte: elaborado pelo autor (2026).";
    const xml = await getXml(editorText, fields);

    const fonteInContext = /Fonte:[^<]*<w:italics/gi.test(xml);
    expect(fonteInContext).toBe(false);
  });

  it("8. Tabela com Source tem Source apenas uma vez", async () => {
    const fields = {
      workType: "monografia" as const,
      author: "Teste Author",
      title: "Teste",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      abstractText: "Abstract.",
    };
    const editorText = `
# 1 INTRODUCAO
Tabela 1 - Dados de pesquisa.
| Coluna 1 | Coluna 2 |
| A        | B        |

Fonte: elaborado pelo autor (2026).
`;
    const xml = await getXml(editorText, fields);
    const fonteCount = (xml.match(/Fonte:/gi) || []).length;
    
    expect(fonteCount).toBe(1);
  });
});