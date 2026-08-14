import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

function checkCommand(cmd: string): boolean {
  try {
    execSync(`where ${cmd}`, { encoding: "utf8", stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function checkCommonPaths(): string | null {
  const commonPaths = [
    join("C:", "Program Files", "Microsoft Office", "root", "Office16", "WINWORD.EXE"),
    join("C:", "Program Files", "Microsoft Office", "Office16", "WINWORD.EXE"),
    join("C:", "Program Files (x86)", "Microsoft Office", "Office16", "WINWORD.EXE"),
    join("C:", "Program Files", "Microsoft Office", "root", "Office15", "WINWORD.EXE"),
    join("C:", "Program Files", "Microsoft Office", "Office15", "WINWORD.EXE"),
    join("C:", "Program Files (x86)", "Microsoft Office", "Office15", "WINWORD.EXE"),
    join("C:", "Program Files", "Microsoft Office", "root", "Office14", "WINWORD.EXE"),
    join("C:", "Program Files", "Microsoft Office", "Office14", "WINWORD.EXE"),
    join("C:", "Program Files (x86)", "Microsoft Office", "Office14", "WINWORD.EXE"),
  ];
  for (const p of commonPaths) {
    if (existsSync(p)) return p;
  }
  return null;
}

function checkRegistry(): boolean {
  try {
    const output = execSync('reg query "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\winword.exe" /ve 2>&1', { encoding: "utf8", stdio: "pipe" });
    return output.includes("winword.exe");
  } catch {
    return false;
  }
}

function checkComAutomation(): boolean {
  try {
    const output = execSync('powershell -NoProfile -Command "New-Object -ComObject Word.Application" 2>&1', { encoding: "utf8", stdio: "pipe" });
    return !output.includes("error") && !output.includes("Error");
  } catch {
    return false;
  }
}

const soffice = checkCommand("soffice");
const libreoffice = checkCommand("libreoffice");
const winword = checkCommand("winword");
const commonPath = checkCommonPaths();
const registry = checkRegistry();
const comAutomation = checkComAutomation();

console.log(JSON.stringify({
  soffice,
  libreoffice,
  winword,
  commonPath,
  registry,
  comAutomation,
  available: soffice || libreoffice || winword || commonPath !== null || registry || comAutomation
}, null, 2));