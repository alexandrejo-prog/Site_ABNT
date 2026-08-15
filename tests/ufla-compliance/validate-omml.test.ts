import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateOMML } from "@scripts/ufla-compliance/validate-omml";

async function buildNoMathDocxPath(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "site-abnt-omml-"));
  const path = join(dir, "sem-matematica.docx");
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>Sem equações</w:t></w:r></w:p><w:sectPr/></w:body>
</w:document>`,
  );
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync(path, buf);
  return path;
}

describe("validateOMML", () => {
  it("returns passed when no math is present", async () => {
    const results = await validateOMML(await buildNoMathDocxPath());
    expect(results.some((r) => r.status === "passed")).toBe(true);
  });

  it("returns failed when docx does not exist", async () => {
    const results = await validateOMML("missing.docx");
    expect(results.some((r) => r.status === "failed")).toBe(true);
  });
});
