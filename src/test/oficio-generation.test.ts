import { describe, it, expect } from "vitest";

// Replicate the logic from generate-oficio for testing
const VOCATIVO_MAP: Record<string, string> = {
  'ARESAN': 'Excelentíssimo(a) Senhor(a) Diretor(a) Presidente,',
  'DMAE': 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,',
  'FUTEL': 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,',
  'IPREMU': 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,',
  'EMAM': 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,',
  'FERUB': 'Excelentíssimo(a) Senhor(a) Diretor(a),',
  'PRODAUB': 'Excelentíssimo(a) Senhor(a) Diretor(a),',
  'Polícia Militar (PMMG)': 'Senhor(a) Comandante,',
  'CEMIG': 'Prezado(a) Senhor(a),',
};

function normalizeSecretariaInput(s: string): string {
  return (s || '').replace(/^Secretaria Municipal de\s+/i, '').trim();
}

function getVocativoForSecretaria(s: string): string {
  const normalized = normalizeSecretariaInput(s);
  return VOCATIVO_MAP[s] || VOCATIVO_MAP[normalized] || 'Excelentíssimo(a) Senhor(a) Secretário(a),';
}

function getNomeOrgaoForSecretaria(s: string): string {
  const normalized = normalizeSecretariaInput(s);
  const m: Record<string, string> = {
    'DMAE': 'Departamento Municipal de Água e Esgoto',
    'ARESAN': 'Agência de Regulação dos Serviços de Saneamento Básico de Uberlândia',
    'FUTEL': 'Fundação Uberlandense do Turismo, Esporte e Lazer',
    'IPREMU': 'Instituto de Previdência dos Servidores Públicos do Município de Uberlândia',
    'EMAM': 'Empresa Municipal de Apoio e Manutenção',
    'FERUB': 'Fundação de Excelência Rural de Uberlândia',
    'PRODAUB': 'Processamento de Dados de Uberlândia',
    'HC/UFU': 'Hospital de Clínicas da Universidade Federal de Uberlândia',
    'SETTRAN': 'Secretaria Municipal de Trânsito e Transportes',
    'Trânsito e Transportes (SETTRAN)': 'Secretaria Municipal de Trânsito e Transportes',
    'Trânsito e Transportes': 'Secretaria Municipal de Trânsito e Transportes',
    'Gestão Ambiental e Sustentabilidade': 'Secretaria Municipal de Meio Ambiente e Sustentabilidade',
    'PMMG': 'Polícia Militar de Minas Gerais',
    'Polícia Militar (PMMG)': 'Polícia Militar de Minas Gerais',
    'CEMIG': 'Companhia Energética de Minas Gerais',
    'PROCON': 'PROCON Municipal de Uberlândia',
    'DNIT': 'Departamento Nacional de Infraestrutura de Transportes',
    'DER-MG': 'Departamento de Edificações e Estradas de Rodagem de Minas Gerais',
  };
  if (m[s]) return m[s];
  if (m[normalized]) return m[normalized];
  const cleanName = normalized.replace(/\s*\([^)]+\)\s*/g, '').trim();
  if (cleanName) return `Secretaria Municipal de ${cleanName}`;
  return normalized;
}

function getArtigo(nomeOrgao: string): string {
  const masculineStarts = ['Departamento', 'Instituto', 'PROCON', 'Ministério', 'Batalhão', 'Hospital', 'Processamento', 'DNIT'];
  return masculineStarts.some(p => nomeOrgao.startsWith(p)) ? 'o' : 'a';
}

describe("getNomeOrgaoForSecretaria", () => {
  it("should never return raw acronyms", () => {
    const siglas = ['SETTRAN', 'HC/UFU', 'PMMG', 'CEMIG', 'PROCON', 'DNIT', 'DER-MG', 'PRODAUB', 'FUTEL', 'DMAE'];
    for (const sigla of siglas) {
      const nome = getNomeOrgaoForSecretaria(sigla);
      expect(nome).not.toBe(sigla);
      expect(nome.length).toBeGreaterThan(sigla.length);
    }
  });

  it("should return full name for SETTRAN variants", () => {
    expect(getNomeOrgaoForSecretaria('SETTRAN')).toBe('Secretaria Municipal de Trânsito e Transportes');
    expect(getNomeOrgaoForSecretaria('Trânsito e Transportes (SETTRAN)')).toBe('Secretaria Municipal de Trânsito e Transportes');
    expect(getNomeOrgaoForSecretaria('Trânsito e Transportes')).toBe('Secretaria Municipal de Trânsito e Transportes');
  });

  it("should return full name for HC/UFU", () => {
    expect(getNomeOrgaoForSecretaria('HC/UFU')).toBe('Hospital de Clínicas da Universidade Federal de Uberlândia');
  });

  it("should prefix 'Secretaria Municipal de' for regular departments", () => {
    expect(getNomeOrgaoForSecretaria('Saúde')).toBe('Secretaria Municipal de Saúde');
    expect(getNomeOrgaoForSecretaria('Educação')).toBe('Secretaria Municipal de Educação');
    expect(getNomeOrgaoForSecretaria('Infraestrutura')).toBe('Secretaria Municipal de Infraestrutura');
  });
});

describe("getArtigo", () => {
  it("should return 'o' for masculine entities", () => {
    expect(getArtigo('Departamento Municipal de Água e Esgoto')).toBe('o');
    expect(getArtigo('Departamento Nacional de Infraestrutura de Transportes')).toBe('o');
    expect(getArtigo('Hospital de Clínicas da Universidade Federal de Uberlândia')).toBe('o');
    expect(getArtigo('Processamento de Dados de Uberlândia')).toBe('o');
    expect(getArtigo('PROCON Municipal de Uberlândia')).toBe('o');
    expect(getArtigo('Instituto de Previdência dos Servidores Públicos do Município de Uberlândia')).toBe('o');
  });

  it("should return 'a' for feminine entities (Secretaria, Companhia, etc)", () => {
    expect(getArtigo('Secretaria Municipal de Saúde')).toBe('a');
    expect(getArtigo('Secretaria Municipal de Trânsito e Transportes')).toBe('a');
    expect(getArtigo('Companhia Energética de Minas Gerais')).toBe('a');
    expect(getArtigo('Agência de Regulação dos Serviços de Saneamento Básico de Uberlândia')).toBe('a');
    expect(getArtigo('Polícia Militar de Minas Gerais')).toBe('a');
    expect(getArtigo('Fundação Uberlandense do Turismo, Esporte e Lazer')).toBe('a');
  });
});

describe("getVocativoForSecretaria", () => {
  it("should return correct vocativo for special entities", () => {
    expect(getVocativoForSecretaria('DMAE')).toContain('Diretor');
    expect(getVocativoForSecretaria('FUTEL')).toContain('Diretor');
    expect(getVocativoForSecretaria('CEMIG')).toContain('Prezado');
    expect(getVocativoForSecretaria('Polícia Militar (PMMG)')).toContain('Comandante');
  });

  it("should default to Secretário for regular secretarias", () => {
    expect(getVocativoForSecretaria('Saúde')).toContain('Secretário');
    expect(getVocativoForSecretaria('Educação')).toContain('Secretário');
  });
});

describe("End-to-end closing text", () => {
  it("should produce correct closing for each entity", () => {
    const cases = [
      { input: 'SETTRAN', expected: 'apreciação da Secretaria Municipal de Trânsito e Transportes' },
      { input: 'DMAE', expected: 'apreciação do Departamento Municipal de Água e Esgoto' },
      { input: 'PMMG', expected: 'apreciação da Polícia Militar de Minas Gerais' },
      { input: 'CEMIG', expected: 'apreciação da Companhia Energética de Minas Gerais' },
      { input: 'PROCON', expected: 'apreciação do PROCON Municipal de Uberlândia' },
      { input: 'DNIT', expected: 'apreciação do Departamento Nacional de Infraestrutura de Transportes' },
      { input: 'HC/UFU', expected: 'apreciação do Hospital de Clínicas da Universidade Federal de Uberlândia' },
      { input: 'PRODAUB', expected: 'apreciação do Processamento de Dados de Uberlândia' },
      { input: 'Saúde', expected: 'apreciação da Secretaria Municipal de Saúde' },
    ];

    for (const c of cases) {
      const nomeOrgao = getNomeOrgaoForSecretaria(c.input);
      const artigo = getArtigo(nomeOrgao);
      const closing = `apreciação d${artigo} ${nomeOrgao}`;
      expect(closing).toBe(c.expected);
    }
  });
});
