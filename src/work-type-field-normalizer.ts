import { isUflaCollectionWork, type AcademicFields } from "./ufla-rules";
import { academicProductionTypeById } from "./academic-production-types";
import { findUflaPpgProgram, formatUflaPpgProgram } from "./ufla-ppg-programs";

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
  const text = fold(value);
  if (!text) return true;

  if (text.includes("requisito academico") || text.includes("dados revisados pelo usuario")) return true;
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
  return formatUflaPpgProgram(fields.program);
}

function defaultCourse(fields: AcademicFields): string {
  return fields.course || "curso de graduação informado pelo usuário";
}

function undergraduateDegree(fields: AcademicFields): string {
  const course = fold(fields.course);
  if (course.includes("licenciatura")) return `Licenciado em ${fields.course.replace(/licenciatura em/i, "").trim() || "área informada"}`;
  if (course.includes("bacharelado")) return `Bacharel em ${fields.course.replace(/bacharelado em/i, "").trim() || "área informada"}`;
  return "grau acadêmico correspondente";
}

function natureForSelectedModel(fields: AcademicFields): string {
  if (fields.workType === "projeto_pesquisa") {
    return `Projeto de pesquisa apresentado à Universidade Federal de Lavras, como parte das atividades do ${defaultProgram(fields)}, para avaliação acadêmica.`;
  }

  if (fields.workType === "monografia") {
    return `Monografia apresentada à Universidade Federal de Lavras, como parte das exigências do ${defaultCourse(fields)}, para obtenção do ${undergraduateDegree(fields)}.`;
  }

  if (fields.workType === "dissertacao") {
    return `Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do ${defaultProgram(fields)}, para obtenção do título de Mestre em Ciências.`;
  }

  if (fields.workType === "tese") {
    return `Tese apresentada à Universidade Federal de Lavras, como parte das exigências do ${defaultProgram(fields)}, para obtenção do título de Doutor em Ciências.`;
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

function sanitizeArticleFields(fields: AcademicFields): AcademicFields {
  return {
    ...fields,
    title: hasText(fields.title) ? fields.title : "Artigo acadêmico sem título detectado",
    workNature: "",
    dedicatoria: "",
    agradecimentos: "",
    epigrafe: "",
    indicadoresImpacto: "",
    impactIndicators: "",
  };
}

function sanitizeCpgFields(fields: AcademicFields): AcademicFields {
  return {
    ...fields,
    workNature: "",
    dedicatoria: "",
    epigrafe: "",
    indicadoresImpacto: "",
    impactIndicators: "",
    anexos: "",
    apendices: "",
  };
}

export function normalizeFieldsForSelectedModel(fields: AcademicFields): AcademicFields {
  if (fields.workType === "artigo") return sanitizeArticleFields(fields);
  if (
    fields.workType === "resumo_cpg" ||
    fields.workType === "resumo_expandido_cpg" ||
    fields.workType === "artigo_completo_cpg"
  ) {
    return sanitizeCpgFields(fields);
  }

  if (
    fields.workType === "projeto_pesquisa" ||
    fields.workType === "monografia" ||
    fields.workType === "dissertacao" ||
    fields.workType === "tese"
  ) {
    const sanitized = sanitizeAdvisorFields(fields);
    const workNature = isGenericOrMismatchedNature(sanitized.workNature, sanitized.workType)
      ? natureForSelectedModel(sanitized)
      : sanitized.workNature;

    return {
      ...sanitized,
      workNature,
    };
  }

  if (isUflaCollectionWork(fields.workType)) {
    const sanitized = sanitizeAdvisorFields(fields);
    const productionType = academicProductionTypeById(fields.workType);
    if (!hasText(sanitized.workNature) || isGenericOrMismatchedNature(sanitized.workNature, sanitized.workType)) {
      return {
        ...sanitized,
        workNature: `${productionType?.label ?? "Producao academica"} apresentada a Universidade Federal de Lavras conforme formato da Colecao Producao Academica UFLA, com suporte inicial no sistema.`,
      };
    }
    return sanitized;
  }

  if (!hasText(fields.workNature)) {
    return {
      ...fields,
      workNature:
        "Trabalho apresentado à Universidade Federal de Lavras como requisito acadêmico, conforme dados revisados pelo usuário.",
    };
  }

  return sanitizeAdvisorFields(fields);
}
