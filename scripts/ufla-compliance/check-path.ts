const pdfPath = new URL("../../../artifacts/ufla-compliance/rendered/normalized-dissertacao.pdf", import.meta.url);
console.log("Resolved path:", pdfPath);
console.log("Exists:", require("node:fs").existsSync(pdfPath));