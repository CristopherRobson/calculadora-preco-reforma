// Parâmetros padrão (seção 4 da especificação). Percentuais em "pontos" (9,21 = 9,21%).

export const ANOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

export const PREMISSAS_PADRAO = {
  cbs: 9.21,
  // 2026 é o ano de teste: CBS 0,9% e IBS 0,1% destacados só para informação
  cbsTeste: 0.9,
  // null = valor padrão: 0,10% de 2026 a 2028, 18,70% a partir de 2033 e, de 2029 a 2032,
  // a hipótese de que o IBS repõe o ICMS/ISS que saiu. Um número aqui sobrescreve o padrão.
  ibsAno: { 2026: null, 2027: null, 2028: null, 2029: null, 2030: null, 2031: null, 2032: null, 2033: null },
  // Fator de redução do ICMS e do ISS (ADCT, art. 128)
  fatorIcms: { 2026: 1, 2027: 1, 2028: 1, 2029: 0.9, 2030: 0.8, 2031: 0.7, 2032: 0.6, 2033: 0 },
  icmsProduto: 19.5,
  issServico: 5,
  chaveIbsCbsNaBaseIcms: false,
  pisCofinsCumulativo: 3.65,
  pisCofinsNaoCumulativo: 9.25,
  aliqIrpj: 15,
  aliqCsll: 9,
  presuncao: {
    comercio: { irpj: 8, csll: 12 },
    servico: { irpj: 32, csll: 32 },
  },
  irLucroReal: 34,
  parcelaIbsCbsNoDas: 15.5,
  // DAS estimado do fornecedor do Simples (o comprador não sabe o DAS real dele)
  dasFornecedor: 8,
  // 'rs': despesa fixa em R$ calculada hoje e mantida nos anos seguintes
  // 'pct': despesa fixa sempre como % do custo do ano
  fixosModo: 'rs',
};

export const REGIMES = {
  presumido: 'Lucro Presumido',
  real: 'Lucro Real',
  simples_unico: 'Simples Nacional',
  simples_hibrido: 'Simples Híbrido',
};

export const BASE_LEGAL = {
  cbs: 'LC 214/2025; ADCT, arts. 125 a 127',
  teste2026: 'ADCT, art. 125 · LC 214/2025 (2026: destaque para teste, sem recolhimento)',
  ibs2728: 'ADCT, arts. 125 e 127',
  ibsTransicao: 'ADCT, art. 130 (hipótese: IBS repõe o ICMS/ISS que saiu)',
  ibs2033: 'ADCT, art. 130 (alíquota de referência)',
  icmsFator: 'ADCT, art. 128',
  icms: 'CF, art. 155, §2º, XII, i · LC 87/1996, art. 13, §1º, I · RE 582.461',
  icmsCredito: 'LC 87/1996, arts. 19 e 20 (crédito de ICMS)',
  iss: 'CF, art. 156, III · LC 116/2003',
  icmsForaBaseIbs: 'LC 214/2025, art. 12, §2º',
  porFora: 'CF, art. 156-A, §1º, IX · LC 214/2025, art. 12',
  foraReceita: 'DL 1.598/1977, art. 12, §4º',
  pisCum: 'Lei 10.637/2002, art. 8º; Lei 10.833/2003, art. 10',
  pisNaoCum: 'Leis 10.637/2002 e 10.833/2003',
  presumido: 'Lei 9.249/1995, arts. 15 e 20',
  lucroReal: 'Provisão de IRPJ/CSLL: 34% sobre o LAIR (sem adicional)',
  simples: 'LC 123/2006, arts. 13 e 18',
  dasParcela: 'LC 214/2025, art. 47, §9º',
  hibrido: 'LC 214/2025, art. 41, §3º',
  credito: 'LC 214/2025, art. 47 (crédito financeiro)',
  usoPessoal: 'LC 214/2025, art. 57',
  dre: 'Lei 6.404/1976, art. 187',
  arred: 'Seção 5.8: cada linha a 2 casas; nota = preço + CBS + IBS arredondados',
  repasse: 'Premissa de repasse integral pelo fornecedor (seção 4.4)',
};

/**
 * Alíquotas do ano, em frações.
 * @param {string} atividade 'comercio' (ICMS) ou 'servico' (ISS): define o tributo local
 */
export function taxasDoAno(p, ano, atividade = 'comercio') {
  const servico = atividade === 'servico';
  const nomeLocal = servico ? 'ISS' : 'ICMS';
  const fator = p.fatorIcms[ano] ?? 0;
  const aliqLocal = (servico ? p.issServico : p.icmsProduto) / 100;
  const ic = aliqLocal * fator;
  const teste = ano <= 2026;
  const cbs = (teste ? p.cbsTeste : p.cbs) / 100;
  const override = p.ibsAno[ano];
  let ibs;
  let ibsAuto = false;
  let baseIbs;
  if (override !== null && override !== undefined && override !== '') {
    ibs = Number(override) / 100;
    baseIbs = 'Valor informado nas premissas';
  } else if (ano <= 2028) {
    ibs = 0.001;
    baseIbs = teste ? BASE_LEGAL.teste2026 : BASE_LEGAL.ibs2728;
  } else if (ano >= 2033) {
    ibs = 0.187;
    baseIbs = BASE_LEGAL.ibs2033;
  } else {
    // 2029–2032: IBS = (alíquota local − local do ano) ÷ (1 − local do ano)
    ibs = ic >= 1 ? 0 : (aliqLocal - ic) / (1 - ic);
    ibsAuto = true;
    baseIbs = BASE_LEGAL.ibsTransicao;
  }
  return { ano, cbs, ibs, a: cbs + ibs, ic, fator, aliqLocal, aliqIcms: aliqLocal, nomeLocal, teste, ibsAuto, baseIbs };
}
