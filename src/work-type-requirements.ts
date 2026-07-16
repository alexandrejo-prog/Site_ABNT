import {
  type WorkTypeValue,
  isCpgWork,
  isLongFormThesis,
  isResearchProject,
  isUflaCollectionWork,
  requiresCatalogCard,
  requiresImpactIndicators,
  requiresTableOfContents,
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
  const graduateWork = isLongFormThesis(normalizedWorkType);
  const fullAcademicWork =
    isLongFormThesis(normalizedWorkType) ||
    isResearchProject(normalizedWorkType) ||
    isUflaCollectionWork(normalizedWorkType) ||
    normalizedWorkType === "outro";

  return {
    requiresInstitutionalMetadata: !simpleArticle && !cpgWork && fullAcademicWork,
    requiresProgramMetadata: graduateWork || isResearchProject(normalizedWorkType),
    requiresImpactIndicators: requiresImpactIndicators(normalizedWorkType),
    requiresCoverAndFrontMatter: !simpleArticle && !cpgWork && fullAcademicWork,
    requiresTableOfContents: requiresTableOfContents(normalizedWorkType),
    requiresCatalogCard: requiresCatalogCard(normalizedWorkType),
  };
}
