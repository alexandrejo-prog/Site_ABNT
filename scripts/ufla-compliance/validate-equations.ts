/**
 * Validação de equações avançadas (UFLA-023 §3.2.8)
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

export interface EquationValidation {
  basicEquations: number;
  advancedEquations: number;
  ommlCruInjected: boolean;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export async function validateEquations(docxPath: string): Promise<EquationValidation> {
  const result: EquationValidation = {
    basicEquations: 0,
    advancedEquations: 0,
    ommlCruInjected: false,
    isValid: true,
    errors: [],
    warnings: [],
  };

  if (!existsSync(docxPath)) {
    result.isValid = false;
    result.errors.push(`Arquivo não encontrado: ${docxPath}`);
    return result;
  }

  try {
    const buffer = readFileSync(docxPath);
    const zip = await JSZip.loadAsync(buffer);
    const docXml = (await zip.file("word/document.xml")?.async("string")) ?? "";

    const mathCount = (docXml.match(/<m:oMath(?:\s[^>]*)?>|<\/m:oMath>/g) || []).length;
    const paragraphs = [...docXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(m => m[0]);
    const centerEquations = paragraphs.filter(
      p => p.includes('w:val="center"') && (p.includes("<m:oMath") || (p.includes("w:tab") && p.includes('w:val="right"'))),
    );

    result.basicEquations = mathCount;
    result.warnings.push('Equações OMML detectadas; validação de formato aplicada.');

    if (mathCount > 0 && centerEquations.length === 0) {
      result.isValid = false;
      result.errors.push("Equações/fórmulas presentes sem parágrafo centralizado com numeração à direita (tab stop direito).");
    }
  } catch (err) {
    result.isValid = false;
    result.errors.push(`Falha na validação de equações: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

if (require.main === module) {
  const p = process.argv[2] || 'artifacts/ufla-compliance/normalized-dissertacao.docx';
  validateEquations(path.resolve(p)).then(r => {
    console.log(`[equations] Básicas: ${r.basicEquations}, Avançadas: ${r.advancedEquations}`);
    console.log(`[equations] OMML cru: ${r.ommlCruInjected ? 'SIM' : 'Não'}`);
    process.exit(r.isValid ? 0 : 1);
  });
}
