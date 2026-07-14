// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportBlock } from "../src/components/ImportBlock";
import type { ImportedDocumentPayload, SourceKind } from "../src/import-contract";
import { emptyAcademicFields, emptyConfidenceMap } from "../src/ufla-rules";

const importAcademicFileMock = vi.fn();
const importDocumentFileMock = vi.fn();

vi.mock("../src/import-file-router", () => ({
  detectImportableFileKind: vi.fn(() => "pdf"),
  importAcademicFile: (...args: unknown[]) => importAcademicFileMock(...args),
}));
vi.mock("../src/import-docx", () => ({
  importDocumentFile: (...args: unknown[]) => importDocumentFileMock(...args),
}));

const PDF_DOCUMENT = {
  kind: "pdf" as const,
  document: {
    source: { fileName: "Andrade_2025.pdf", pageCount: 139 },
    pages: [
      { pageNumber: 1, width: 800, height: 1000, items: [], normalizedText: "Texto extraido de exemplo." },
    ],
    blocks: [],
    diagnostics: [],
    quality: { textConfidence: "high", layoutConfidence: "medium", requiresManualReview: false },
  },
};

const DOCX_RESULT = {
  text: "Conteudo do docx importado.",
  editorText: "Conteudo do docx importado.",
  fields: { ...emptyAcademicFields(), title: "Trabalho Exemplo", author: "Autor Exemplo" },
  confidence: emptyConfidenceMap(),
  messages: [],
  blocks: [],
  importedImages: [],
  importedTables: [],
};

describe("contrato de origem/modo na importação (ImportBlock)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("importação PDF aciona exclusivamente o modo pdf-text-draft", async () => {
    const user = userEvent.setup();
    importAcademicFileMock.mockResolvedValue(PDF_DOCUMENT);
    const onImport = vi.fn();
    render(
      <ImportBlock
        onImport={onImport}
        onRemove={() => {}}
        importedFileName={null}
        workType="monografia"
      />,
    );

    const file = new File(["pdf-bytes"], "Andrade_2025.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("Importar arquivo"), file);

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    const payload = onImport.mock.calls[0][0] as ImportedDocumentPayload;
    expect(payload.sourceKind).toBe<SourceKind>("pdf");
    expect(payload.documentMode).toBe("pdf-text-draft");
  });

  it("importação DOCX mantém modo ufla-structured", async () => {
    const user = userEvent.setup();
    importDocumentFileMock.mockResolvedValue(DOCX_RESULT);
    const onImport = vi.fn();
    render(
      <ImportBlock
        onImport={onImport}
        onRemove={() => {}}
        importedFileName={null}
        workType="monografia"
      />,
    );

    const file = new File(["docx-bytes"], "trabalho.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await user.upload(screen.getByLabelText("Importar arquivo"), file);

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    const payload = onImport.mock.calls[0][0] as ImportedDocumentPayload;
    expect(payload.sourceKind).toBe<SourceKind>("docx");
    expect(payload.documentMode).toBe("ufla-structured");
  });

  it("importação TXT usa modo ufla-structured com sourceKind txt", async () => {
    const user = userEvent.setup();
    importDocumentFileMock.mockResolvedValue(DOCX_RESULT);
    const onImport = vi.fn();
    render(
      <ImportBlock
        onImport={onImport}
        onRemove={() => {}}
        importedFileName={null}
        workType="monografia"
      />,
    );

    const file = new File(["txt-bytes"], "notas.txt", { type: "text/plain" });
    await user.upload(screen.getByLabelText("Importar arquivo"), file);

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    const payload = onImport.mock.calls[0][0] as ImportedDocumentPayload;
    expect(payload.sourceKind).toBe<SourceKind>("txt");
    expect(payload.documentMode).toBe("ufla-structured");
  });
});
