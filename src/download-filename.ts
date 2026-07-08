import { WORK_TYPE_LABELS, type WorkTypeValue } from "./ufla-rules";

const MAX_SOURCE_LENGTH = 96;

export function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.\\/]+$/u, "");
}

export function slugify(value: string, fallback = "documento", maxLength = MAX_SOURCE_LENGTH): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  const normalized = slug || fallback;
  return normalized.length > maxLength ? normalized.slice(0, maxLength).replace(/-+$/g, "") : normalized;
}

interface DownloadFileNameInput {
  workType: WorkTypeValue;
  title: string;
  importedFileName?: string | null;
}

export function buildDownloadFileName({ workType, title, importedFileName }: DownloadFileNameInput): string {
  const typeSource = workType ? WORK_TYPE_LABELS[workType] ?? workType : "trabalho-ufla";
  const source = importedFileName ? stripFileExtension(importedFileName) : title;
  return `${slugify(typeSource, "trabalho-ufla", 42)}-${slugify(source, "sem-titulo")}.docx`;
}