import { describe, it, expect } from 'vitest';
import { extractEquationsFromOOXML, validateOMMLStructure, validateEquations } from './validate-equations';

describe('validate-equations', () => {
  it('extrai equaÃ§Ãµes vÃ¡lidas com estrutura OMML', () => {
    const xml = `<w:document>
      <m:oMath><m:f><m:num><m:t>a</m:t></m:num><m:den><m:t>b</m:t></m:den></m:f></m:oMath>
    </w:document>`;
    
    const { equations, rawOMML } = extractEquationsFromOOXML(xml);
    
    expect(equations).toHaveLength(1);
    expect(rawOMML).toHaveLength(0);
  });

  it('detecta OMML cru (sem estrutura)', () => {
    const xml = `<w:document>
      <m:oMath><m:t>x^2 + y^2 = z^2</m:t></m:oMath>
    </w:document>`;
    
    const { equations, rawOMML } = extractEquationsFromOOXML(xml);
    
    expect(equations).toHaveLength(1);
    expect(rawOMML).toHaveLength(1);
  });

  it('valida estrutura OMML correta', () => {
    const omml = `<m:f><m:num><m:t>a</m:t></m:num><m:den><m:t>b</m:t></m:den></m:f>`;
    
    const { isValid, issues } = validateOMMLStructure(omml);
    
    expect(isValid).toBe(true);
    expect(issues).toHaveLength(0);
  });

  it('detecta tags desbalanceadas', () => {
    const omml = `<m:f><m:num><m:t>a</m:t></m:num></m:f>`;
    
    const { isValid, issues } = validateOMMLStructure(omml);
    
    expect(isValid).toBe(false);
    expect(issues.some(i => i.includes('desbalanceadas'))).toBe(true);
  });

  it('valida mÃºltiplas equaÃ§Ãµes', async () => {
    const xml = `<w:document>
      <m:oMath><m:f><m:num><m:t>a</m:t></m:num><m:den><m:t>b</m:t></m:den></m:f></m:oMath>
      <m:oMath><m:t>x + y</m:t></m:oMath>
    </w:document>`;
    
    const result = await validateEquations(xml);
    
    expect(result.renderedCount).toBe(1);
    expect(result.rawOMMLCount).toBe(1);
    expect(result.isValid).toBe(false);
  });
});
