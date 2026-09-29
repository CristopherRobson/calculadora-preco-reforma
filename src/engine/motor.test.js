// Casos de teste da seção 9 da especificação. Todos ao centavo.
//
// Regra de arredondamento decidida com o usuário: CBS e IBS arredondados separadamente
// (seção 5.8). Com ela, quatro valores da especificação original mudam 1 centavo:
//   T1 nota 2033 ........ 216,80 → 216,79
//   T2 Simples Híbrido .. nota 107,95 → 107,96 · crédito 9,19 → 9,20 (custo real igual)
//   T3 Repassar ......... IBS/CBS 12,48 → 12,47 · nota 146,49 → 146,48
//   T3 Manter lucro ..... IBS/CBS 12,94 → 12,95 · nota 151,98 → 151,99

import { describe, it, expect } from 'vitest';
import { formarPreco, custoDaCompra, custoHoje, simular, linhaDoTempo } from './motor.js';
import { PREMISSAS_PADRAO, taxasDoAno } from './premissas.js';
import { r2 } from './numeros.js';

const cent = (x) => r2(x);
const P0 = PREMISSAS_PADRAO;

describe('arredondamento', () => {
  it('arredonda meio para cima sem ruído binário', () => {
    expect(r2(1.005)).toBe(1.01);
    expect(r2(2.675)).toBe(2.68);
    expect(r2(0.125)).toBe(0.13);
    expect(r2(-1.005)).toBe(-1.01);
  });
});

describe('T1 · Markup genérico', () => {
  const t1 = formarPreco({ custo: 100, dentro: 0.11, despesas: 0.1, margem: 0.2, cbs: 0.0921, ibs: 0.001 });
  it('divisor e multiplicador', () => {
    expect(t1.divisor).toBeCloseTo(0.59, 10);
    expect(Number(t1.multiplicador.toFixed(4))).toBe(1.6949);
  });
  it('preço e componentes', () => {
    expect(cent(t1.preco)).toBe(169.49);
    expect(cent(t1.tributos)).toBe(18.64);
    expect(cent(t1.despesas)).toBe(16.95);
    expect(cent(t1.lucro)).toBe(33.9);
    expect(t1.ibsCbs).toBe(15.78);
    expect(t1.nota).toBe(185.27);
  });
  it('nota em 2033 (a = 27,91%)', () => {
    const t = formarPreco({ custo: 100, dentro: 0.11, despesas: 0.1, margem: 0.2, cbs: 0.0921, ibs: 0.187 });
    expect(t.nota).toBe(216.79); // espec. original: 216,80 (IBS+CBS arredondados juntos)
  });
  it('IBS/CBS nunca entra no divisor', () => {
    const semIva = formarPreco({ custo: 100, dentro: 0.11, despesas: 0.1, margem: 0.2 });
    expect(semIva.divisor).toBe(t1.divisor);
  });
});

describe('T2 · Custo real por fornecedor (V = 100, 2027, comprador que credita)', () => {
  const base = { V: 100, dasFornecedor: 0.08, parcela: 0.155, compradorCredita: true, cbs: 0.0921, ibs: 0.001 };
  const casos = [
    ['real', false, { base: 90.75, nota: 99.2, credito: 8.45, custo: 90.75 }],
    ['presumido', false, { base: 96.35, nota: 105.32, credito: 8.97, custo: 96.35 }],
    ['simples_hibrido', false, { base: 98.76, nota: 107.96, credito: 9.2, custo: 98.76 }],
    ['simples_unico', false, { base: null, nota: 100, credito: 1.24, custo: 98.76 }],
    ['real', true, { base: 90.75, nota: 99.2, credito: 0, custo: 99.2 }],
  ];
  for (const [forn, uso, esp] of casos) {
    it(`${forn}${uso ? ' (uso e consumo pessoal)' : ''}`, () => {
      const c = custoDaCompra({ ...base, fornecedor: forn, usoPessoal: uso });
      expect(c.base).toBe(esp.base);
      expect(c.nota).toBe(esp.nota);
      expect(c.credito).toBe(esp.credito);
      expect(c.custo).toBe(esp.custo);
    });
  }
  it('comprador do Simples Nacional não credita: custo = nota inteira', () => {
    const c = custoDaCompra({ ...base, fornecedor: 'real', compradorCredita: false });
    expect(c.custo).toBe(99.2);
  });
  it('custo de hoje: Presumido = V; Lucro Real = V × (1 − 9,25%)', () => {
    expect(custoHoje({ V: 100, regimeComprador: 'presumido' })).toBe(100);
    expect(custoHoje({ V: 100, regimeComprador: 'real' })).toBe(90.75);
  });
});

describe('T3 · Presumido comprando do Lucro Real (sem ICMS, 2027)', () => {
  const p = { ...P0, icmsProduto: 0 };
  const ent = { ano: 2027, regime: 'presumido', atividade: 'comercio', valorCompra: 100, fornecedor: 'real', despesas: 10, modo: 'margem', margem: 20, cliente: 'consumidor', das: 8, dasFornecedor: 8 };
  const s = simular(ent, p);
  const esperado = {
    hoje: { nota: 156.08, ibsCbs: 0, receitaBruta: 156.08, pis: 5.7, receitaLiquida: 150.38, custo: 100, lucroBruto: 50.38, despesas: 15.61, lair: 34.77, ir: 3.56, lucroLiquido: 31.22, margem: 0.2076 },
    repassar: { nota: 146.48, ibsCbs: 12.47, receitaBruta: 134.01, pis: 0, receitaLiquida: 134.01, custo: 90.75, lucroBruto: 43.26, despesas: 13.4, lair: 29.86, ir: 3.06, lucroLiquido: 26.8, margem: 0.2 },
    lucro: { nota: 151.99, ibsCbs: 12.95, receitaBruta: 139.04, pis: 0, receitaLiquida: 139.04, custo: 90.75, lucroBruto: 48.29, despesas: 13.9, lair: 34.39, ir: 3.17, lucroLiquido: 31.22, margem: 0.2245 },
    nota: { nota: 156.08, ibsCbs: 13.29, receitaBruta: 142.79, pis: 0, receitaLiquida: 142.79, custo: 90.75, lucroBruto: 52.04, despesas: 14.28, lair: 37.76, ir: 3.26, lucroLiquido: 34.5, margem: 0.2416 },
  };
  for (const [cen, e] of Object.entries(esperado)) {
    it(`DRE · ${cen}`, () => {
      const c = s[cen];
      expect(c.nota).toBe(e.nota);
      expect(c.ibsCbs).toBe(e.ibsCbs);
      expect(cent(c.receitaBruta)).toBe(e.receitaBruta);
      expect(cent(c.pis)).toBe(e.pis);
      expect(cent(c.receitaLiquida)).toBe(e.receitaLiquida);
      expect(cent(c.custo)).toBe(e.custo);
      expect(cent(c.lucroBruto)).toBe(e.lucroBruto);
      expect(cent(c.despesas)).toBe(e.despesas);
      expect(cent(c.lair)).toBe(e.lair);
      expect(cent(c.ir)).toBe(e.ir);
      expect(cent(c.lucroLiquido)).toBe(e.lucroLiquido);
      expect(Number(c.margemLiquida.toFixed(4))).toBe(e.margem);
    });
  }
  it('margens com 1 casa como na especificação (20,8% · 20,0% · 22,5% · 24,2%)', () => {
    expect([s.hoje, s.repassar, s.lucro, s.nota].map((c) => (c.margemLiquida * 100).toFixed(1))).toEqual(['20.8', '20.0', '22.5', '24.2']);
  });
  it('multiplicadores', () => {
    expect(Number(s.hoje.multiplicador.toFixed(4))).toBe(1.5608);
    expect(Number(s.repassar.multiplicador.toFixed(4))).toBe(1.4767);
    expect(Number((s.repassar.multiplicador * (1 + s.taxas.a)).toFixed(4))).toBe(1.6141);
  });
  it('visão do cliente (repassar)', () => {
    expect(s.memoria['repassar.custoClienteCredita'].valor).toBe(134.01);
    expect(s.memoria['repassar.custoClienteNaoCredita'].valor).toBe(146.48);
  });
  it('sinaliza a diferença de 1 centavo no lucro líquido de hoje', () => {
    expect(s.memoria['hoje.lucroLiquido'].alerta).toMatch(/0,01/);
  });
  it('todo número exibido tem memória', () => {
    for (const m of Object.values(s.memoria)) {
      expect(m.formula, m.id).toBeTruthy();
      expect(m.subst, m.id).toBeTruthy();
    }
  });
});

describe('T4 · Transição (custo 100, Presumido, ICMS 19,5%, chave N)', () => {
  const ent = { regime: 'presumido', atividade: 'comercio', valorCompra: 100, fornecedor: 'real', despesas: 10, modo: 'margem', margem: 20, cliente: 'consumidor', das: 8, dasFornecedor: 8 };
  const opts = { custoAnoFixo: 100, custoHojeFixo: 100 };
  const linhas = linhaDoTempo(ent, P0, opts);
  const esperado = {
    2027: { ic: 0.195, ibs: 0.001, preco: 207.38, nota: 222.93, lucro: 41.48 },
    2029: { ic: 0.1755, ibs: 0.0237, preco: 199.32, nota: 218.35, lucro: 39.86 },
    2030: { ic: 0.156, ibs: 0.0462, preco: 191.86, nota: 214.25, lucro: 38.37 },
    2031: { ic: 0.1365, ibs: 0.0677, preco: 184.95, nota: 210.48, lucro: 36.99 },
    2032: { ic: 0.117, ibs: 0.0883, preco: 178.51, nota: 206.95, lucro: 35.7 },
  };
  for (const [ano, e] of Object.entries(esperado)) {
    it(String(ano), () => {
      const l = linhas.find((x) => x.ano === Number(ano));
      expect(Number(l.ic.toFixed(4))).toBe(e.ic);
      expect(Number(l.ibs.toFixed(4))).toBe(e.ibs);
      expect(cent(l.repassar.preco)).toBe(e.preco);
      expect(l.repassar.nota).toBe(e.nota);
      expect(cent(l.repassar.lucroLiquido)).toBe(e.lucro);
    });
  }
  it('detalhe de 2029', () => {
    const l = linhas.find((x) => x.ano === 2029).repassar;
    expect(cent(l.icms)).toBe(34.98);
    expect(cent(l.base)).toBe(164.34);
    expect(l.cbsV).toBe(15.14);
    expect(l.ibsV).toBe(3.89);
  });
  it('exemplo do IBS 2029 = 2,37%', () => {
    expect(Number((taxasDoAno(P0, 2029).ibs * 100).toFixed(2))).toBe(2.37);
  });
  it('chave S (IBS/CBS na base do ICMS), 2027: nota 229,48', () => {
    const s = simular({ ...ent, ano: 2027 }, { ...P0, chaveIbsCbsNaBaseIcms: true }, opts);
    expect(s.repassar.nota).toBe(229.48);
  });
});

describe('decisões do usuário', () => {
  const base = { ano: 2027, atividade: 'comercio', valorCompra: 100, fornecedor: 'real', despesas: 10, modo: 'margem', margem: 20, cliente: 'consumidor', das: 8, dasFornecedor: 8 };
  it('Lucro Real: margem informada é depois do IR (lucro líquido = 20% da receita)', () => {
    const s = simular({ ...base, regime: 'real' }, { ...P0, icmsProduto: 0 });
    expect(s.hoje.lucroLiquido / s.hoje.preco).toBeCloseTo(0.2, 10);
    expect(s.repassar.lucroLiquido / s.repassar.preco).toBeCloseTo(0.2, 10);
    expect(cent(s.lucro.lucroLiquido)).toBe(cent(s.hoje.lucroLiquido));
  });
  it('Presumido de serviço: presunção 32%/32% = 7,68%', () => {
    const s = simular({ ...base, regime: 'presumido', atividade: 'servico' }, { ...P0, icmsProduto: 0 });
    expect(s.ctxAno.itens[0].aliq).toBeCloseTo(0.0768, 10);
  });
  it('modo "preço de hoje": deduz a margem e reproduz o preço informado', () => {
    const p = { ...P0, icmsProduto: 0 };
    const viaMargem = simular({ ...base, regime: 'presumido' }, p);
    const viaPreco = simular({ ...base, regime: 'presumido', modo: 'preco', precoHoje: viaMargem.hoje.preco }, p);
    expect(viaPreco.margem).toBeCloseTo(0.2, 10);
    expect(cent(viaPreco.lucro.preco)).toBe(cent(viaMargem.lucro.preco));
  });
  it('Simples Nacional (único): nada por fora, nota = preço', () => {
    const s = simular({ ...base, regime: 'simples_unico' }, P0);
    expect(s.repassar.ibsCbs).toBe(0);
    expect(s.repassar.nota).toBe(cent(s.repassar.preco));
  });
  it('"Manter a nota" fecha na nota de hoje (nunca acima), em todos os anos e regimes', () => {
    for (const regime of ['presumido', 'real', 'simples_unico', 'simples_hibrido']) {
      for (const l of linhaDoTempo({ ...base, regime }, P0)) {
        // igual à de hoje ou, quando nenhum preço em centavos fecha, até 1 centavo abaixo
        const dif = r2(l.hoje.nota - l.nota.nota);
        expect(dif >= 0 && dif <= 0.01, `${regime} ${l.ano}: ${l.nota.nota} × ${l.hoje.nota}`).toBe(true);
        expect(cent(l.lucro.lucroLiquido), `${regime} ${l.ano}`).toBe(cent(l.hoje.lucroLiquido));
      }
    }
  });
  it('erro claro quando margem + despesas + tributos ≥ 100%', () => {
    expect(() => simular({ ...base, regime: 'presumido', margem: 80 }, P0)).toThrow(/100%/);
  });
});
