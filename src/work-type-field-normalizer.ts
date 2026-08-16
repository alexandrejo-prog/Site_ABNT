import { isUflaCollectionWork, type AcademicFields } from "./ufla-rules";
import { findUflaPpgProgram, formatUflaPpgProgram } from "./ufla-ppg-programs";
import { normalizeWorkType } from "./work-type-resolver";

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function isGenericOrMismatchedNature(value: string, workType: AcademicFields["workType"]): boolean {
  const text = fold(value).replace(/^natureza do trabalho:\s*/, "");
  if (!text) return true;

  if (text.includes("requisito academico") || text.includes("requisitos academicos")) return true;
  if (text.includes("requisitos academicos aplicaveis")) return true;
  if (text.includes("dados revisados pelo usuario")) return true;
  if (text.includes("trabalho academico apresentado a universidade federal de lavras")) return true;
  if (text.includes("colecao producao academica") || text.includes("suporte inicial no sistema")) return true;
  if (text.includes("trabalho apresentado a universidade federal de lavras como requisito")) return true;

  if (workType !== "projeto_pesquisa" && text.includes("projeto de pesquisa apresentado a universidade federal de lavras")) return true;
  if (workType !== "monografia" && text.includes("monografia apresentada a universidade federal de lavras")) return true;
  if (workType !== "dissertacao" && text.includes("dissertacao apresentada a universidade federal de lavras")) return true;
  if (workType !== "tese" && text.includes("tese apresentada a universidade federal de lavras")) return true;

  if (
    (workType === "dissertacao" || workType === "tese") &&
    /como\s+parte\s+das\s+exig[eê]ncias\s+do\s+[^.,]+/i.test(value)
  ) {
    const match = value.match(/como\s+parte\s+das\s+exig[eê]ncias\s+do\s+([^.,]+)/i);
    if (match) {
      const program = findUflaPpgProgram(match[1]);
      if (program && !value.includes(`Programa de Pós-Graduação em ${program.name}`)) {
        return true;
      }
    }
  }

  if (
    (workType === "dissertacao" || workType === "tese") &&
    /exig[eê]ncias\s+do\s+[^.,]+/i.test(value)
  ) {
    const match = value.match(/exig[eê]ncias\s+do\s+([^.,]+)/i);
    if (match) {
      const program = findUflaPpgProgram(match[1]);
      if (program && !value.includes(`Programa de Pós-Graduação em ${program.name}`)) {
        return true;
      }
    }
  }

  return false;
}

function defaultProgram(fields: AcademicFields): string {
  if (!fields.program || !fields.program.trim()) return "";
  return formatUflaPpgProgram(fields.program);
}

function defaultCourse(fields: AcademicFields): string {
  return fields.course || "";
}

function undergraduateDegree(fields: AcademicFields): string {
  const course = fold(fields.course);
  if (!course) return "";
  if (course.includes("licenciatura")) return `Licenciado em ${fields.course.replace(/licenciatura em/i, "").trim() || "área informada"}`;
  if (course.includes("bacharelado")) return `Bacharel em ${fields.course.replace(/bacharelado em/i, "").trim() || "área informada"}`;
  return "";
}

function normalizeCpgEmailLine(value: string): string {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return "";
  const separated = text.replace(/([^\s;,]+@[^\s;,]+)\s+(?=[^\s;,]+@[^\s;,]+)/giu, "$1; ");
  const parts = separated.split(/\s*[;,]\s*/u).map((part) => part.trim()).filter(Boolean);
  const emailPattern = /^[^\s@;]+@[^\s@;]+\.[^\s@;]+$/u;
  if (parts.length > 1 && parts.every((part) => emailPattern.test(part))) return parts.join("; ");
  return text;
}

// Não gera prosa falsa/placeholder quando metadados obrigatórios estão ausentes.
// Retorna string vazia para que a validação sinalize o campo obrigatório.
function natureForSelectedModel(fields: AcademicFields): string {
  if (fields.workType === "projeto_pesquisa") {
    const program = defaultProgram(fields);
    if (!program) return "";
    return `Projeto de pesquisa apresentado à Universidade Federal de Lavras, como parte das atividades do ${program}, para avaliação acadêmica.`;
  }

  if (fields.workType === "monografia") {
    const course = defaultCourse(fields);
    const degree = undergraduateDegree(fields);
    if (!course || !degree) return "";
    return `Monografia apresentada à Universidade Federal de Lavras, como parte das exigências do ${course}, para obtenção do ${degree}.`;
  }

  if (fields.workType === "dissertacao") {
    const program = defaultProgram(fields);
    if (!program) return "";
    return `Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do ${program}, para obtenção do título de Mestre em Ciências.`;
  }

  if (fields.workType === "tese") {
    const program = defaultProgram(fields);
    if (!program) return "";
    return `Tese apresentada à Universidade Federal de Lavras, como parte das exigências do ${program}, para obtenção do título de Doutor em Ciências.`;
  }

  return fields.workNature;
}

function isLocationLike(value: string, fields: AcademicFields): boolean {
  const text = fold(value);
  if (!text) return false;

  const location = fold(fields.location);
  if (location && text === location) return true;

  return /^(lavras|lavras mg|lavras - mg|mg)$/i.test(value.trim()) || /^[a-zà-ú\s]+\s-\s[a-z]{2}$/i.test(value.trim());
}

function sanitizeAdvisorFields(fields: AcademicFields): AcademicFields {
  return {
    ...fields,
    advisor: isLocationLike(fields.advisor, fields) ? "" : fields.advisor,
    coadvisor: isLocationLike(fields.coadvisor, fields) ? "" : fields.coadvisor,
  };
}

function removeCourseField(fields: AcademicFields): AcademicFields {
  return { ...fields, course: "" };
}

function sanitizeArticleFields(fields: AcademicFields): AcademicFields {
  return {
    ...fields,
    course: "",
    title: hasText(fields.title) ? fields.title : "Artigo acadêmico sem título detectado",
    workNature: "",
    dedicatoria: "",
    agradecimentos: "",
    epigrafe: "",
    indicadoresImpacto: "",
    impactIndicators: "",
    indice: "",
  };
}

function sanitizeCpgFields(fields: AcademicFields): AcademicFields {
  return {
    ...fields,
    course: normalizeCpgEmailLine(fields.course),
    workNature: "",
    dedicatoria: "",
    epigrafe: "",
    indicadoresImpacto: "",
    impactIndicators: "",
    anexos: "",
    apendices: "",
    indice: "",
  };
}

export function normalizeFieldsForSelectedModel(fields: AcademicFields): AcademicFields {
  const normalizedWorkType = normalizeWorkType(fields.workType);
  const normalizedFields: AcademicFields =
    fields.workType === normalizedWorkType ? fields : { ...fields, workType: normalizedWorkType };

  if (normalizedFields.workType === "artigo") return sanitizeArticleFields(normalizedFields);
  if (
    normalizedFields.workType === "resumo_cpg" ||
    normalizedFields.workType === "resumo_expandido_cpg" ||
    normalizedFields.workType === "artigo_completo_cpg"
  ) {
    return sanitizeCpgFields(normalizedFields);
  }

  if (
    normalizedFields.workType === "projeto_pesquisa" ||
    normalizedFields.workType === "monografia" ||
    normalizedFields.workType === "dissertacao" ||
    normalizedFields.workType === "tese"
  ) {
    const sanitizedAdvisor = sanitizeAdvisorFields(normalizedFields);
    const sanitized = normalizedFields.workType === "monografia" ? sanitizedAdvisor : removeCourseField(sanitizedAdvisor);
    const workNature = isGenericOrMismatchedNature(sanitized.workNature, sanitized.workType)
      ? natureForSelectedModel(sanitized)
      : sanitized.workNature;

    return {
      ...sanitized,
      workNature,
    };
  }

  if (isUflaCollectionWork(normalizedFields.workType)) {
    const sanitized = removeCourseField(sanitizeAdvisorFields(normalizedFields));
    if (!hasText(sanitized.workNature) || isGenericOrMismatchedNature(sanitized.workNature, sanitized.workType)) {
      return {
        ...sanitized,
        workNature: "Trabalho acadêmico apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.",
      };
    }
    return sanitized;
  }

  if (!hasText(normalizedFields.workNature)) {
    return {
      ...normalizedFields,
      workNature:
        "Trabalho apresentado à Universidade Federal de Lavras como requisito acadêmico, conforme dados revisados pelo usuário.",
    };
  }

  return sanitizeAdvisorFields(normalizedFields);
}
