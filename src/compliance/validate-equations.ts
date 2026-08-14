export interface EquationValidationResult {
  isValid: boolean;
  rawOMMLCount: number;
  renderedCount: number;
  issues: string[];
}

const VALID_OMML_ELEMENTS = new Set([
  'm:oMath', 'm:oMathPara', 'm:r', 'm:t', 'm:f', 'm:num', 'm:den',
  'm:sqr', 'm:rad', 'm:deg', 'm:e', 'm:sub', 'm:sup', 'm:subSup',
  'm:borderBox', 'm:box', 'm:acc', 'm:lim', 'm:limLow', 'm:limUpp',
  'm:nary', 'm:sum', 'm:int', 'm:prod', 'm:coprod', 'm:script',
  'm:sSub', 'm:sSup', 'm:phant', 'm:d', 'm:arg', 'm:func',
  'm:groupChr', 'm:mr', 'm:mc', 'm:mat', 'm:naryProperties',
  'm:limLoc', 'm:chr', 'm:subHide', 'm:supHide', 'm:vertJc',
  'm:degHide', 'm:grow', 'm:defJc', 'm:limLower', 'm:limUpper',
  'm:supLoc', 'm:subLoc',
]);

export function extractEquationsFromOOXML(xmlContent: string): { equations: string[]; rawOMML: string[] } {
  const equations: string[] = [];
  const rawOMML: string[] = [];
  
  const oMathRegex = /<m:oMath[^>]*>([\s\S]*?)<\/m:oMath>/g;
  let match;
  
  while ((match = oMathRegex.exec(xmlContent)) !== null) {
    const fullMatch = match[0];
    const innerContent = match[1];
    
    equations.push(fullMatch);
    
    const hasStructure = /<(m:f|m:r|m:sqr|m:subSup|m:sub|m:sup|m:nary|m:sum|m:int|m:prod|m:mat|m:borderBox|m:acc|m:lim|m:limLow|m:limUpp|m:phant|m:d|m:func|m:groupChr|m:script|m:sSub|m:sSup)>/.test(innerContent);
    
    if (!hasStructure) {
      rawOMML.push(fullMatch);
    }
  }
  
  return { equations, rawOMML };
}

export function validateOMMLStructure(ommlContent: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  const allTags = ommlContent.match(/<m:[a-zA-Z]+[^>]*>/g) || [];
  
  for (const tag of allTags) {
    const tagName = tag.match(/<m:([a-zA-Z]+)/)?.[1];
    if (tagName && !VALID_OMML_ELEMENTS.has(`m:${tagName}`)) {
      issues.push(`Elemento OMML desconhecido: m:${tagName}`);
    }
  }
  
  const openTags = (ommlContent.match(/<m:[a-zA-Z]+[^>]*>/g) || []).length;
  const closeTags = (ommlContent.match(/<\/m:[a-zA-Z]+>/g) || []).length;
  
  if (openTags !== closeTags) {
    issues.push(`Tags desbalanceadas: ${openTags} abertas, ${closeTags} fechadas`);
  }
  
  return { isValid: issues.length === 0, issues };
}

export async function validateEquations(docxXML: string): Promise<EquationValidationResult> {
  const { equations, rawOMML } = extractEquationsFromOOXML(docxXML);
  const issues: string[] = [];
  
  if (rawOMML.length > 0) {
    issues.push(`${rawOMML.length} equaÃ§Ã£o(Ã§Ãµes) com OMML cru (nÃ£o renderizada)`);
    
    for (let i = 0; i < rawOMML.length; i++) {
      const { issues: ommlIssues } = validateOMMLStructure(rawOMML[i]);
      if (ommlIssues.length > 0) {
        issues.push(`EquaÃ§Ã£o ${i + 1}: ${ommlIssues.join(', ')}`);
      }
    }
  }
  
  const renderedCount = equations.length - rawOMML.length;
  
  return {
    isValid: rawOMML.length === 0,
    rawOMMLCount: rawOMML.length,
    renderedCount,
    issues
  };
}

export async function validateEquationsFromDocxString(docxContent: string): Promise<EquationValidationResult> {
  return validateEquations(docxContent);
}
