import { readFileSync } from "node:fs";
import { join } from "node:path";

const raw = readFileSync(join(process.cwd(), "artifacts/ufla-compliance/normalized-analysis.json"), "utf8");
const jsonStart = raw.indexOf("{");
const json = raw.slice(jsonStart);
const data = JSON.parse(json);
const failures = data.analysis.items.filter((item: any) => item.status === "fail");
console.log("FAILURES:", failures.length);
failures.forEach((item: any) => {
  console.log(item.id, item.description, item.severity);
});