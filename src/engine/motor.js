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

export class ErroCalculo extends Error {}

// ---------------------------------------------------------------------------
// Núcleo: formação do preço (T1)
// ---------------------------------------------------------------------------

/**
 * Coeficientes do tributo local (ICMS/ISS) e da nota por R$ 1 de preço.
 * Chave N: local = preço × ic; nota = preço × (1 + (1 − ic) × a).
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
 * Markup: custos fixos somados ao custo; tributos por dentro, despesas variáveis e margem
 * no divisor; IBS/CBS por fora.
 * @param {object} o custo, fixos (R$), dentro (Σd sem ICMS), ic, despesas (variáveis), margem, cbs, ibs, chaveS, porFora
 */
export function formarPreco({ custo, fixos = 0, dentro = 0, ic = 0, despesas = 0, margem = 0, cbs = 0, ibs = 0, chaveS = false, porFora = true }) {
  const a = porFora ? cbs + ibs : 0;
  const { k, e } = coeficientes({ ic, a, chaveS });
  const sigma = dentro + e;
  const divisor = 1 - (sigma + despesas + margem);
  if (!(divisor > 0)) throw new ErroCalculo('A soma de tributos por dentro, despesas variáveis e margem chega a 100% ou mais. Reduza a margem ou as despesas.');
  const multiplicador = 1 / divisor;
  const preco = (custo + fixos) * multiplicador;
  const d = destaque(preco, { e, cbs, ibs, porFora });
  return { divisor, multiplicador, preco, k, e, icms: preco * e, tributos: preco * sigma, despesas: preco * despesas, lucro: preco * margem, ...d };
}

// ---------------------------------------------------------------------------
// Compra: custo de hoje e custo real no ano (T2)
// O valor da compra é informado SEM PIS/Cofins. Fornecedor do Simples: valor da nota.
// ---------------------------------------------------------------------------

const ehSimples = (r) => r === 'simples_unico' || r === 'simples_hibrido';

/** Nota e custo de hoje (PIS/Cofins ainda dentro do preço do fornecedor). */
export function compraHoje({ V, fornecedor, icmsFornecedor = 0, creditaPis = false, creditaIcms = false, pisCum = 0.0365, pisNaoCum = 0.0925 }) {
  if (ehSimples(fornecedor)) {
    const nota = r2(V);
    const creditoPis = creditaPis ? r2(nota * pisNaoCum) : 0;
    return { s: 0, nota, icmsV: 0, creditoPis, creditoIcms: 0, custo: r2(nota - creditoPis) };
  }
  const s = fornecedor === 'real' ? pisNaoCum : pisCum;
  const nota = r2(V / (1 - s));
  const icmsV = r2(nota * icmsFornecedor);
  const creditoPis = creditaPis ? r2(nota * pisNaoCum) : 0;
  const creditoIcms = creditaIcms ? icmsV : 0;
  return { s, nota, icmsV, creditoPis, creditoIcms, custo: r2(nota - creditoPis - creditoIcms) };
}

/**
 * Nota e custo real da compra no ano (a partir de 2027).
 * Repasse integral: o fornecedor mantém o preço líquido de tributos e ajusta o ICMS do ano.
 */
export function custoDaCompra({ V, fornecedor, dasFornecedor = 0.08, parcela = 0.155, icmsFornecedor = 0, fator = 1, creditaIbs, creditaIcms = false, cbs, ibs }) {
  if (fornecedor === 'simples_unico') {
    const nota = r2(V);
    const creditoPossivel = r2(V * dasFornecedor * parcela);
    const credito = creditaIbs ? creditoPossivel : 0;
    return { s: 0, base: null, precoForn: nota, icmsV: 0, icY: 0, cbsV: 0, ibsV: 0, nota, creditoIcms: 0, creditoPossivel, credito, custo: r2(nota - credito) };
  }
  let s = 0;
  let liquido;
  let precoForn;
  let icY = 0;
  if (fornecedor === 'simples_hibrido') {
    s = dasFornecedor * parcela;
    liquido = r2(V * (1 - s));
    precoForn = liquido;
  } else {
    icY = icmsFornecedor * fator;
    liquido = V * (1 - icmsFornecedor);
    precoForn = liquido / (1 - icY);
  }
  const icmsV = r2(precoForn * icY);
  const cbsV = r2(liquido * cbs);
  const ibsV = r2(liquido * ibs);
  const nota = r2(r2(precoForn) + cbsV + ibsV);
  const creditoPossivel = r2(cbsV + ibsV);
  const credito = creditaIbs ? creditoPossivel : 0;
  const creditoIcms = creditaIcms ? icmsV : 0;
  return { s, base: r2(liquido), liquido, precoForn, icmsV, icY, cbsV, ibsV, nota, creditoIcms, creditoPossivel, credito, custo: r2(nota - credito - creditoIcms) };
}

// ---------------------------------------------------------------------------
// Tributos por dentro da empresa vendedora (seção 5.2)
// ---------------------------------------------------------------------------

export function aliquotaPresumido(p, atividade = 'comercio') {
  const pr = p.presuncao[atividade] || p.presuncao.comercio;
  return pct(p.aliqIrpj) * pct(pr.irpj) + pct(p.aliqCsll) * pct(pr.csll);
}

/**
 * Contexto tributário do vendedor num cenário.
 * `hoje` = regime atual (também usado em 2026, ano de teste).
 */
export function contextoVendedor({ regime, atividade, das = 0, p, taxas, hoje }) {
  const itens = [];
  const irPres = aliquotaPresumido(p, atividade);
  const pr = p.presuncao[atividade] || p.presuncao.comercio;
  let ic = 0;
  let porFora = !hoje;
  let irLair = 0;
  const regular = regime === 'presumido' || regime === 'real';
  if (regime === 'presumido') {
    if (hoje) itens.push({ id: 'pis', nome: 'PIS/Cofins cumulativo', aliq: pct(p.pisCofinsCumulativo), base: BL.pisCum });
    itens.push({
      id: 'irpres',
      nome: 'IRPJ/CSLL presumido',
      aliq: irPres,
      base: BL.presumido,
      detalhe: `${R(p.aliqIrpj)}% × ${R(pr.irpj)}% + ${R(p.aliqCsll)}% × ${R(pr.csll)}% = ${P(irPres)}`,
    });
  } else if (regime === 'real') {
    if (hoje) itens.push({ id: 'pis', nome: 'PIS/Cofins não cumulativo', aliq: pct(p.pisCofinsNaoCumulativo), base: BL.pisNaoCum });
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
  if (regular) ic = hoje ? taxas.aliqLocal : taxas.ic;
  return {
    regime,
    hoje,
    itens,
    dentro: itens.reduce((s, i) => s + i.aliq, 0),
    ic,
    nomeLocal: taxas.nomeLocal,
    baseLocal: taxas.nomeLocal === 'ISS' ? BL.iss : BL.icms,
    porFora,
    irLair,
    cbs: hoje ? 0 : taxas.cbs,
    ibs: hoje ? 0 : taxas.ibs,
    // 2026: IBS/CBS destacados só para informação (empresas do regime regular)
    informativo: taxas.teste && regular,
  };
}

/** A chave S (IBS/CBS na base do ICMS) só vale para ICMS, não para ISS. */
const chaveEfetiva = (ctx, chaveS) => chaveS && ctx.nomeLocal === 'ICMS';

// ---------------------------------------------------------------------------
// DRE de um cenário a partir do preço (seção 5.6)
// ---------------------------------------------------------------------------

export function dre(preco, ctx, { custo, fixos = 0, despVar = 0, chaveS, taxas }) {
  const cs = chaveEfetiva(ctx, chaveS);
  const a = ctx.porFora ? ctx.cbs + ctx.ibs : 0;
  const { e, k, notaCoef } = coeficientes({ ic: ctx.ic, a, chaveS: cs });
  const d = destaque(preco, { e, cbs: ctx.cbs, ibs: ctx.ibs, porFora: ctx.porFora });
  const aliq = (id) => ctx.itens.filter((i) => i.id === id).reduce((s, i) => s + i.aliq, 0);
  const pis = preco * aliq('pis');
  const das = preco * aliq('das');
  const icms = preco * e;
  const receitaLiquida = preco - pis - icms - das;
  const lucroBruto = receitaLiquida - custo;
  const despesasVar = preco * despVar;
  const lair = lucroBruto - despesasVar - fixos;
  const ir = ctx.irLair > 0 ? Math.max(0, lair * ctx.irLair) : preco * aliq('irpres');
  const lucroLiquido = lair - ir;
  const info = ctx.informativo && taxas ? destaque(preco, { e, cbs: taxas.cbs, ibs: taxas.ibs, porFora: true }) : null;
  return {
    preco,
    e,
    k,
    notaCoef,
    ...d,
    info,
    receitaBruta: preco,
    pis,
    icms,
    das,
    receitaLiquida,
    custo,
    lucroBruto,
    despesasVar,
    fixos,
    lair,
    ir,
    lucroLiquido,
    margemLiquida: receitaLiquida > 0 ? lucroLiquido / receitaLiquida : 0,
  };
}

/** Sobra por R$ 1 de preço antes da margem: 1 − Σd − despesas variáveis. */
function sobra(ctx, despVar, chaveS) {
  const a = ctx.porFora ? ctx.cbs + ctx.ibs : 0;
  const { e, notaCoef } = coeficientes({ ic: ctx.ic, a, chaveS: chaveEfetiva(ctx, chaveS) });
  return { k1: 1 - ctx.dentro - e - despVar, e, a, notaCoef };
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
  consumidor: {
    nome: 'Consumidor final ou uso e consumo pessoal',
    dica: 'Pessoa física, ou empresa que compra para uso e consumo pessoal. Não toma crédito.',
    creditaDepois: false,
  },
  regular: {
    nome: 'Empresa no regime regular de IBS/CBS',
    dica: 'Lucro Real, Lucro Presumido ou Simples que optou por recolher IBS/CBS por fora. Toma crédito do IBS/CBS destacado.',
    creditaDepois: true,
    regular: true,
  },
  simples: {
    nome: 'Empresa do Simples Nacional (não optante)',
    dica: 'Simples que não optou pelo regime regular: recolhe tudo no DAS e não toma crédito.',
    creditaDepois: false,
  },
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
  icmsFornecedor: 0,
  usoPessoal: false,
  despesasVar: 10,
  despesasFixas: 0,
  modo: 'margem', // 'margem' | 'preco'
  margem: 20,
  precoHoje: '',
  cliente: 'consumidor',
};

/** Quais créditos a empresa (compradora) aproveita. */
export function creditosDoComprador(ent) {
  const uso = !!ent.usoPessoal;
  const regular = ent.regime === 'presumido' || ent.regime === 'real';
  return {
    ibs: !uso && ent.regime !== 'simples_unico',
    icms: !uso && regular && ent.atividade !== 'servico',
    pis: !uso && ent.regime === 'real',
  };
}

/**
 * Executa a simulação completa para um ano.
 * @param {object} ent entradas da operação (percentuais em pontos)
 * @param {object} p premissas
 * @param {object} [opts] { custoAnoFixo, custoHojeFixo } (usado nos casos de teste)
 */
export function simular(ent, p, opts = {}) {
  const mem = new Memoria();
  const ano = Number(ent.ano);
  const atividade = ent.regime === 'presumido' || ent.regime === 'real' ? ent.atividade : 'comercio';
  const taxas = taxasDoAno(p, ano, atividade);
  const chaveS = !!p.chaveIbsCbsNaBaseIcms;
  const despVar = pct(ent.despesasVar ?? ent.despesas);
  const fixosPct = pct(ent.despesasFixas);
  const das = pct(ent.das);
  const V = Number(ent.valorCompra) || 0;
  const parcela = pct(p.parcelaIbsCbsNoDas);
  const pisNaoCum = pct(p.pisCofinsNaoCumulativo);
  const pisCum = pct(p.pisCofinsCumulativo);
  const irLr = pct(p.irLucroReal);
  const ehReal = ent.regime === 'real';
  const icmsForn = ehSimples(ent.fornecedor) ? 0 : pct(ent.icmsFornecedor);

  registrarTaxas(mem, taxas, ano);

  // --- Compra ------------------------------------------------------------------
  const cred = creditosDoComprador({ ...ent, atividade });
  const compra0 = compraHoje({ V, fornecedor: ent.fornecedor, icmsFornecedor: icmsForn, creditaPis: cred.pis, creditaIcms: cred.icms, pisCum, pisNaoCum });
  const compra = taxas.teste
    ? null
    : custoDaCompra({
        V,
        fornecedor: ent.fornecedor,
        dasFornecedor: pct(p.dasFornecedor),
        parcela,
        icmsFornecedor: icmsForn,
        fator: taxas.fator,
        creditaIbs: cred.ibs,
        creditaIcms: cred.icms,
        cbs: taxas.cbs,
        ibs: taxas.ibs,
      });
  const cHoje = opts.custoHojeFixo ?? compra0.custo;
  const cAno = opts.custoAnoFixo ?? (compra ? compra.custo : compra0.custo);
  registrarCompra(mem, { V, ent, compra0, compra, cHoje, cAno, taxas, cred, pisNaoCum, pisCum, icmsForn, parcela, dasF: pct(p.dasFornecedor) });

  // --- Custos/despesas fixos ---------------------------------------------------
  const fixoHoje = cHoje * fixosPct;
  const fixoAno = p.fixosModo === 'pct' ? cAno * fixosPct : fixoHoje;

  // --- Cenário hoje ------------------------------------------------------------
  const ctxHoje = contextoVendedor({ regime: ent.regime, atividade, das, p, taxas, hoje: true });
  const ctxAno = contextoVendedor({ regime: ent.regime, atividade, das, p, taxas, hoje: taxas.teste });
  const sHoje = sobra(ctxHoje, despVar, false);

  // margem antes do IR usada no divisor (Lucro Real: margem informada é depois do IR)
  let margem;
  let precoHojeInformado = null;
  if (ent.modo === 'preco' && Number(ent.precoHoje) > 0) {
    precoHojeInformado = Number(ent.precoHoje);
    const mDiv = sHoje.k1 - (cHoje + fixoHoje) / precoHojeInformado;
    margem = ehReal ? mDiv * (1 - irLr) : mDiv;
  } else {
    margem = pct(ent.margem);
  }
  const mDivisor = ehReal ? margem / (1 - irLr) : margem;

  if (!(sHoje.k1 - mDivisor > 0)) {
    throw new ErroCalculo('A soma de tributos, despesas variáveis e margem chega a 100% ou mais. Reduza a margem ou as despesas.');
  }

  const opDre = (custo, fixos, ctx) => ({ custo, fixos, despVar, chaveS: ctx.hoje ? false : chaveS, taxas });
  const precoHoje = precoHojeInformado ?? (cHoje + fixoHoje) / (sHoje.k1 - mDivisor);
  const hoje = dre(precoHoje, ctxHoje, opDre(cHoje, fixoHoje, ctxHoje));
  hoje.divisor = sHoje.k1 - mDivisor;
  hoje.multiplicador = 1 / hoje.divisor;
  hoje.sigma = ctxHoje.dentro + sHoje.e;

  // --- Três estratégias no ano -------------------------------------------------
  const sAno = sobra(ctxAno, despVar, ctxAno.hoje ? false : chaveS);
  const L0 = hoje.lucroLiquido;
  const N0 = hoje.nota;
  const res = { hoje };
  const divRepassar = sAno.k1 - mDivisor;
  if (!(divRepassar > 0)) throw new ErroCalculo('A soma de tributos, despesas variáveis e margem chega a 100% ou mais no ano escolhido.');
  const lairAlvo = ehReal ? L0 / (1 - irLr) : L0;
  const precos = {
    repassar: (cAno + fixoAno) / divRepassar,
    lucro: (cAno + fixoAno + lairAlvo) / sAno.k1,
    nota: N0 / (ctxAno.porFora ? sAno.notaCoef : 1),
  };
  const opAno = opDre(cAno, fixoAno, ctxAno);
  // Manter a nota: o preço absorve o centavo que o arredondamento de CBS e IBS desloca.
  const precoNotaBruto = precos.nota;
  precos.nota = ajustarParaNota(precoNotaBruto, N0, (x) => dre(x, ctxAno, opAno).nota);
  for (const est of ESTRATEGIAS) {
    const c = dre(precos[est.id], ctxAno, opAno);
    c.sigma = ctxAno.dentro + sAno.e;
    c.markupEquivalente = c.preco / cAno;
    c.custoAteNota = c.nota / cAno;
    res[est.id] = c;
  }
  res.nota.ajuste = precos.nota - precoNotaBruto;
  res.repassar.divisor = divRepassar;
  res.repassar.multiplicador = 1 / divRepassar;

  // --- Visão do cliente (5.7) --------------------------------------------------
  const cli = CLIENTES[ent.cliente] || CLIENTES.consumidor;
  const creditoCliente = (c) => {
    if (!cli.creditaDepois || taxas.teste) return 0;
    if (ctxAno.porFora) return c.ibsCbs;
    if (ent.regime === 'simples_unico') return r2(c.preco * das * parcela);
    return 0;
  };
  for (const id of ['repassar', 'lucro', 'nota']) {
    const c = res[id];
    c.creditoCliente = creditoCliente(c);
    c.custoCliente = r2(c.nota - c.creditoCliente);
  }
  // Hoje só o Lucro Real credita PIS/Cofins; os demais pagam a nota inteira.
  hoje.creditoCliente = 0;
  hoje.custoCliente = N0;
  hoje.custoClienteLR = r2(N0 - r2(N0 * pisNaoCum));

  // --- Memória dos cenários ----------------------------------------------------
  const infoCtx = { taxas, ctxHoje, ctxAno, despVar, fixosPct, fixosModo: p.fixosModo, margem, mDivisor, ehReal, irLr, chaveS, N0, lairAlvo, precoHojeInformado, cli, parcela, das, pisNaoCum, cHoje };
  registrarCenario(mem, 'hoje', hoje, infoCtx);
  for (const est of ESTRATEGIAS) registrarCenario(mem, est.id, res[est.id], infoCtx);

  return {
    ano,
    teste: taxas.teste,
    taxas,
    chaveS,
    compraHoje: compra0,
    compra,
    custoHoje: cHoje,
    custoAno: cAno,
    fixoHoje,
    fixoAno,
    margem,
    margemDivisor: mDivisor,
    ctxHoje,
    ctxAno,
    cliente: cli,
    ...res,
    memoria: mem.itens,
  };
}

/** Linha do tempo 2026–2033 para a mesma operação. */
export function linhaDoTempo(ent, p, opts = {}) {
  return ANOS.map((ano) => {
    try {
      const s = simular({ ...ent, ano }, p, opts);
      return { ano, teste: s.teste, ic: s.taxas.ic, ibs: s.taxas.ibs, cbs: s.taxas.cbs, nomeLocal: s.taxas.nomeLocal, repassar: s.repassar, lucro: s.lucro, nota: s.nota, hoje: s.hoje, memoria: s.memoria };
    } catch (e) {
      return { ano, erro: e.message };
    }
  });
}

// ---------------------------------------------------------------------------
// Registro da memória
// ---------------------------------------------------------------------------

function registrarTaxas(mem, taxas, ano) {
  const L = taxas.nomeLocal;
  mem.reg('ano.cbs', taxas.cbs, {
    rotulo: `CBS ${ano}`,
    tipo: 'pct',
    formula: taxas.teste ? 'Alíquota de teste da CBS em 2026' : 'Alíquota de referência da CBS',
    subst: P(taxas.cbs),
    base: taxas.teste ? BL.teste2026 : BL.cbs,
  });
  mem.reg('ano.ibs', taxas.ibs, {
    rotulo: `IBS ${ano}`,
    tipo: 'pct',
    formula: taxas.ibsAuto ? `IBS = (alíquota do ${L} − ${L} do ano) ÷ (1 − ${L} do ano)` : taxas.teste ? 'Alíquota de teste do IBS em 2026' : 'Alíquota do ano',
    subst: taxas.ibsAuto ? `(${P(taxas.aliqLocal)} − ${P(taxas.ic)}) ÷ (1 − ${P(taxas.ic)}) = ${P(taxas.ibs)}` : P(taxas.ibs),
    base: taxas.baseIbs,
    alerta: ano >= 2033 ? 'A reposição é da arrecadação total, não produto a produto.' : undefined,
  });
  mem.reg('ano.a', taxas.a, { rotulo: `IBS + CBS ${ano}`, tipo: 'pct', formula: 'a = CBS + IBS', subst: `${P(taxas.cbs)} + ${P(taxas.ibs)} = ${P(taxas.a)}`, base: BL.porFora });
  mem.reg('ano.ic', taxas.ic, {
    rotulo: `${L} ${ano}`,
    tipo: 'pct',
    formula: `${L} do ano = alíquota do ${L === 'ISS' ? 'serviço' : 'produto'} × fator do ano`,
    subst: `${P(taxas.aliqLocal)} × ${String(taxas.fator).replace('.', ',')} = ${P(taxas.ic)}`,
    base: BL.icmsFator,
  });
}

function registrarCompra(mem, { V, ent, compra0, compra, cHoje, cAno, taxas, cred, pisNaoCum, pisCum, icmsForn, parcela, dasF }) {
  const forn = FORNECEDORES[ent.fornecedor];
  const simples = ehSimples(ent.fornecedor);
  const sPis = ent.fornecedor === 'real' ? pisNaoCum : pisCum;
  const semCredito = (tipo) =>
    ent.usoPessoal
      ? 'compra para uso e consumo pessoal não dá crédito'
      : tipo === 'icms'
        ? 'sua empresa não toma crédito de ICMS (Simples ou atividade de serviço)'
        : 'empresa no Simples Nacional (sem opção pelo híbrido) não toma crédito';

  mem.reg('compra.V', V, {
    rotulo: simples ? 'Valor da nota de compra' : 'Valor da compra sem PIS/Cofins',
    formula: simples ? 'Valor informado (fornecedor do Simples: valor da nota)' : 'Valor informado, sem PIS/Cofins',
    subst: R(V),
  });

  // Hoje
  mem.reg('compra.hojeNota', compra0.nota, {
    rotulo: 'Nota de compra hoje',
    formula: simples ? 'Fornecedor do Simples: a nota é o valor informado' : `Nota hoje = valor sem PIS/Cofins ÷ (1 − PIS/Cofins do fornecedor). Fornecedor ${forn}: ${P(sPis)}`,
    subst: simples ? R(compra0.nota) : `${R(V)} ÷ (1 − ${P(sPis)}) = ${R(compra0.nota)}`,
    base: ent.fornecedor === 'real' ? BL.pisNaoCum : ent.fornecedor === 'presumido' ? BL.pisCum : BL.simples,
  });
  if (compra0.icmsV) {
    mem.reg('compra.hojeIcms', compra0.icmsV, { rotulo: 'ICMS na nota de compra hoje', formula: 'ICMS = nota × alíquota do ICMS do fornecedor', subst: `${R(compra0.nota)} × ${P(icmsForn)} = ${R(compra0.icmsV)}`, base: BL.icms });
  }
  if (compra0.icmsV) {
    mem.reg('compra.hojeCreditoIcms', compra0.creditoIcms, {
      rotulo: 'Crédito de ICMS hoje',
      formula: compra0.creditoIcms ? 'ICMS destacado na nota de compra vira crédito' : 'Sem crédito: ' + semCredito('icms'),
      subst: R(compra0.creditoIcms),
      base: BL.icmsCredito,
    });
  }
  mem.reg('compra.hojeCreditoPis', compra0.creditoPis, {
    rotulo: 'Crédito de PIS/Cofins hoje',
    formula: compra0.creditoPis ? 'Lucro Real credita PIS/Cofins: nota × 9,25%' : 'Sem crédito de PIS/Cofins (só o Lucro Real credita)',
    subst: compra0.creditoPis ? `${R(compra0.nota)} × ${P(pisNaoCum)} = ${R(compra0.creditoPis)}` : '0,00',
    base: BL.pisNaoCum,
  });
  mem.reg('compra.hoje', cHoje, {
    rotulo: 'Custo da mercadoria hoje',
    formula: 'Custo hoje = nota − créditos de PIS/Cofins e ICMS',
    subst: `${R(compra0.nota)} − ${R(compra0.creditoPis)} − ${R(compra0.creditoIcms)} = ${R(cHoje)}`,
    base: BL.pisNaoCum,
  });

  // No ano
  if (!compra) {
    mem.reg('compra.custo', cAno, {
      rotulo: `Custo real da mercadoria ${taxas.ano}`,
      formula: '2026 é ano de teste: PIS/Cofins e ICMS continuam como hoje; o custo não muda',
      subst: R(cAno),
      base: BL.teste2026,
    });
    return;
  }
  if (ent.fornecedor === 'simples_unico') {
    mem.reg('compra.nota', compra.nota, { rotulo: `Nota de compra ${taxas.ano}`, formula: 'Fornecedor do Simples: a nota não muda (IBS/CBS dentro do DAS)', subst: R(compra.nota), base: BL.simples });
    mem.reg('compra.credito', compra.credito, {
      rotulo: 'Crédito de IBS/CBS na compra',
      formula: compra.credito ? 'Crédito = nota × DAS estimado do fornecedor × parcela de IBS/CBS no DAS' : 'Sem crédito: ' + semCredito('ibs'),
      subst: compra.credito ? `${R(V)} × ${P(dasF)} × ${R(parcela * 100)}% = ${R(compra.credito)}` : '0,00',
      base: ent.usoPessoal ? BL.usoPessoal : BL.dasParcela,
      alerta: compra.credito ? 'O DAS do fornecedor é uma estimativa (Ajustes avançados). A partir de 2027, o valor real vem na nota dele.' : undefined,
    });
  } else {
    if (ent.fornecedor === 'simples_hibrido') {
      mem.reg('compra.preco', compra.precoForn, {
        rotulo: 'Preço do fornecedor sem IBS/CBS',
        formula: 'Fornecedor Simples Híbrido tira do preço a parcela de IBS/CBS do DAS (DAS estimado × 15,5%)',
        subst: `${R(V)} × (1 − ${P(dasF)} × ${R(parcela * 100)}%) = ${R(compra.precoForn)}`,
        base: `${BL.hibrido} · ${BL.repasse}`,
        alerta: 'O DAS do fornecedor é uma estimativa (Ajustes avançados).',
      });
    } else {
      mem.reg('compra.preco', compra.precoForn, {
        rotulo: 'Preço do fornecedor sem IBS/CBS',
        formula: icmsForn ? 'Preço = valor sem PIS/Cofins e sem ICMS ÷ (1 − ICMS do fornecedor no ano)' : 'Sem ICMS: preço = valor informado sem PIS/Cofins',
        subst: icmsForn ? `${R(V)} × (1 − ${P(icmsForn)}) ÷ (1 − ${P(compra.icY)}) = ${R(compra.precoForn)}` : R(compra.precoForn),
        base: BL.repasse,
      });
      if (icmsForn) {
        mem.reg('compra.icms', compra.icmsV, {
          rotulo: `ICMS na nota de compra ${taxas.ano}`,
          formula: 'ICMS = preço do fornecedor × ICMS do fornecedor no ano (alíquota × fator do ano)',
          subst: `${R(compra.precoForn)} × ${P(icmsForn)} × ${String(taxas.fator).replace('.', ',')} = ${R(compra.icmsV)}`,
          base: `${BL.icms} · ${BL.icmsFator}`,
        });
        mem.reg('compra.creditoIcms', compra.creditoIcms, {
          rotulo: `Crédito de ICMS ${taxas.ano}`,
          formula: compra.creditoIcms ? 'ICMS destacado na nota de compra vira crédito' : 'Sem crédito: ' + semCredito('icms'),
          subst: R(compra.creditoIcms),
          base: BL.icmsCredito,
        });
      }
    }
    const baseTxt = R(compra.liquido);
    mem.reg('compra.cbs', compra.cbsV, { rotulo: 'CBS na nota de compra', formula: 'CBS = base (preço sem ICMS) × CBS do ano', subst: `${baseTxt} × ${P(taxas.cbs)} = ${R(compra.cbsV)}`, base: BL.porFora });
    mem.reg('compra.ibs', compra.ibsV, { rotulo: 'IBS na nota de compra', formula: 'IBS = base (preço sem ICMS) × IBS do ano', subst: `${baseTxt} × ${P(taxas.ibs)} = ${R(compra.ibsV)}`, base: BL.porFora });
    mem.reg('compra.nota', compra.nota, {
      rotulo: `Nota de compra ${taxas.ano}`,
      formula: 'Nota = preço do fornecedor + CBS + IBS',
      subst: `${R(compra.precoForn)} + ${R(compra.cbsV)} + ${R(compra.ibsV)} = ${R(compra.nota)}`,
      base: BL.porFora,
    });
    mem.reg('compra.credito', compra.credito, {
      rotulo: 'Crédito de IBS/CBS na compra',
      formula: compra.credito ? 'Crédito = CBS + IBS destacados na nota de compra' : 'Sem crédito: ' + semCredito('ibs'),
      subst: compra.credito ? `${R(compra.cbsV)} + ${R(compra.ibsV)} = ${R(compra.credito)}` : '0,00',
      base: ent.usoPessoal ? BL.usoPessoal : BL.credito,
    });
  }
  mem.reg('compra.custo', compra.custo, {
    rotulo: `Custo real da mercadoria ${taxas.ano}`,
    formula: 'Custo real = nota de compra − créditos (IBS/CBS e ICMS)',
    subst: `${R(compra.nota)} − ${R(compra.credito)}${compra.creditoIcms ? ` − ${R(compra.creditoIcms)}` : ''} = ${R(compra.custo)}`,
    base: BL.credito,
  });
}

const NOMES = { hoje: 'Hoje', repassar: 'Repassar tudo', lucro: 'Manter lucro', nota: 'Manter a nota' };

function registrarCenario(mem, id, c, x) {
  const { taxas, ctxHoje, ctxAno, despVar, fixosPct, fixosModo, margem, mDivisor, ehReal, irLr, chaveS, N0, lairAlvo, precoHojeInformado, cli, parcela, das, pisNaoCum, cHoje } = x;
  const hoje = id === 'hoje';
  const ctx = hoje ? ctxHoje : ctxAno;
  const L = ctx.nomeLocal;
  const cen = NOMES[id];
  const custo = c.custo;
  const k = (s) => `${id}.${s}`;
  const custoMaisFixos = `(${R(custo)} + fixos ${R(c.fixos)})`;
  const baseCusto = c.fixos ? custoMaisFixos : R(custo);

  // Σd
  const itensTxt = ctx.itens.map((i) => `${i.nome} ${P(i.aliq)}`);
  if (c.e > 0) itensTxt.push(`${L} ${P(c.e)}`);
  mem.reg(k('sigma'), c.sigma, {
    rotulo: `Tributos por dentro (Σd) · ${cen}`,
    tipo: 'pct',
    formula: 'Σd = soma dos tributos que ficam dentro do preço. O IBS/CBS nunca entra aqui: é somado por fora, no fim.',
    subst: itensTxt.length ? `${itensTxt.join(' + ')} = ${P(c.sigma)}` : '0,00%',
    base: [...ctx.itens.map((i) => i.base), c.e > 0 ? ctx.baseLocal : null].filter(Boolean).join(' · '),
    alerta: c.k ? `Chave S: ICMS efetivo = ICMS do ano × k = ${P(ctx.ic)} × ${N4(c.k)} = ${P(c.e)}` : undefined,
  });

  // Custos/despesas fixos
  const fixoF = hoje
    ? 'Custos/despesas fixos = custo de hoje × % de fixos (somados ao custo antes do divisor)'
    : fixosModo === 'pct'
      ? 'Custos/despesas fixos = custo do ano × % de fixos'
      : 'Custos/despesas fixos mantidos em R$ de hoje: aluguel, folha etc. não mudam com a Reforma';
  mem.reg(k('fixos'), c.fixos, {
    rotulo: `Custos/despesas fixos · ${cen}`,
    formula: fixoF,
    subst: hoje || fixosModo === 'pct' ? `${R(custo)} × ${P(fixosPct)} = ${R(c.fixos)}` : `${R(cHoje)} × ${P(fixosPct)} = ${R(c.fixos)} (valor de hoje)`,
  });

  const margemTxt = ehReal ? `margem ${P(margem)} ÷ (1 − ${P(irLr)}) = ${P(mDivisor)} (antes do IR)` : `margem ${P(margem)}`;

  // Preço
  if (hoje || id === 'repassar') {
    mem.reg(k('divisor'), c.divisor, {
      rotulo: `Divisor · ${cen}`,
      tipo: 'n4',
      formula: 'Divisor = 1 − (Σd + despesas variáveis + margem)' + (ehReal ? '. Lucro Real: a margem informada é depois do IR e vira margem antes do IR no divisor.' : ''),
      subst: `1 − (${P(c.sigma)} + ${P(despVar)} + ${P(mDivisor)}) = ${N4(c.divisor)}${ehReal ? ` · ${margemTxt}` : ''}`,
      base: BL.dre,
    });
    mem.reg(k('multiplicador'), c.multiplicador, { rotulo: `Multiplicador (markup) · ${cen}`, tipo: 'n4', formula: 'Multiplicador = 1 ÷ divisor', subst: `1 ÷ ${N4(c.divisor)} = ${N4(c.multiplicador)}` });
  }
  let precoF;
  let precoS;
  if (hoje && precoHojeInformado) {
    precoF = 'Preço de venda de hoje informado. A margem é deduzida dele.';
    precoS = `${R(c.preco)} → margem = 1 − Σd − despesas variáveis − (custo + fixos) ÷ preço = ${P(mDivisor)}${ehReal ? ` antes do IR (${P(margem)} depois do IR)` : ''}`;
  } else if (hoje || id === 'repassar') {
    precoF = 'Preço = (custo + custos/despesas fixos) ÷ divisor';
    precoS = `${baseCusto} ÷ ${N4(c.divisor)} = ${R(c.preco)}`;
  } else if (id === 'lucro') {
    precoF = ehReal
      ? 'Preço = (custo + fixos + lucro de hoje antes do IR) ÷ (1 − Σd − despesas variáveis). Lucro antes do IR = lucro líquido ÷ (1 − 34%)'
      : 'Preço = (custo + fixos + lucro de hoje) ÷ (1 − Σd − despesas variáveis)';
    precoS = `(${R(custo)} + ${R(c.fixos)} + ${R(lairAlvo)}) ÷ (1 − ${P(c.sigma)} − ${P(despVar)}) = ${R(c.preco)}`;
  } else {
    precoF = ctx.porFora ? (c.k ? 'Preço = nota de hoje ÷ k' : `Preço = nota de hoje ÷ (1 + (1 − ${L}) × a)`) : 'Sem IBS/CBS por fora: preço = nota de hoje';
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
    const baseTxt = c.e > 0 ? `(${R(c.preco)} − ${L} ${R(c.icms)})` : R(c.preco);
    mem.reg(k('baseIbs'), c.base, {
      rotulo: `Base do IBS/CBS · ${cen}`,
      formula: `Base = preço − ${L} (o ${L} não integra a base do IBS/CBS até 2032)`,
      subst: `${R(c.preco)} − ${R(c.icms)} = ${R(c.base)}`,
      base: BL.icmsForaBaseIbs,
    });
    mem.reg(k('cbs'), c.cbsV, { rotulo: `CBS · ${cen}`, formula: 'CBS = base × CBS do ano', subst: `${baseTxt} × ${P(taxas.cbs)} = ${R(c.cbsV)}`, base: BL.porFora });
    mem.reg(k('ibs'), c.ibsV, { rotulo: `IBS · ${cen}`, formula: 'IBS = base × IBS do ano', subst: `${baseTxt} × ${P(taxas.ibs)} = ${R(c.ibsV)}`, base: BL.porFora });
    mem.reg(k('ibsCbs'), c.ibsCbs, { rotulo: `IBS/CBS destacado · ${cen}`, formula: 'CBS + IBS, cada um arredondado a 2 casas. Por fora: não entra no divisor.', subst: `${R(c.cbsV)} + ${R(c.ibsV)} = ${R(c.ibsCbs)}`, base: BL.porFora });
    mem.reg(k('nota'), c.nota, { rotulo: `Nota (valor cobrado) · ${cen}`, formula: 'Nota = preço + CBS + IBS (valores arredondados, como na nota fiscal)', subst: `${R(c.preco)} + ${R(c.cbsV)} + ${R(c.ibsV)} = ${R(c.nota)}`, base: BL.arred });
  } else {
    const formulaIbs = hoje && !taxas.teste ? 'Não existe hoje' : taxas.teste ? '2026: nada é cobrado por fora. O destaque é só informativo.' : 'Simples Nacional: o IBS/CBS continua dentro do DAS, nada por fora';
    mem.reg(k('ibsCbs'), 0, { rotulo: `IBS/CBS por fora · ${cen}`, formula: formulaIbs, subst: '0,00', base: taxas.teste ? BL.teste2026 : hoje ? undefined : BL.dasParcela });
    mem.reg(k('nota'), c.nota, { rotulo: `Nota (valor cobrado) · ${cen}`, formula: 'Todos os tributos por dentro: nota = preço', subst: R(c.nota) });
  }
  if (c.info) {
    mem.reg(k('ibsCbsInfo'), c.info.ibsCbs, {
      rotulo: `IBS/CBS destacado só para informação · ${cen}`,
      formula: '2026: CBS 0,9% e IBS 0,1% sobre (preço − ' + L + '), destacados na nota para teste. Não somam à nota nem ao custo.',
      subst: `${R(c.info.base)} × ${P(taxas.cbs)} + ${R(c.info.base)} × ${P(taxas.ibs)} = ${R(c.info.cbsV)} + ${R(c.info.ibsV)} = ${R(c.info.ibsCbs)}`,
      base: BL.teste2026,
    });
  }

  // DRE
  const ali = (idItem) => ctx.itens.find((i) => i.id === idItem);
  mem.reg(k('receitaBruta'), c.receitaBruta, { rotulo: `Receita bruta · ${cen}`, formula: 'Receita bruta = nota − IBS/CBS (o IBS/CBS destacado não é receita)', subst: `${R(c.nota)} − ${R(c.ibsCbs)} = ${R(c.receitaBruta)}`, base: BL.foraReceita });
  if (ali('pis')) mem.reg(k('pis'), c.pis, { rotulo: `PIS/Cofins · ${cen}`, formula: 'PIS/Cofins = receita bruta × alíquota', subst: `${R(c.preco)} × ${P(ali('pis').aliq)} = ${R(c.pis)}`, base: ali('pis').base });
  if (c.e > 0)
    mem.reg(k('icms'), c.icms, {
      rotulo: `${L} · ${cen}`,
      formula: c.k ? 'ICMS = ICMS do ano × nota (chave S: IBS/CBS na base do ICMS)' : `${L} = receita bruta × alíquota do ${L}`,
      subst: `${R(c.preco)} × ${P(c.e)} = ${R(c.icms)}`,
      base: ctx.baseLocal,
    });
  if (ali('das')) mem.reg(k('das'), c.das, { rotulo: `DAS · ${cen}`, formula: 'DAS = receita bruta × alíquota efetiva', subst: `${R(c.preco)} × ${P(ali('das').aliq)} = ${R(c.das)}` + (ali('das').detalhe ? ` · ${ali('das').detalhe}` : ''), base: ali('das').base });
  const dedTxt = [R(c.receitaBruta), ali('pis') && R(c.pis), c.e > 0 && R(c.icms), ali('das') && R(c.das)].filter(Boolean).join(' − ');
  mem.reg(k('receitaLiquida'), c.receitaLiquida, {
    rotulo: `Receita líquida · ${cen}`,
    formula: 'Receita líquida = receita bruta − tributos sobre a venda',
    subst: `${dedTxt} = ${R(c.receitaLiquida)}`,
    base: BL.dre,
    alerta: difArred(c.receitaLiquida, [c.receitaBruta, -c.pis, -c.icms, -c.das]),
  });
  mem.reg(k('custo'), custo, { rotulo: `Custo da mercadoria · ${cen}`, formula: hoje ? 'Custo de hoje (ver aba Custo da compra)' : 'Custo real = nota de compra − créditos', subst: R(custo), base: hoje ? BL.pisNaoCum : BL.credito });
  mem.reg(k('lucroBruto'), c.lucroBruto, { rotulo: `Lucro bruto · ${cen}`, formula: 'Lucro bruto = receita líquida − custo', subst: `${R(c.receitaLiquida)} − ${R(custo)} = ${R(c.lucroBruto)}`, base: BL.dre, alerta: difArred(c.lucroBruto, [c.receitaLiquida, -custo]) });
  mem.reg(k('despesasVar'), c.despesasVar, { rotulo: `Custos/despesas variáveis · ${cen}`, formula: 'Variáveis = receita bruta × % de variáveis (entram no divisor)', subst: `${R(c.preco)} × ${P(despVar)} = ${R(c.despesasVar)}` });
  mem.reg(k('lair'), c.lair, {
    rotulo: `Lucro antes do IR/CSLL · ${cen}`,
    formula: 'LAIR = lucro bruto − variáveis − fixos',
    subst: `${R(c.lucroBruto)} − ${R(c.despesasVar)} − ${R(c.fixos)} = ${R(c.lair)}`,
    base: BL.dre,
    alerta: difArred(c.lair, [c.lucroBruto, -c.despesasVar, -c.fixos]),
  });
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
    cliF = cli.regular ? 'Hoje, empresa do Presumido ou do Simples não credita PIS/Cofins: paga a nota inteira (Lucro Real: ver linha própria)' : 'Cliente não toma crédito hoje: paga a nota';
    cliS = R(c.custoCliente);
  } else if (c.creditoCliente) {
    cliF = ctx.porFora ? 'Cliente que credita: nota − IBS/CBS destacado' : 'Cliente que credita, vendedor do Simples: nota − parcela de IBS/CBS do DAS';
    cliS = ctx.porFora ? `${R(c.nota)} − ${R(c.ibsCbs)} = ${R(c.custoCliente)}` : `${R(c.nota)} − ${R(c.preco)} × ${P(das)} × ${R(parcela * 100)}% = ${R(c.custoCliente)}`;
  } else {
    cliF = taxas.teste ? '2026: sem crédito de IBS/CBS; o cliente paga a nota como hoje' : 'Cliente que não credita (consumidor final, uso e consumo pessoal ou Simples não optante): paga a nota inteira';
    cliS = R(c.custoCliente);
  }
  mem.reg(k('custoCliente'), c.custoCliente, { rotulo: `Custo para o cliente · ${cen}`, formula: `${cli.nome}: ${cliF}`, subst: cliS, base: hoje ? BL.pisNaoCum : BL.credito });
  if (hoje) {
    mem.reg(k('custoClienteLR'), c.custoClienteLR, { rotulo: 'Custo hoje para cliente do Lucro Real', formula: 'Nota − crédito de PIS/Cofins não cumulativo', subst: `${R(c.nota)} − ${R(c.nota)} × ${P(pisNaoCum)} = ${R(c.custoClienteLR)}`, base: BL.pisNaoCum });
  } else {
    const credDas = r2(c.preco * das * parcela);
    const valorCredita = taxas.teste ? c.nota : r2(c.nota - (ctx.porFora ? c.ibsCbs : credDas));
    mem.reg(k('custoClienteCredita'), valorCredita, {
      rotulo: `Cliente que credita · ${cen}`,
      formula: taxas.teste ? '2026: ainda não há crédito de IBS/CBS' : ctx.porFora ? 'Nota − IBS/CBS destacado' : 'Nota − parcela de IBS/CBS do DAS',
      subst: taxas.teste ? R(c.nota) : ctx.porFora ? `${R(c.nota)} − ${R(c.ibsCbs)} = ${R(valorCredita)}` : `${R(c.nota)} − ${R(credDas)} = ${R(valorCredita)}`,
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
