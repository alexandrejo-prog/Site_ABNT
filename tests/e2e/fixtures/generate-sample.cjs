const JSZip = require("jszip");
const fs = require("fs");
const path = require("path");

const zip = new JSZip();
zip.file(
  "[Content_Types].xml",
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    "</Types>"
);
zip.file(
  "_rels/.rels",
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>"
);
const document =
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
  "<w:p><w:r><w:t>Introducao ao trabalho de conclusao. Este paragrafo serve como conteudo de importacao para o teste E2E.</w:t></w:r></w:p>" +
  "<w:p><w:r><w:t>Referencias bibliograficas de exemplo para validar a extracao de campos.</w:t></w:r></w:p>" +
  "</w:body></w:document>";
zip.file("word/document.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + document);

zip
  .generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
  .then((buf) => {
    const out = path.join(__dirname, "sample.docx");
    fs.writeFileSync(out, buf);
    console.log("written", buf.length, "bytes to", out);
  });
