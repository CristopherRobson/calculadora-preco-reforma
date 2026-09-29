// Motor de cálculo da precificação pós-Reforma Tributária.
// Funções puras, sem dependência de interface. Frações (0,0931 = 9,31%).
// Regra de arredondamento (seção 5.8): cada linha é exibida a 2 casas; os valores
// de CBS e IBS são arredondados separadamente e a nota é preço + CBS + IBS arredondados.

import { r2, R, P, N4 } from './numeros.js';
import { ANOS, BASE_LEGAL as BL, REGIMES, taxasDoAno } from './premissas.js';

const pct = (x) => (Number(x) || 0) / 100;

// ---------------------------------------------------------------------------
// Memória de cálculo
// ---------------------------------------------------------------------------

export class Memoria {
  constructor() {
    this.itens = {};
  }
  /** Registra um número e devolve o próprio valor. */
  reg(id, valor, { rotulo, tipo = 'rs', formula, subst, base, alerta } = {}) {
    this.itens[id] = { id, valor, rotulo, tipo, formula, subst, base, alerta };
    return valor;
  }
}

// ---------------------------------------------------------------------------
// Núcleo: formação do preço (T1)
// ---------------------------------------------------------------------------

/**
 * Coeficientes do ICMS e da nota por R$ 1 de preço.
 * Chave N: ICMS = preço × ic; nota = preço × (1 + (1 − ic) × a).
 * Chave S: k = (1 + a) ÷ (1 + ic × a); ICMS = ic × nota = preço × ic × k; nota = preço × k.
 */
export function coeficientes({ ic, a, chaveS }) {
  if (chaveS && a > 0 && ic > 0) {
    const k = (1 + a) / (1 + ic * a);
    return { k, e: ic * k, notaCoef: k };
  }
  return { k: null, e: ic, notaCoef: 1 + (1 - ic) * a };
}

/** IBS e CBS destacados, arredondados separadamente, e a nota resultante. */
export function destaque(preco, { e, cbs, ibs, porFora = true }) {
  if (!porFora) return { base: 0, cbsV: 0, ibsV: 0, ibsCbs: 0, nota: r2(preco) };
  const base = preco - preco * e;
  const cbsV = r2(base * cbs);
  const ibsV = r2(base * ibs);
  return { base, cbsV, ibsV, ibsCbs: r2(cbsV + ibsV), nota: r2(r2(preco) + cbsV + ibsV) };
}

/**
 * Markup genérico: tributos por dentro no divisor, IBS/CBS por fora.
 * @param {object} o custo, dentro (Σd sem ICMS), ic, despesas, margem, cbs, ibs, chaveS, porFora
 */
export function formarPreco({ custo, dentro = 0, ic = 0, despesas = 0, margem = 0, cbs = 0, ibs = 0, chaveS = false, porFora = true }) {
  const a = porFora ? cbs + ibs : 0;
  const { k, e } = coeficientes({ ic, a, chaveS });
  const sigma = dentro + e;
  const divisor = 1 - (sigma + despesas + margem);
  if (!(divisor > 0)) throw new ErroCalculo('A soma de tributos por dentro, despesas e margem chega a 100% ou mais. Reduza a margem ou as despesas.');
  const multiplicador = 1 / divisor;
  const preco = custo * multiplicador;
  const d = destaque(preco, { e, cbs, ibs, porFora });
  return {
    divisor,
    multiplicador,
    preco,
    k,
    e,
    icms: preco * e,
    tributos: preco * sigma,
    despesas: preco * despesas,
    lucro: preco * margem,
    ...d,
  };
}

export class ErroCalculo extends Error {}

// ---------------------------------------------------------------------------
// Custo real da compra (T2)
// ---------------------------------------------------------------------------

/**
 * @param {object} o V, fornecedor, dasFornecedor (fração), parcela (fração do DAS que é IBS/CBS),
 *   compradorCredita, usoPessoal, cbs, ibs, pisNaoCum, pisCum
 */
export function custoDaCompra({ V, fornecedor, dasFornecedor = 0, parcela = 0.155, compradorCredita, usoPessoal = false, cbs, ibs, pisNaoCum = 0.0925, pisCum = 0.0365 }) {
  const credita = compradorCredita && !usoPessoal;
  if (fornecedor === 'simples_unico') {
    const creditoPossivel = r2(V * dasFornecedor * parcela);
    const credito = credita ? creditoPossivel : 0;
    return { s: 0, sai: 0, base: null, cbsV: 0, ibsV: 0, nota: r2(V), creditoPossivel, credito, custo: r2(V - credito) };
  }
  const s = fornecedor === 'real' ? pisNaoCum : fornecedor === 'presumido' ? pisCum : dasFornecedor * parcela;
  const base = r2(V * (1 - s));
  const cbsV = r2(base * cbs);
  const ibsV = r2(base * ibs);
  const nota = r2(base + cbsV + ibsV);
  const creditoPossivel = r2(cbsV + ibsV);
  const credito = credita ? creditoPossivel : 0;
  return { s, sai: r2(V - base), base, cbsV, ibsV, nota, creditoPossivel, credito, custo: r2(nota - credito) };
}

/** Custo de hoje: o comprador do Lucro Real credita o PIS/Cofins (9,25%). */
export function custoHoje({ V, regimeComprador, usoPessoal = false, pisNaoCum = 0.0925 }) {
  if (regimeComprador === 'real' && !usoPessoal) return r2(V * (1 - pisNaoCum));
  return r2(V);
}

// ---------------------------------------------------------------------------
// Tributos por dentro da empresa vendedora (seção 5.2)
// ---------------------------------------------------------------------------

export function aliquotaPresumido(p, atividade = 'comercio') {
  const pr = p.presuncao[atividade] || p.presuncao.comercio;
  return pct(p.aliqIrpj) * pct(pr.irpj) + pct(p.aliqCsll) * pct(pr.csll);
}

/**
 * Monta o contexto tributário do vendedor num cenário.
 * @returns itens por dentro (sem ICMS), ic, porFora, irLair, cbs, ibs
 */
export function contextoVendedor({ regime, atividade, das = 0, p, taxas, hoje }) {
  const itens = [];
  const irPres = aliquotaPresumido(p, atividade);
  const presTxt = () => {
    const pr = p.presuncao[atividade] || p.presuncao.comercio;
    return `${R(p.aliqIrpj)}% × ${R(pr.irpj)}% + ${R(p.aliqCsll)}% × ${R(pr.csll)}% = ${P(irPres)}`;
  };
  let ic = 0;
  let porFora = !hoje;
  let irLair = 0;
  if (regime === 'presumido') {
    if (hoje) itens.push({ id: 'pis', nome: 'PIS/Cofins cumulativo', aliq: pct(p.pisCofinsCumulativo), base: BL.pisCum });
    itens.push({ id: 'irpres', nome: 'IRPJ/CSLL presumido', aliq: irPres, base: BL.presumido, detalhe: presTxt() });
    ic = hoje ? pct(p.icmsProduto) : taxas.ic;
  } else if (regime === 'real') {
    if (hoje) itens.push({ id: 'pis', nome: 'PIS/Cofins não cumulativo', aliq: pct(p.pisCofinsNaoCumulativo), base: BL.pisNaoCum });
    ic = hoje ? pct(p.icmsProduto) : taxas.ic;
    irLair = pct(p.irLucroReal);
  } else if (regime === 'simples_unico') {
    itens.push({ id: 'das', nome: 'DAS', aliq: das, base: BL.simples });
    porFora = false;
  } else if (regime === 'simples_hibrido') {
    if (hoje) itens.push({ id: 'das', nome: 'DAS', aliq: das, base: BL.simples });
    else
      itens.push({
        id: 'das',
        nome: 'DAS sem a parcela de IBS/CBS',
        aliq: das * (1 - pct(p.parcelaIbsCbsNoDas)),
        base: BL.hibrido,
        detalhe: `${P(das)} × (1 − ${R(p.parcelaIbsCbsNoDas)}%) = ${P(das * (1 - pct(p.parcelaIbsCbsNoDas)))}`,
      });
  }
  return {
    regime,
    hoje,
    itens,
    dentro: itens.reduce((s, i) => s + i.aliq, 0),
    ic,
    porFora,
    irLair,
    cbs: hoje ? 0 : taxas.cbs,
    ibs: hoje ? 0 : taxas.ibs,
  };
}

// ---------------------------------------------------------------------------
// DRE de um cenário a partir do preço (seção 5.6)
// ---------------------------------------------------------------------------

export function dre(preco, ctx, { custo, despesas, chaveS }) {
  const a = ctx.porFora ? ctx.cbs + ctx.ibs : 0;
  const { e, k, notaCoef } = coeficientes({ ic: ctx.ic, a, chaveS });
  const d = destaque(preco, { e, cbs: ctx.cbs, ibs: ctx.ibs, porFora: ctx.porFora });
  const aliq = (id) => ctx.itens.filter((i) => i.id === id).reduce((s, i) => s + i.aliq, 0);
  const pis = preco * aliq('pis');
  const das = preco * aliq('das');
  const icms = preco * e;
  const receitaLiquida = preco - pis - icms - das;
  const lucroBruto = receitaLiquida - custo;
  const desp = preco * despesas;
  const lair = lucroBruto - desp;
  const ir = ctx.irLair > 0 ? Math.max(0, lair * ctx.irLair) : preco * aliq('irpres');
  const lucroLiquido = lair - ir;
  return {
    preco,
    e,
    k,
    notaCoef,
    ...d,
    receitaBruta: preco,
    pis,
    icms,
    das,
    receitaLiquida,
    custo,
    lucroBruto,
    despesas: desp,
    lair,
    ir,
    lucroLiquido,
    margemLiquida: receitaLiquida > 0 ? lucroLiquido / receitaLiquida : 0,
  };
}

/** Sobra por R$ 1 de preço antes da margem: 1 − Σd − d (Σd já com o ICMS efetivo). */
function sobra(ctx, despesas, chaveS) {
  const a = ctx.porFora ? ctx.cbs + ctx.ibs : 0;
  const { e } = coeficientes({ ic: ctx.ic, a, chaveS });
  return { k1: 1 - ctx.dentro - e - despesas, e, a };
}

// ---------------------------------------------------------------------------
// Simulação completa (seções 5.1 a 5.7)
// ---------------------------------------------------------------------------

export const ESTRATEGIAS = [
  { id: 'lucro', nome: 'Manter lucro', resumo: 'Mesmo lucro em R$ de hoje' },
  { id: 'repassar', nome: 'Repassar tudo', resumo: 'Mesma margem % de hoje' },
  { id: 'nota', nome: 'Manter a nota', resumo: 'Cliente paga o mesmo total' },
];

export const CLIENTES = {
  consumidor: { nome: 'Consumidor final ou uso pessoal', creditaHoje: false, creditaDepois: false },
  real: { nome: 'Empresa do Lucro Real', creditaHoje: true, creditaDepois: true },
  presumido_hibrido: { nome: 'Empresa do Presumido ou Simples Híbrido', creditaHoje: false, creditaDepois: true },
  simples_unico: { nome: 'Empresa do Simples Nacional', creditaHoje: false, creditaDepois: false },
};

export const FORNECEDORES = {
  real: 'Lucro Real',
  presumido: 'Lucro Presumido',
  simples_hibrido: 'Simples Híbrido',
  simples_unico: 'Simples Nacional',
};

export const ENTRADAS_PADRAO = {
  ano: 2027,
  regime: 'presumido',
  atividade: 'comercio',
  das: 8,
  valorCompra: 100,
  fornecedor: 'real',
  dasFornecedor: 8,
  usoPessoal: false,
  despesas: 10,
  modo: 'margem', // 'margem' | 'preco'
  margem: 20,
  precoHoje: '',
  cliente: 'consumidor',
};

/**
 * Executa a simulação completa para um ano.
 * @param {object} ent entradas da operação (percentuais em pontos)
 * @param {object} p premissas
 * @param {object} [opts] { memoria: boolean, custoAnoFixo, custoHojeFixo }
 */
export function simular(ent, p, opts = {}) {
  const mem = new Memoria();
  const ano = Number(ent.ano);
  const taxas = taxasDoAno(p, ano);
  const chaveS = !!p.chaveIbsCbsNaBaseIcms;
  const despesas = pct(ent.despesas);
  const das = pct(ent.das);
  const V = Number(ent.valorCompra) || 0;
  const parcela = pct(p.parcelaIbsCbsNoDas);
  const pisNaoCum = pct(p.pisCofinsNaoCumulativo);
  const pisCum = pct(p.pisCofinsCumulativo);
  const irLr = pct(p.irLucroReal);
  const ehReal = ent.regime === 'real';

  // --- Alíquotas do ano -----------------------------------------------------
  mem.reg('ano.cbs', taxas.cbs, { rotulo: `CBS ${ano}`, tipo: 'pct', formula: 'Alíquota de referência da CBS', subst: P(taxas.cbs), base: BL.cbs });
  mem.reg('ano.ibs', taxas.ibs, {
    rotulo: `IBS ${ano}`,
    tipo: 'pct',
    formula: taxas.ibsAuto ? 'IBS = (alíquota ICMS do produto − ICMS do ano) ÷ (1 − ICMS do ano)' : 'Alíquota informada nas premissas',
    subst: taxas.ibsAuto ? `(${P(taxas.aliqIcms)} − ${P(taxas.ic)}) ÷ (1 − ${P(taxas.ic)}) = ${P(taxas.ibs)}` : P(taxas.ibs),
    base: taxas.baseIbs,
    alerta: ano >= 2033 ? 'A reposição é da arrecadação total, não produto a produto.' : undefined,
  });
  mem.reg('ano.a', taxas.a, { rotulo: `IBS + CBS ${ano}`, tipo: 'pct', formula: 'a = CBS + IBS', subst: `${P(taxas.cbs)} + ${P(taxas.ibs)} = ${P(taxas.a)}`, base: BL.porFora });
  mem.reg('ano.ic', taxas.ic, {
    rotulo: `ICMS ${ano}`,
    tipo: 'pct',
    formula: 'ICMS do ano = alíquota do produto × fator do ano',
    subst: `${P(taxas.aliqIcms)} × ${String(taxas.fator).replace('.', ',')} = ${P(taxas.ic)}`,
    base: BL.icmsFator,
  });

  // --- Custos ---------------------------------------------------------------
  const compradorCredita = ent.regime !== 'simples_unico';
  const compra = custoDaCompra({
    V,
    fornecedor: ent.fornecedor,
    dasFornecedor: pct(ent.dasFornecedor),
    parcela,
    compradorCredita,
    usoPessoal: !!ent.usoPessoal,
    cbs: taxas.cbs,
    ibs: taxas.ibs,
    pisNaoCum,
    pisCum,
  });
  const cHoje = opts.custoHojeFixo ?? custoHoje({ V, regimeComprador: ent.regime, usoPessoal: !!ent.usoPessoal, pisNaoCum });
  const cAno = opts.custoAnoFixo ?? compra.custo;
  registrarCompra(mem, { V, ent, compra, cHoje, taxas, compradorCredita, pisNaoCum, pisCum, parcela, ano });

  // --- Cenário hoje -----------------------------------------------------------
  const ctxHoje = contextoVendedor({ regime: ent.regime, atividade: ent.atividade, das, p, taxas, hoje: true });
  const ctxAno = contextoVendedor({ regime: ent.regime, atividade: ent.atividade, das, p, taxas, hoje: false });
  const sHoje = sobra(ctxHoje, despesas, false);

  // margem antes do IR usada no divisor (Lucro Real: margem informada é depois do IR)
  let margem;
  let precoHojeInformado = null;
  if (ent.modo === 'preco' && Number(ent.precoHoje) > 0) {
    precoHojeInformado = Number(ent.precoHoje);
    const mDiv = sHoje.k1 - cHoje / precoHojeInformado;
    margem = ehReal ? mDiv * (1 - irLr) : mDiv;
  } else {
    margem = pct(ent.margem);
  }
  const mDivisor = ehReal ? margem / (1 - irLr) : margem;

  if (!(sHoje.k1 - mDivisor > 0)) {
    throw new ErroCalculo('A soma de tributos, despesas e margem chega a 100% ou mais. Reduza a margem ou as despesas.');
  }

  const precoHoje = precoHojeInformado ?? cHoje / (sHoje.k1 - mDivisor);
  const hoje = dre(precoHoje, ctxHoje, { custo: cHoje, despesas, chaveS: false });
  hoje.divisor = sHoje.k1 - mDivisor;
  hoje.multiplicador = 1 / hoje.divisor;
  hoje.sigma = ctxHoje.dentro + sHoje.e;

  // --- Três estratégias no ano ------------------------------------------------
  const sAno = sobra(ctxAno, despesas, chaveS);
  const L0 = hoje.lucroLiquido;
  const N0 = hoje.nota;
  const res = { hoje };
  const divRepassar = sAno.k1 - mDivisor;
  if (!(divRepassar > 0)) throw new ErroCalculo('A soma de tributos, despesas e margem chega a 100% ou mais no ano escolhido.');
  const lairAlvo = ehReal ? L0 / (1 - irLr) : L0;
  const precos = {
    repassar: cAno / divRepassar,
    lucro: (cAno + lairAlvo) / sAno.k1,
    nota: N0 / (ctxAno.porFora ? coeficientes({ ic: ctxAno.ic, a: sAno.a, chaveS }).notaCoef : 1),
  };
  // Manter a nota: CBS e IBS arredondados separadamente podem deslocar a nota em 1 centavo;
  // o preço absorve a diferença para a nota ficar exatamente igual à de hoje.
  const precoNotaBruto = precos.nota;
  precos.nota = ajustarParaNota(precoNotaBruto, N0, (x) => dre(x, ctxAno, { custo: cAno, despesas, chaveS }).nota);
  for (const est of ESTRATEGIAS) {
    const c = dre(precos[est.id], ctxAno, { custo: cAno, despesas, chaveS });
    c.sigma = ctxAno.dentro + sAno.e;
    c.markupEquivalente = c.preco / cAno;
    c.custoAteNota = c.nota / cAno;
    res[est.id] = c;
  }
  res.nota.ajuste = precos.nota - precoNotaBruto;
  res.repassar.divisor = divRepassar;
  res.repassar.multiplicador = 1 / divRepassar;

  // --- Visão do cliente (5.7) ------------------------------------------------
  const cli = CLIENTES[ent.cliente] || CLIENTES.consumidor;
  const clienteHoje = cli.creditaHoje ? r2(N0 - r2(N0 * pisNaoCum)) : N0;
  const creditoCliente = (c) => {
    if (!cli.creditaDepois) return 0;
    if (ctxAno.porFora) return c.ibsCbs;
    if (ent.regime === 'simples_unico') return r2(c.preco * das * parcela);
    return 0;
  };
  for (const id of ['repassar', 'lucro', 'nota']) {
    const c = res[id];
    c.creditoCliente = creditoCliente(c);
    c.custoCliente = r2(c.nota - c.creditoCliente);
  }
  hoje.creditoCliente = cli.creditaHoje ? r2(N0 * pisNaoCum) : 0;
  hoje.custoCliente = clienteHoje;

  // --- Memória dos cenários --------------------------------------------------
  const infoCtx = { ent, taxas, ctxHoje, ctxAno, despesas, margem, mDivisor, ehReal, irLr, chaveS, cHoje, cAno, L0, N0, lairAlvo, precoHojeInformado, cli, parcela, das, pisNaoCum };
  registrarCenario(mem, 'hoje', hoje, infoCtx);
  for (const est of ESTRATEGIAS) registrarCenario(mem, est.id, res[est.id], infoCtx);

  return {
    ano,
    taxas,
    chaveS,
    compra,
    custoHoje: cHoje,
    custoAno: cAno,
    margem,
    margemDivisor: mDivisor,
    ctxHoje,
    ctxAno,
    cliente: cli,
    ...res,
    memoria: mem.itens,
  };
}

/** Linha do tempo 2027–2033 para a mesma operação. */
export function linhaDoTempo(ent, p, opts = {}) {
  return ANOS.map((ano) => {
    try {
      const s = simular({ ...ent, ano }, p, opts);
      return { ano, ic: s.taxas.ic, ibs: s.taxas.ibs, cbs: s.taxas.cbs, repassar: s.repassar, lucro: s.lucro, nota: s.nota, hoje: s.hoje, memoria: s.memoria };
    } catch (e) {
      return { ano, erro: e.message };
    }
  });
}

// ---------------------------------------------------------------------------
// Registro da memória
// ---------------------------------------------------------------------------

function registrarCompra(mem, { V, ent, compra, cHoje, taxas, compradorCredita, pisNaoCum, pisCum, parcela }) {
  const forn = FORNECEDORES[ent.fornecedor];
  const dasF = pct(ent.dasFornecedor);
  mem.reg('compra.V', V, { rotulo: 'Nota de compra hoje', formula: 'Valor informado', subst: R(V) });
  mem.reg('compra.hoje', cHoje, {
    rotulo: 'Custo da mercadoria hoje',
    formula: ent.regime === 'real' && !ent.usoPessoal ? 'Custo hoje = nota × (1 − PIS/Cofins 9,25%), pois o Lucro Real credita' : 'Custo hoje = nota de compra (sem crédito de PIS/Cofins)',
    subst: ent.regime === 'real' && !ent.usoPessoal ? `${R(V)} × (1 − ${P(pisNaoCum)}) = ${R(cHoje)}` : `${R(cHoje)}`,
    base: BL.pisNaoCum,
  });
  if (ent.fornecedor === 'simples_unico') {
    mem.reg('compra.nota', compra.nota, { rotulo: `Nota de compra ${taxas.ano}`, formula: 'Fornecedor do Simples: a nota não muda (IBS/CBS dentro do DAS)', subst: R(compra.nota), base: BL.simples });
    mem.reg('compra.credito', compra.credito, {
      rotulo: 'Crédito de IBS/CBS na compra',
      formula: compra.credito ? 'Crédito = nota × DAS do fornecedor × parcela de IBS/CBS no DAS' : 'Sem crédito: ' + motivoSemCredito(ent, compradorCredita),
      subst: compra.credito ? `${R(V)} × ${P(dasF)} × ${R(parcela * 100)}% = ${R(compra.credito)}` : '0,00',
      base: ent.usoPessoal ? BL.usoPessoal : BL.dasParcela,
    });
  } else {
    const txtS = ent.fornecedor === 'real' ? `PIS/Cofins ${P(pisNaoCum)}` : ent.fornecedor === 'presumido' ? `PIS/Cofins ${P(pisCum)}` : `DAS ${P(dasF)} × ${R(parcela * 100)}% = ${P(compra.s)}`;
    mem.reg('compra.base', compra.base, {
      rotulo: 'Preço do fornecedor sem o tributo que sai',
      formula: `Base = nota de hoje × (1 − tributo que sai do preço). Fornecedor ${forn}: sai ${txtS}`,
      subst: `${R(V)} × (1 − ${P(compra.s)}) = ${R(compra.base)}`,
      base: 'Premissa de repasse integral pelo fornecedor (seção 4.4)',
    });
    mem.reg('compra.cbs', compra.cbsV, { rotulo: 'CBS na nota de compra', formula: 'CBS = base × CBS do ano', subst: `${R(compra.base)} × ${P(taxas.cbs)} = ${R(compra.cbsV)}`, base: BL.porFora });
    mem.reg('compra.ibs', compra.ibsV, { rotulo: 'IBS na nota de compra', formula: 'IBS = base × IBS do ano', subst: `${R(compra.base)} × ${P(taxas.ibs)} = ${R(compra.ibsV)}`, base: BL.porFora });
    mem.reg('compra.nota', compra.nota, {
      rotulo: `Nota de compra ${taxas.ano}`,
      formula: 'Nota = base + CBS + IBS',
      subst: `${R(compra.base)} + ${R(compra.cbsV)} + ${R(compra.ibsV)} = ${R(compra.nota)}`,
      base: BL.porFora,
    });
    mem.reg('compra.credito', compra.credito, {
      rotulo: 'Crédito de IBS/CBS na compra',
      formula: compra.credito ? 'Crédito = CBS + IBS destacados na nota de compra' : 'Sem crédito: ' + motivoSemCredito(ent, compradorCredita),
      subst: compra.credito ? `${R(compra.cbsV)} + ${R(compra.ibsV)} = ${R(compra.credito)}` : '0,00',
      base: ent.usoPessoal ? BL.usoPessoal : BL.credito,
    });
  }
  mem.reg('compra.custo', compra.custo, {
    rotulo: `Custo real da mercadoria ${taxas.ano}`,
    formula: 'Custo real = nota de compra − crédito',
    subst: `${R(compra.nota)} − ${R(compra.credito)} = ${R(compra.custo)}`,
    base: BL.credito,
  });
}

function motivoSemCredito(ent, compradorCredita) {
  if (ent.usoPessoal) return 'compra para uso e consumo pessoal não dá crédito';
  if (!compradorCredita) return 'empresa no Simples Nacional (sem opção pelo híbrido) não toma crédito';
  return 'sem crédito';
}

const NOMES = { hoje: 'Hoje', repassar: 'Repassar tudo', lucro: 'Manter lucro', nota: 'Manter a nota' };

function registrarCenario(mem, id, c, x) {
  const { taxas, ctxHoje, ctxAno, despesas, margem, mDivisor, ehReal, irLr, chaveS, N0, lairAlvo, precoHojeInformado, cli, parcela, das, pisNaoCum } = x;
  const hoje = id === 'hoje';
  const ctx = hoje ? ctxHoje : ctxAno;
  const cen = NOMES[id];
  const custo = c.custo;
  const k = (s) => `${id}.${s}`;

  // Σd
  const itensTxt = ctx.itens.map((i) => `${i.nome} ${P(i.aliq)}`);
  if (c.e > 0) itensTxt.push(`ICMS ${P(c.e)}`);
  const sigmaSubst = itensTxt.length ? `${itensTxt.join(' + ')} = ${P(c.sigma)}` : '0,00%';
  mem.reg(k('sigma'), c.sigma, {
    rotulo: `Tributos por dentro (Σd) · ${cen}`,
    tipo: 'pct',
    formula: 'Σd = soma dos tributos que ficam dentro do preço. O IBS/CBS nunca entra aqui: é somado por fora, no fim.',
    subst: sigmaSubst,
    base: [...ctx.itens.map((i) => i.base), c.e > 0 ? BL.icms : null].filter(Boolean).join(' · '),
    alerta: chaveS && !hoje && c.k ? `Chave S: ICMS efetivo = ICMS do ano × k = ${P(ctx.ic)} × ${N4(c.k)} = ${P(c.e)}` : undefined,
  });

  const margemTxt = ehReal ? `margem ${P(margem)} ÷ (1 − ${P(irLr)}) = ${P(mDivisor)} (antes do IR)` : `margem ${P(margem)}`;

  // Preço
  if (hoje || id === 'repassar') {
    mem.reg(k('divisor'), c.divisor, {
      rotulo: `Divisor · ${cen}`,
      tipo: 'n4',
      formula: 'Divisor = 1 − (Σd + despesas + margem)' + (ehReal ? '. Lucro Real: a margem informada é depois do IR e vira margem antes do IR no divisor.' : ''),
      subst: `1 − (${P(c.sigma)} + ${P(despesas)} + ${P(mDivisor)}) = ${N4(c.divisor)}${ehReal ? ` · ${margemTxt}` : ''}`,
      base: BL.dre,
    });
    mem.reg(k('multiplicador'), c.multiplicador, {
      rotulo: `Multiplicador (markup) · ${cen}`,
      tipo: 'n4',
      formula: 'Multiplicador = 1 ÷ divisor',
      subst: `1 ÷ ${N4(c.divisor)} = ${N4(c.multiplicador)}`,
    });
  }
  let precoF;
  let precoS;
  if (hoje && precoHojeInformado) {
    precoF = 'Preço de venda de hoje informado. A margem é deduzida dele.';
    precoS = `${R(c.preco)} → margem = 1 − Σd − despesas − custo ÷ preço = ${P(mDivisor)}${ehReal ? ` antes do IR (${P(margem)} depois do IR)` : ''}`;
  } else if (hoje || id === 'repassar') {
    precoF = 'Preço = custo × multiplicador (= custo ÷ divisor)';
    precoS = `${R(custo)} ÷ ${N4(c.divisor)} = ${R(c.preco)}`;
  } else if (id === 'lucro') {
    precoF = ehReal
      ? 'Preço = (custo + lucro de hoje antes do IR) ÷ (1 − Σd − despesas). Lucro antes do IR = lucro líquido ÷ (1 − 34%)'
      : 'Preço = (custo + lucro de hoje) ÷ (1 − Σd − despesas)';
    precoS = `(${R(custo)} + ${R(lairAlvo)}) ÷ (1 − ${P(c.sigma)} − ${P(despesas)}) = ${R(c.preco)}`;
  } else {
    precoF = ctx.porFora ? (chaveS && c.k ? 'Preço = nota de hoje ÷ k' : 'Preço = nota de hoje ÷ (1 + (1 − ICMS) × a)') : 'Sem IBS/CBS por fora: preço = nota de hoje';
    precoS = ctx.porFora ? `${R(N0)} ÷ ${N4(c.notaCoef)} = ${R(c.preco)}` : `${R(N0)}`;
  }
  const ajuste = id === 'nota' && Math.abs(c.ajuste || 0) >= 0.0005;
  if (ajuste) precoS = `${R(N0)} ÷ ${N4(c.notaCoef)} = ${R(c.preco - c.ajuste)} → ajustado para ${R(c.preco)}`;
  mem.reg(k('preco'), c.preco, {
    rotulo: `Preço sem IBS/CBS (receita bruta) · ${cen}`,
    formula: precoF,
    subst: precoS,
    base: BL.foraReceita,
    alerta: ajuste
      ? c.nota === N0
        ? `Como CBS e IBS são arredondados separadamente, o preço foi ajustado em R$ ${R(Math.abs(c.ajuste))} para a nota fechar exatamente em ${R(N0)}.`
        : `Nenhum preço em centavos leva a nota exatamente a ${R(N0)} (CBS e IBS são arredondados separadamente e a nota pula 2 centavos). Usada a nota mais próxima sem passar da de hoje: ${R(c.nota)}.`
      : undefined,
  });
  if (!hoje && id !== 'repassar') {
    mem.reg(k('markup'), c.markupEquivalente, { rotulo: `Markup equivalente · ${cen}`, tipo: 'n4', formula: 'Markup = preço ÷ custo', subst: `${R(c.preco)} ÷ ${R(custo)} = ${N4(c.markupEquivalente)}` });
  }
  if (!hoje) {
    mem.reg(k('custoAteNota'), c.custoAteNota, { rotulo: `Do custo até a nota · ${cen}`, tipo: 'n4', formula: 'Nota ÷ custo', subst: `${R(c.nota)} ÷ ${R(custo)} = ${N4(c.custoAteNota)}` });
  }

  // IBS/CBS e nota
  if (!hoje && ctx.porFora) {
    const baseTxt = c.e > 0 ? `(${R(c.preco)} − ICMS ${R(c.icms)})` : R(c.preco);
    mem.reg(k('baseIbs'), c.base, {
      rotulo: `Base do IBS/CBS · ${cen}`,
      formula: 'Base = preço − ICMS (o ICMS não integra a base do IBS/CBS até 2032)',
      subst: `${R(c.preco)} − ${R(c.icms)} = ${R(c.base)}`,
      base: BL.icmsForaBaseIbs,
    });
    mem.reg(k('cbs'), c.cbsV, { rotulo: `CBS · ${cen}`, formula: 'CBS = base × CBS do ano', subst: `${baseTxt} × ${P(taxas.cbs)} = ${R(c.cbsV)}`, base: BL.porFora });
    mem.reg(k('ibs'), c.ibsV, { rotulo: `IBS · ${cen}`, formula: 'IBS = base × IBS do ano', subst: `${baseTxt} × ${P(taxas.ibs)} = ${R(c.ibsV)}`, base: BL.porFora });
    mem.reg(k('ibsCbs'), c.ibsCbs, { rotulo: `IBS/CBS destacado · ${cen}`, formula: 'CBS + IBS, cada um arredondado a 2 casas. Por fora: não entra no divisor.', subst: `${R(c.cbsV)} + ${R(c.ibsV)} = ${R(c.ibsCbs)}`, base: BL.porFora });
    mem.reg(k('nota'), c.nota, { rotulo: `Nota (valor cobrado) · ${cen}`, formula: 'Nota = preço + CBS + IBS (valores arredondados, como na nota fiscal)', subst: `${R(c.preco)} + ${R(c.cbsV)} + ${R(c.ibsV)} = ${R(c.nota)}`, base: BL.arred });
  } else {
    mem.reg(k('ibsCbs'), 0, { rotulo: `IBS/CBS destacado · ${cen}`, formula: hoje ? 'Não existe hoje' : 'Simples Nacional: o IBS/CBS continua dentro do DAS, nada por fora', subst: '0,00', base: hoje ? undefined : BL.dasParcela });
    mem.reg(k('nota'), c.nota, { rotulo: `Nota (valor cobrado) · ${cen}`, formula: hoje ? 'Hoje todos os tributos estão por dentro: nota = preço' : 'Sem IBS/CBS por fora: nota = preço', subst: R(c.nota) });
  }

  // DRE
  const ali = (idItem) => ctx.itens.find((i) => i.id === idItem);
  mem.reg(k('receitaBruta'), c.receitaBruta, { rotulo: `Receita bruta · ${cen}`, formula: 'Receita bruta = nota − IBS/CBS (o IBS/CBS destacado não é receita)', subst: `${R(c.nota)} − ${R(c.ibsCbs)} = ${R(c.receitaBruta)}`, base: BL.foraReceita });
  if (ali('pis')) mem.reg(k('pis'), c.pis, { rotulo: `PIS/Cofins · ${cen}`, formula: 'PIS/Cofins = receita bruta × alíquota', subst: `${R(c.preco)} × ${P(ali('pis').aliq)} = ${R(c.pis)}`, base: ali('pis').base });
  if (c.e > 0) mem.reg(k('icms'), c.icms, { rotulo: `ICMS · ${cen}`, formula: chaveS && c.k ? 'ICMS = ICMS do ano × nota (chave S: IBS/CBS na base do ICMS)' : 'ICMS = receita bruta × alíquota do ICMS', subst: `${R(c.preco)} × ${P(c.e)} = ${R(c.icms)}`, base: BL.icms });
  if (ali('das')) mem.reg(k('das'), c.das, { rotulo: `DAS · ${cen}`, formula: 'DAS = receita bruta × alíquota efetiva', subst: `${R(c.preco)} × ${P(ali('das').aliq)} = ${R(c.das)}` + (ali('das').detalhe ? ` · ${ali('das').detalhe}` : ''), base: ali('das').base });
  const dedTxt = [R(c.receitaBruta), ali('pis') && R(c.pis), c.e > 0 && R(c.icms), ali('das') && R(c.das)].filter(Boolean).join(' − ');
  mem.reg(k('receitaLiquida'), c.receitaLiquida, {
    rotulo: `Receita líquida · ${cen}`,
    formula: 'Receita líquida = receita bruta − tributos sobre a venda',
    subst: `${dedTxt} = ${R(c.receitaLiquida)}`,
    base: BL.dre,
    alerta: difArred(c.receitaLiquida, [c.receitaBruta, -c.pis, -c.icms, -c.das]),
  });
  mem.reg(k('custo'), custo, {
    rotulo: `Custo da mercadoria · ${cen}`,
    formula: hoje ? 'Custo de hoje (ver compra)' : 'Custo real = nota de compra − crédito',
    subst: R(custo),
    base: hoje ? BL.pisNaoCum : BL.credito,
  });
  mem.reg(k('lucroBruto'), c.lucroBruto, { rotulo: `Lucro bruto · ${cen}`, formula: 'Lucro bruto = receita líquida − custo', subst: `${R(c.receitaLiquida)} − ${R(custo)} = ${R(c.lucroBruto)}`, base: BL.dre, alerta: difArred(c.lucroBruto, [c.receitaLiquida, -custo]) });
  mem.reg(k('despesas'), c.despesas, { rotulo: `Despesas · ${cen}`, formula: 'Despesas = receita bruta × despesas %', subst: `${R(c.preco)} × ${P(despesas)} = ${R(c.despesas)}` });
  mem.reg(k('lair'), c.lair, { rotulo: `Lucro antes do IR/CSLL · ${cen}`, formula: 'LAIR = lucro bruto − despesas', subst: `${R(c.lucroBruto)} − ${R(c.despesas)} = ${R(c.lair)}`, base: BL.dre, alerta: difArred(c.lair, [c.lucroBruto, -c.despesas]) });
  let irF;
  let irS;
  let irB;
  if (ali('irpres')) {
    irF = 'IRPJ/CSLL = receita bruta × alíquota presumida';
    irS = `${R(c.preco)} × ${P(ali('irpres').aliq)} = ${R(c.ir)} · ${ali('irpres').detalhe}`;
    irB = BL.presumido;
  } else if (ctx.irLair > 0) {
    irF = 'Provisão IRPJ/CSLL = LAIR × 34%';
    irS = `${R(c.lair)} × ${P(ctx.irLair)} = ${R(c.ir)}`;
    irB = BL.lucroReal;
  } else {
    irF = 'Simples Nacional: IRPJ/CSLL já estão dentro do DAS';
    irS = '0,00';
    irB = BL.simples;
  }
  mem.reg(k('ir'), c.ir, { rotulo: `IRPJ/CSLL · ${cen}`, formula: irF, subst: irS, base: irB });
  mem.reg(k('lucroLiquido'), c.lucroLiquido, {
    rotulo: `Lucro líquido · ${cen}`,
    formula: 'Lucro líquido = LAIR − IRPJ/CSLL' + (id === 'lucro' ? ' (igual ao de hoje, por construção)' : ''),
    subst: `${R(c.lair)} − ${R(c.ir)} = ${R(c.lucroLiquido)}`,
    base: BL.dre,
    alerta: difArred(c.lucroLiquido, [c.lair, -c.ir]),
  });
  mem.reg(k('margemLiquida'), c.margemLiquida, { rotulo: `Margem líquida · ${cen}`, tipo: 'pct', formula: 'Margem líquida = lucro líquido ÷ receita líquida', subst: `${R(c.lucroLiquido)} ÷ ${R(c.receitaLiquida)} = ${P(c.margemLiquida)}`, base: BL.dre });

  // Cliente
  let cliF;
  let cliS;
  if (hoje) {
    cliF = cli.creditaHoje ? 'Cliente do Lucro Real: nota − crédito de PIS/Cofins (9,25%)' : 'Cliente não toma crédito hoje: paga a nota';
    cliS = cli.creditaHoje ? `${R(c.nota)} − ${R(c.nota)} × ${P(pisNaoCum)} = ${R(c.custoCliente)}` : R(c.custoCliente);
  } else if (c.creditoCliente) {
    cliF = ctx.porFora ? 'Cliente que credita: nota − IBS/CBS destacado' : 'Cliente que credita, vendedor do Simples: nota − parcela de IBS/CBS do DAS';
    cliS = ctx.porFora ? `${R(c.nota)} − ${R(c.ibsCbs)} = ${R(c.custoCliente)}` : `${R(c.nota)} − ${R(c.preco)} × ${P(das)} × ${R(parcela * 100)}% = ${R(c.custoCliente)}`;
  } else {
    cliF = 'Cliente que não credita (consumidor final, uso pessoal ou Simples): paga a nota inteira';
    cliS = R(c.custoCliente);
  }
  mem.reg(k('custoCliente'), c.custoCliente, { rotulo: `Custo para o cliente · ${cen}`, formula: `${cli.nome}: ${cliF}`, subst: cliS, base: hoje ? BL.pisNaoCum : BL.credito });
  if (!hoje) {
    mem.reg(k('custoClienteCredita'), r2(c.nota - (ctx.porFora ? c.ibsCbs : r2(c.preco * das * parcela))), {
      rotulo: `Cliente que credita · ${cen}`,
      formula: ctx.porFora ? 'Nota − IBS/CBS destacado' : 'Nota − parcela de IBS/CBS do DAS',
      subst: ctx.porFora ? `${R(c.nota)} − ${R(c.ibsCbs)} = ${R(c.nota - c.ibsCbs)}` : `${R(c.nota)} − ${R(r2(c.preco * das * parcela))}`,
      base: BL.credito,
    });
    mem.reg(k('custoClienteNaoCredita'), c.nota, { rotulo: `Cliente que não credita · ${cen}`, formula: 'Paga a nota inteira', subst: R(c.nota), base: BL.usoPessoal });
  }
}

/**
 * Procura, centavo a centavo em volta do preço exato, o preço cuja nota (preço + CBS + IBS
 * arredondados) fecha em N0. Às vezes nenhum fecha (a nota pula 2 centavos); aí fica com a
 * nota mais próxima sem passar de N0, porque a estratégia promete que o cliente não paga mais.
 */
function ajustarParaNota(bruto, N0, notaDe) {
  if (Math.abs(notaDe(bruto) - N0) < 0.005) return bruto;
  const candidatos = [];
  for (let c = -5; c <= 5; c++) {
    const x = r2(r2(bruto) + c / 100);
    candidatos.push({ x, dif: r2(notaDe(x) - N0) });
  }
  const exato = candidatos.filter((c) => c.dif === 0).sort((a, b) => Math.abs(a.x - bruto) - Math.abs(b.x - bruto))[0];
  if (exato) return exato.x;
  const abaixo = candidatos.filter((c) => c.dif < 0).sort((a, b) => b.dif - a.dif)[0];
  return abaixo ? abaixo.x : bruto;
}

/** Sinaliza quando a soma das linhas exibidas difere do valor exato arredondado. */
function difArred(valor, partes) {
  const soma = r2(partes.reduce((s, x) => s + r2(x), 0));
  const exibido = r2(valor);
  if (Math.abs(soma - exibido) >= 0.005) {
    return `Diferença de arredondamento de R$ ${R(Math.abs(soma - exibido))}: somando as linhas exibidas dá ${R(soma)}; o valor exato é ${R(exibido)}.`;
  }
  return undefined;
}

export { REGIMES };
