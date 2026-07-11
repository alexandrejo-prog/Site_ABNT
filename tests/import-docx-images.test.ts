import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { generateDocxBlob } from "../src/export-docx";
import { importDocumentFile } from "../src/import-docx";
import { emptyAcademicFields } from "../src/ufla-rules";
import { documentText } from "./test-utils/ooxml";

const tinyPng = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  ),
);

function paragraphXml(text: string): string {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function imageParagraphXml(relationshipId: string): string {
  return `<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="${relationshipId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

async function makeSyntheticDocx(
  options: { duplicateBodyImage?: boolean; headerImage?: boolean; missingMedia?: boolean } = {},
): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const body = [
    paragraphXml("UNIVERSIDADE FEDERAL DE LAVRAS"),
    paragraphXml("AUTORA SINTETICA"),
    paragraphXml("TITULO SINTETICO"),
    paragraphXml("1 INTRODUCAO"),
    paragraphXml("Texto antes da imagem."),
    paragraphXml("Grafico 1 - Sexo."),
    imageParagraphXml("rId22"),
    ...(options.duplicateBodyImage ? [imageParagraphXml("rId22")] : []),
    paragraphXml("Fonte: elaboracao propria (2025)."),
    paragraphXml("Texto normal depois."),
    paragraphXml("REFERENCIAS"),
    paragraphXml("SILVA, A. Referencia sintetica."),
  ].join("");

  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`,
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId22" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>`,
  );

  if (options.headerImage) {
    zip.file(
      "word/header1.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${imageParagraphXml("rHeader1")}</w:hdr>`,
    );
    zip.file(
      "word/_rels/header1.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rHeader1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/></Relationships>`,
    );
    zip.file("word/media/logo.png", tinyPng);
  }

  if (!options.missingMedia) {
    zip.file("word/media/image1.png", tinyPng);
  }
  return zip.generateAsync({ type: "arraybuffer" });
}

async function importSyntheticDocx(options?: { duplicateBodyImage?: boolean; headerImage?: boolean; missingMedia?: boolean }) {
  const docx = await makeSyntheticDocx(options);
  const file = new File([docx], "sintetico.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  return importDocumentFile(file);
}

describe("importacao de imagens DOCX", () => {
  it("detecta e preserva imagem real com metadados minimos, legenda e fonte", async () => {
    const result = await importSyntheticDocx();

    expect(result.importedImages).toHaveLength(1);
    expect(result.importedImages[0]).toMatchObject({
      id: "img-1",
      relationshipId: "rId22",
      fileName: "image1.png",
      mimeType: "image/png",
      caption: "Grafico 1 - Sexo.",
      source: "Fonte: elaboracao propria (2025).",
      status: "preserved",
    });
    expect(result.importedImages[0].data?.byteLength).toBeGreaterThan(0);
    expect(result.editorText).toContain("[[Imagem importada preservada: img-1]]");
    expect(result.editorText).not.toContain("[Imagem detectada: rId");
  });

  it("gera DOCX final com imagem real sem placeholder tecnico", async () => {
    const result = await importSyntheticDocx();
    const fields = {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      author: "Autora Sintetica",
      title: "Titulo Sintetico",
      resumo: "Resumo sintetico.",
      abstractText: "Synthetic abstract.",
      palavrasChave: "imagem; teste.",
      keywords: "image; test.",
    };

    const blob = await generateDocxBlob({
      fields,
      editorText: result.editorText,
      importedImages: result.importedImages,
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const documentXml = await zip.file("word/document.xml")?.async("string");
    const mediaFiles = Object.keys(zip.files).filter((name) => name.startsWith("word/media/"));

    expect(documentXml).toBeTruthy();
    expect(documentText(documentXml ?? "")).not.toContain("[Imagem detectada: rId");
    expect(documentText(documentXml ?? "")).not.toContain("[[Imagem importada preservada:");
    expect(mediaFiles.length).toBeGreaterThan(0);
  });

  it("omite marcador interno quando a imagem nao puder ser preservada", async () => {
    const result = await importSyntheticDocx({ missingMedia: true });

    const blob = await generateDocxBlob({
      fields: {
        ...emptyAcademicFields(),
        workType: "dissertacao",
        author: "A",
        title: "T",
        resumo: "R",
        abstractText: "A",
      },
      editorText: result.editorText,
      importedImages: result.importedImages,
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(result.importedImages[0].status).toBe("detected-but-not-preserved");
    expect(result.editorText).not.toContain("[Imagem detectada: rId");
    expect(result.editorText).not.toContain("[[Imagem importada preservada:");
    expect(result.messages.join("\n")).toContain("imagem(ns) detectada(s), mas nem todas puderam ser preservadas automaticamente");
    expect(documentText(documentXml ?? "")).not.toContain("[Imagem detectada: rId");
    expect(documentText(documentXml ?? "")).not.toContain("[[Imagem importada preservada:");
  });

  it("nao duplica imagens repetidas pelo mesmo relationship id nem imagens de cabecalho", async () => {
    const result = await importSyntheticDocx({ duplicateBodyImage: true, headerImage: true });

    expect(result.importedImages).toHaveLength(1);
    expect(result.importedImages[0].relationshipId).toBe("rId22");
  });
});
