import { describe, expect, it } from "vitest";
import { importDocumentFile } from "../src/import-docx";
import { normalizePlainAcademicText } from "../src/import-normalizer";
import { detectAcademicFieldsFromText } from "../src/field-detector";

/**
 * Cria um objeto File simulado para testes em Node.js.
 */
function createMockFile(
  content: string,
  fileName: string,
): File {
  return new File([content], fileName, { type: "text/plain" });
}

describe("Erros de importação", () => {
  describe("1. TXT vazio ou quase vazio", () => {
    it("não quebra com TXT vazio e retorna campos vazios controlados", async () => {
      const file = createMockFile("", "vazio.txt");
      const result = await importDocumentFile(file);

      expect(result.text).toBe("");
      expect(result.editorText).toBe("");
      expect(result.fields.title).toBe("");
      expect(result.fields.author).toBe("");
      expect(result.fields.resumo).toBe("");
      expect(result.fields.introducao).toBe("");
      expect(result.fields.referencias).toBe("");
      expect(result.blocks).toHaveLength(0);
      expect(result.messages).toBeDefined();
    });

    it("não quebra com TXT de apenas espaços e quebras de linha", async () => {
      const file = createMockFile("   \n\n  \n   ", "espacos.txt");
      const result = await importDocumentFile(file);

      expect(result.text).toBe("");
      expect(result.fields.title).toBe("");
      expect(result.fields.author).toBe("");
    });

    it("não quebra com TXT de uma única palavra", async () => {
      const file = createMockFile("Teste", "curto.txt");
      const result = await importDocumentFile(file);

      expect(result.text).toBe("Teste");
      // Campos estruturais que exigem seções acadêmicas devem ficar vazios
      expect(result.fields.resumo).toBe("");
      expect(result.fields.introducao).toBe("");
      expect(result.fields.referencias).toBe("");
      expect(result.fields.abstractText).toBe("");
      expect(result.fields.palavrasChave).toBe("");
      expect(result.fields.keywords).toBe("");
    });

    it("não quebra com TXT de poucas linhas sem marcadores acadêmicos", async () => {
      const file = createMockFile(
        "Uma linha qualquer\nOutra linha\nMais uma",
        "poucas-linhas.txt",
      );
      const result = await importDocumentFile(file);

      expect(result.text).toContain("Uma linha qualquer");
      // Campos estruturais que exigem seções acadêmicas devem ficar vazios
      expect(result.fields.resumo).toBe("");
      expect(result.fields.introducao).toBe("");
      expect(result.fields.referencias).toBe("");
      expect(result.fields.abstractText).toBe("");
      expect(result.fields.palavrasChave).toBe("");
      expect(result.fields.keywords).toBe("");
    });
  });

  describe("2. Extensão não suportada", () => {
    it("aceita .pdf apenas como diagnostico e falha de forma controlada quando invalido", async () => {
      const file = createMockFile("dummy pdf content", "documento.pdf");

      await expect(importDocumentFile(file)).rejects.toThrow(
        "Nao foi possivel ler o PDF",
      );
    });

    it("rejeita .odt com mensagem clara", async () => {
      const file = createMockFile("dummy odt content", "documento.odt");

      await expect(importDocumentFile(file)).rejects.toThrow(
        "Formato nao suportado",
      );
    });

    it("rejeita .jpg com mensagem clara", async () => {
      const file = createMockFile("dummy jpg content", "foto.jpg");

      await expect(importDocumentFile(file)).rejects.toThrow(
        "Formato nao suportado",
      );
    });

    it("rejeita extensão desconhecida .xyz com mensagem clara", async () => {
      const file = createMockFile("conteúdo qualquer", "arquivo.xyz");

      await expect(importDocumentFile(file)).rejects.toThrow(
        "Formato nao suportado",
      );
    });

    it("rejeita arquivo sem extensão com mensagem clara", async () => {
      const file = createMockFile("conteúdo qualquer", "README");

      await expect(importDocumentFile(file)).rejects.toThrow(
        "Formato nao suportado",
      );
    });
  });

  describe("3. Conteúdo textual sem seções acadêmicas", () => {
    it("importa texto aleatório sem preencher campos estruturais", async () => {
      const text = `Era uma vez um estudante que precisava formatar seu trabalho.
Ele tentou várias ferramentas, mas nenhuma resolvia.
Até que encontrou uma ferramenta de normalização acadêmica.
Fim.`;

      const file = createMockFile(text, "historia.txt");
      const result = await importDocumentFile(file);

      // O texto deve ser importado
      expect(result.text).toContain("Era uma vez");
      expect(result.text).toContain("Fim.");

      // Campos que exigem seções acadêmicas (RESUMO, ABSTRACT, INTRODUÇÃO, etc.)
      // não devem ser preenchidos para texto sem estrutura
      expect(result.fields.resumo).toBe("");
      expect(result.fields.introducao).toBe("");
      expect(result.fields.referencias).toBe("");
      expect(result.fields.abstractText).toBe("");
      expect(result.fields.palavrasChave).toBe("");
      expect(result.fields.keywords).toBe("");
    });

    it("importa texto com palavras soltas sem preencher campos estruturais", async () => {
      const text = `café qualidade produção sustentável agricultura
Brasil Minas Gerais lavoura colheita torra
exportação mercado consumidor orgânico`;

      const file = createMockFile(text, "palavras.txt");
      const result = await importDocumentFile(file);

      expect(result.text).toContain("café");
      // Campos que exigem seções acadêmicas não devem ser preenchidos
      expect(result.fields.resumo).toBe("");
      expect(result.fields.introducao).toBe("");
      expect(result.fields.referencias).toBe("");
      expect(result.fields.abstractText).toBe("");
      expect(result.fields.palavrasChave).toBe("");
      expect(result.fields.keywords).toBe("");
    });

    it("importa texto com números e símbolos sem quebrar", async () => {
      const text = `12345 67890 !@#$% 42
abc def ghi jkl mno pqr stu vwx yz
2024 2025 2026`;

      const file = createMockFile(text, "simbolos.txt");
      const result = await importDocumentFile(file);

      expect(result.text).toContain("12345");
      expect(result.fields).toBeDefined();
      expect(result.blocks.length).toBeGreaterThan(0);
    });

    it("não menciona IA, API externa ou backend nas mensagens de erro", async () => {
      const externalTerms = [
        "Groq",
        "Gemini",
        "DeepSeek",
        "OpenRouter",
        "chave da API",
        "chave de API",
        "apiKey",
        "api.openai.com",
        "inteligência artificial",
        "inteligencia artificial",
        "IA",
      ];

      // Testa com arquivo vazio
      const emptyFile = createMockFile("", "vazio.txt");
      const emptyResult = await importDocumentFile(emptyFile);
      const emptyMessages = emptyResult.messages.join(" ");

      for (const term of externalTerms) {
        expect(emptyMessages).not.toMatch(
          new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        );
      }

      // Testa com extensão não suportada
      const badFile = createMockFile("conteúdo", "arquivo.pdf");
      try {
        await importDocumentFile(badFile);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        for (const term of externalTerms) {
          expect(errorMessage).not.toMatch(
            new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
          );
        }
      }

      // Testa com texto aleatório
      const randomFile = createMockFile(
        "texto aleatório sem estrutura acadêmica nenhuma",
        "aleatorio.txt",
      );
      const randomResult = await importDocumentFile(randomFile);
      const randomMessages = randomResult.messages.join(" ");

      for (const term of externalTerms) {
        expect(randomMessages).not.toMatch(
          new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        );
      }
    });
  });

  describe("4. Fluxo de importação via detectAcademicFieldsFromText", () => {
    it("retorna campos vazios para texto vazio sem quebrar", () => {
      const result = detectAcademicFieldsFromText("");

      expect(result.fields.title).toBe("");
      expect(result.fields.author).toBe("");
      expect(result.fields.resumo).toBe("");
      expect(result.fields.introducao).toBe("");
      expect(result.fields.referencias).toBe("");
      expect(result.editorText).toBe("");
      expect(result.messages).toEqual([]);
    });

    it("não preenche campos estruturais para texto sem seções acadêmicas", () => {
      const result = detectAcademicFieldsFromText(
        "Algum texto aleatório que não tem estrutura acadêmica.",
      );

      // Campos que exigem seções acadêmicas não devem ser preenchidos
      expect(result.fields.resumo).toBe("");
      expect(result.fields.introducao).toBe("");
      expect(result.fields.referencias).toBe("");
      expect(result.fields.abstractText).toBe("");
      expect(result.fields.palavrasChave).toBe("");
      expect(result.fields.keywords).toBe("");
    });

    it("não menciona IA, API externa ou backend nos resultados", () => {
      const externalTerms = [
        "Groq",
        "Gemini",
        "DeepSeek",
        "OpenRouter",
        "chave da API",
        "chave de API",
        "apiKey",
        "api.openai.com",
        "inteligência artificial",
        "inteligencia artificial",
        "IA",
      ];

      const result = detectAcademicFieldsFromText(
        "texto aleatório sem estrutura acadêmica",
      );

      const combinedText = [
        result.fields.title,
        result.fields.author,
        result.fields.resumo,
        result.fields.introducao,
        result.fields.referencias,
        ...result.messages,
      ]
        .filter(Boolean)
        .join(" ");

      for (const term of externalTerms) {
        expect(combinedText).not.toMatch(
          new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        );
      }
    });
  });

  describe("5. Normalização de texto vazio ou inválido", () => {
    it("normalizePlainAcademicText não quebra com string vazia", () => {
      const result = normalizePlainAcademicText("");

      expect(result.text).toBe("");
      expect(result.structure.blocks).toHaveLength(0);
      expect(result.messages).toEqual([]);
    });

    it("normalizePlainAcademicText não quebra com apenas espaços", () => {
      const result = normalizePlainAcademicText("   \n  \n  ");

      expect(result.text).toBe("");
      expect(result.structure.blocks).toHaveLength(0);
    });

    it("normalizePlainAcademicText retorna mensagem para texto mal segmentado", () => {
      const result = normalizePlainAcademicText(
        "Título longo aqui\nResumo Este é o resumo.\n1 Introdução Texto da introdução.",
      );

      expect(result.messages.length).toBeGreaterThanOrEqual(1);
      expect(result.messages[0]).toContain("mal segmentado");
    });
  });

  describe("6. Erro de leitura/importação DOCX", () => {
    it("rejeita DOCX vazio ou corrompido com mensagem clara", async () => {
      const emptyBuffer = new ArrayBuffer(0);
      const file = new File([emptyBuffer], "vazio.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      await expect(importDocumentFile(file)).rejects.toThrow(
        "Nao foi possivel abrir",
      );
    });

    it("rejeita arquivo .docx que nao e ZIP valido", async () => {
      const invalidContent = "Este nao e um arquivo DOCX valido";
      const file = new File([invalidContent], "falso.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      await expect(importDocumentFile(file)).rejects.toThrow(
        "Nao foi possivel abrir",
      );
    });

    it("mensagem de erro DOCX corrompido não menciona IA ou API externa", async () => {
      const externalTerms = [
        "Groq",
        "Gemini",
        "DeepSeek",
        "OpenRouter",
        "chave da API",
        "chave de API",
        "apiKey",
        "api.openai.com",
        "inteligência artificial",
        "IA",
      ];

      const file = new File([new ArrayBuffer(0)], "pequeno.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      try {
        await importDocumentFile(file);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        for (const term of externalTerms) {
          expect(errorMessage).not.toMatch(
            new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
          );
        }
      }
    });
  });
});
