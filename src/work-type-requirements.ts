import {
  type WorkTypeValue,
  isCpgWork,
  isResearchProject,
  isUflaCollectionWork,
} from "./ufla-rules";
import { normalizeWorkType } from "./work-type-resolver";

export interface WorkTypeRequirements {
  requiresInstitutionalMetadata: boolean;
  requiresProgramMetadata: boolean;
  requiresImpactIndicators: boolean;
  requiresCoverAndFrontMatter: boolean;
  requiresTableOfContents: boolean;
  requiresCatalogCard: boolean;
}

export function getWorkTypeRequirements(workType: WorkTypeValue | string): WorkTypeRequirements {
  const normalizedWorkType = normalizeWorkType(workType);
  const simpleArticle = normalizedWorkType === "artigo";
  const cpgWork = isCpgWork(normalizedWorkType);
  const graduateWork = normalizedWorkType === "dissertacao" || normalizedWorkType === "tese";
  const fullAcademicWork =
    normalizedWorkType === "monografia" ||
    graduateWork ||
    isResearchProject(normalizedWorkType) ||
    isUflaCollectionWork(normalizedWorkType) ||
    normalizedWorkType === "outro";

  return {
    requiresInstitutionalMetadata: !simpleArticle && !cpgWork && fullAcademicWork,
    requiresProgramMetadata: graduateWork || isResearchProject(normalizedWorkType),
    requiresImpactIndicators: graduateWork,
    requiresCoverAndFrontMatter: !simpleArticle && !cpgWork && fullAcademicWork,
    requiresTableOfContents: !simpleArticle && !cpgWork && fullAcademicWork,
    requiresCatalogCard: normalizedWorkType === "monografia" || graduateWork,
  };
}
