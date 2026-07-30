import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");

const { generateDocxBlob } = await import(pathToFileURL(join(root, "src", "export-docx.ts")).href);
const { emptyAcademicFields } = await import(pathToFileURL(join(root, "src", "ufla-rules.ts")).href);

// ============================================================
// 1. Generate teste-final.docx (for skills compliance test)
// ============================================================
console.log("Generating teste-final.docx...");
const testFields = {
  ...emptyAcademicFields(),
  workType: "dissertacao",
  author: "Maria Silva",
  title: "Pesquisa sobre Educacao Ambiental na UFLA",
  subtitle: "Um estudo de caso",
  program: "Programa de Pos-Graduacao em Educacao Cientifica e Ambiental",
  advisor: "Prof. Dr. Joao Santos",
  location: "Lavras - MG",
  year: "2026",
  resumo: "Este e o resumo do trabalho de dissertacao apresentado a Universidade Federal de Lavras.",
  palavrasChave: "Educacao Ambiental; UFLA; Pesquisa",
  abstractText: "This is the abstract of the dissertation presented to the Federal University of Lavras.",
  keywords: "Environmental Education; UFLA; Research",
  referencias: [
    "FREIRE, Paulo. Pedagogia da Autonomia. Sao Paulo: Paz e Terra, 1996.",
    "MARX, Karl. O Capital. Sao Paulo: Boitempo, 2013.",
    "UNIVERSIDADE FEDERAL DE LAVRAS. Manual de normalizacao de trabalhos academicos. Lavras: UFLA, 2025.",
    "BRASIL. Lei de Diretrizes e Bases da Educacao Nacional. Brasilia: MEC, 1996.",
    "MORIN, Edgar. Os Sete Saberes necessarios a educacao do futuro. Brasilia: UNESCO, 2000.",
    "AUTHOR, Test. Sample book title for references. Lavras: UFLA, 2024.",
  ].join("\n"),
  dedicatoria: "Aos meus pais.",
  agradecimentos: "Agradeco a todos que contribuiram.",
  epigrafe: "A educacao nao transforma o mundo. Educacao muda pessoas. Pessoas transformam o mundo. Paulo Freire",
  anexos: "ANEXO A - Documento complementar da pesquisa.",
  apendices: "APENDICE A - Roteiro de entrevista semiestruturada.",
  listaQuadros: "Quadro 1 - Etapas da pesquisa",
  listaTabelas: "Tabela 1 - Dados coletados",
  listaGraficos: "Grafico 1 - Resultados obtidos",
  listaSiglas: "UFLA - Universidade Federal de Lavras\nEAC - Educacao Ambiental Critica",
};

const editorText = [
  "# 1 INTRODUCAO",
  "Texto introdutorio do trabalho de dissertacao.",
  "> Citacao longa direta com mais de tres linhas que deve ter recuo de 4 cm da margem esquerda e fonte tamanho 10 conforme as normas da ABNT NBR 10520 e o manual da UFLA.",
  "",
  "## 1.1 Objetivos",
  "Texto dos objetivos da pesquisa.",
  "## 1.2 Justificativa",
  "Texto da justificativa.",
  "",
  "# 2 REFERENCIAL TEORICO",
  "Texto do referencial teorico.",
  "## 2.1 Educacao Ambiental Critica",
  "Texto sobre Educacao Ambiental Critica.",
  "### 2.1.1 Fundamentos teoricos",
  "Texto dos fundamentos teoricos.",
  "### 2.1.2 Aplicacoes praticas",
  "Texto das aplicacoes praticas.",
  "",
  "# 3 METODOLOGIA",
  "Texto da metodologia.",
  "",
  "# 4 RESULTADOS",
  "Texto dos resultados.",
  "",
  "# 5 CONSIDERACOES FINAIS",
  "Texto das consideracoes finais do trabalho.",
].join("\n");

const blob1 = await generateDocxBlob({ fields: testFields, editorText });
const buf1 = Buffer.from(await blob1.arrayBuffer());
writeFileSync(join(root, "teste-final.docx"), buf1);
console.log("  -> teste-final.docx written (" + buf1.length + " bytes)");

// ============================================================
// 2. Generate TEMPLATE_Manual - Formato padrão.docx
// ============================================================
console.log("Generating TEMPLATE_Manual - Formato padrao.docx...");
const templateFields = {
  ...emptyAcademicFields(),
  workType: "dissertacao",
  author: "NOME E SOBRENOME DO AUTOR",
  title: "EXEMPLO DE USO DO PADRÃO DA UFLA: FORMATADO EM WORD",
  program: "Programa de Pos-Graduacao em Educacao Cientifica e Ambiental",
  advisor: "Prof. Dr. Joao Santos",
  location: "Lavras - MG",
  year: "2026",
  resumo: "O resumo deve conter entre 150 e 500 palavras. Este é um resumo exemplo para o template da UFLA.",
  palavrasChave: "resumo; template; UFLA; normalização",
  abstractText: "The abstract should contain between 150 and 500 words. This is a sample abstract for the UFLA template.",
  keywords: "summary; template; UFLA; standardization",
  referencias: [
    "ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. NBR 14724: Informação e documentação - Trabalhos acadêmicos - Apresentação. Rio de Janeiro: ABNT, 2011. DOI: 10.1234/abnt.14724.2011.",
    "UNIVERSIDADE FEDERAL DE LAVRAS. Manual de normalização de trabalhos acadêmicos. 6. ed. Lavras: UFLA, 2025.",
    "FREIRE, Paulo. Pedagogia da Autonomia. São Paulo: Paz e Terra, 1996.",
    "MORIN, Edgar. Os Sete Saberes necessários à educação do futuro. Brasília: UNESCO, 2000.",
  ].join("\n"),
  anexos: "ANEXO A - Documento complementar da pesquisa de exemplo.",
  apendices: "APÊNDICE A - Instrumento de coleta de dados elaborado pelo autor.",
};

const templateEditorText = [
  "# 1 INTRODUCAO",
  "O objetivo deste template e fornecer um modelo padrao para formatacao de trabalhos academicos na UFLA, seguindo as normas da ABNT e o manual de normalizacao da universidade.",
  "",
  "# 2 REFERENCIAL TEORICO",
  "Texto do referencial teorico.",
  "",
  "# 3 METODOLOGIA",
  "Texto da metodologia.",
  "",
  "# 4 CONSIDERACOES FINAIS",
  "Texto das consideracoes finais.",
].join("\n");

const blob2 = await generateDocxBlob({ fields: templateFields, editorText: templateEditorText });
const buf2 = Buffer.from(await blob2.arrayBuffer());
writeFileSync(join(root, "TEMPLATE_Manual - Formato padrao.docx"), buf2);
console.log("  -> TEMPLATE_Manual - Formato padrao.docx written (" + buf2.length + " bytes)");

console.log("\nDone! Both fixture files generated.");
