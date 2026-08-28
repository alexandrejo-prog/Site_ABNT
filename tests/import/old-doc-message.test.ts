/**
 * B3 (checklist-15): mensagem específica para .doc antigo.
 *
 * OLE2 magic (D0 CF 11 E0 A1 B1 1A E1) identifica .doc binário — inclusive
 * renomeado para .docx. Critério: .doc renomeado → mensagem específica
 * ("Salvar como" .docx); .docx corrompido (sem magic OLE2/ZIP) → mensagem
 * atual (docxOpenError); .doc real → mensagem específica.
 */
import { describe, it, expect } from "vitest";
import { importDocumentFile, isOle2Binary } from "../../src/import-docx";

function ole2Bytes(): Uint8Array<ArrayBuffer> {
  // Cabeçalho OLE2 (D0 CF 11 E0 A1 B1 1A E1) + bytes de preenchimento.
  const bytes = new Uint8Array<ArrayBuffer>(new ArrayBuffer(512));
  bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  return bytes;
}

describe("B3 — .doc antigo (OLE2) com mensagem especifica", () => {
  it("isOle2Binary detecta magic bytes OLE2", () => {
    expect(isOle2Binary(ole2Bytes().buffer)).toBe(true);
    // ZIP não é OLE2
    const zip = new Uint8Array<ArrayBuffer>(new ArrayBuffer(8));
    zip.set([0x50, 0x4b, 0x03, 0x04]);
    expect(isOle2Binary(zip.buffer)).toBe(false);
    // buffer curto → false
    expect(isOle2Binary(new Uint8Array<ArrayBuffer>(new ArrayBuffer(4)).buffer)).toBe(false);
  });

  it(".doc ANTIGO renomeado para .docx → mensagem especifica de .doc", async () => {
    const file = new File([ole2Bytes()], "documento.doc", {
      type: "application/msword",
    });
    // renomeado: extensão .docx com conteúdo OLE2
    const renamed = new File([ole2Bytes()], "documento.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await expect(importDocumentFile(renamed)).rejects.toThrow(/doc ANTIGO renomeado para \.docx/);
    await expect(importDocumentFile(renamed)).rejects.toThrow(/Salvar como/);
    await expect(importDocumentFile(file)).rejects.toThrow(/doc ANTIGO \(formato OLE2/);
  });

  it(".docx corrompido (sem ZIP e sem OLE2) mantem a mensagem atual", async () => {
    const bytes = new Uint8Array<ArrayBuffer>(new ArrayBuffer(64)).fill(0x41); // "AAA..." sem magic
    const file = new File([bytes], "corrompido.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await expect(importDocumentFile(file)).rejects.toThrow(/Nao foi possivel abrir/);
    await expect(importDocumentFile(file)).rejects.not.toThrow(/doc ANTIGO/);
  });
});
