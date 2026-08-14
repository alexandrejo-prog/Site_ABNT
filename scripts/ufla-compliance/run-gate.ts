import { runFullComplianceGate } from "./gate";

const docxPath = process.argv[2] || "artifacts/ufla-compliance/normalized-dissertacao.docx";
const pdfPath = process.argv[3];

(async () => {
  const result = await runFullComplianceGate(docxPath, pdfPath);

  console.log("\n=== FULL COMPLIANCE GATE ===");
  console.log(`Passed: ${result.passed}`);
  if (result.gaps.length > 0) {
    console.log("Gaps:");
    for (const gap of result.gaps) console.log(`  - ${gap}`);
  }
  console.log("\n=== RESULTS ===");
  for (const r of result.results) {
    console.log(`${r.name}: ${r.passed ? "PASSED" : "FAILED"}`);
  }

  process.exit(result.passed ? 0 : 1);
})();
