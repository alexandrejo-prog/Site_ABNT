import {
  type WorkTypeValue,
  isCpgWork,
  isResearchProject,
  isUflaCollectionWork,
} from "./ufla-rules";

export interface WorkTypeRequirements {
  requiresInstitutionalMetadata: boolean;
  requiresProgramMetadata: boolean;
  requiresImpactIndicators: boolean;
  requiresCoverAndFrontMatter: boolean;
  requiresTableOfContents: boolean;
  requiresCatalogCard: boolean;
}

export function getWorkTypeRequirements(workType: WorkTypeValue): WorkTypeRequirements {
  const simpleArticle = workType === "artigo";
  const cpgWork = isCpgWork(workType);
  const graduateWork = workType === "dissertacao" || workType === "tese";
  const fullAcademicWork =
    workType === "monografia" ||
    graduateWork ||
    isResearchProject(workType) ||
    isUflaCollectionWork(workType) ||
    workType === "outro";

  return {
    requiresInstitutionalMetadata: !simpleArticle && !cpgWork && fullAcademicWork,
    requiresProgramMetadata: graduateWork || isResearchProject(workType),
    requiresImpactIndicators: graduateWork,
    requiresCoverAndFrontMatter: !simpleArticle && !cpgWork && fullAcademicWork,
    requiresTableOfContents: !simpleArticle && !cpgWork && fullAcademicWork,
    requiresCatalogCard: workType === "monografia" || graduateWork,
  };
}
