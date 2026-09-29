// Casos de teste da seção 9 da especificação. Todos ao centavo.
//
// Regra de arredondamento decidida com o usuário: CBS e IBS arredondados separadamente
// (seção 5.8). Com ela, quatro valores da especificação original mudam 1 centavo:
//   T1 nota 2033 ........ 216,80 → 216,79
//   T2 Simples Híbrido .. nota 107,95 → 107,96 · crédito 9,19 → 9,20 (custo real igual)
//   T3 Repassar ......... IBS/CBS 12,48 → 12,47 · nota 146,49 → 146,48
//   T3 Manter lucro ..... IBS/CBS 12,94 → 12,95 · nota 151,98 → 151,99
//
// Convenção de entrada (decidida com o usuário): o valor da compra é o TOTAL DA NOTA FISCAL.
// Custo = nota − créditos. Hoje/2026: PIS/Cofins 9,25% (só Lucro Real) e ICMS. A partir de 2027:
// IBS/CBS destacado na nota (crédito integral; fornecedor do Simples Nacional: DAS × 15,5%) e ICMS.
// O T2 original (repasse do fornecedor) foi substituído por essas regras. No T3, o IBS/CBS da
// nota de compra é informado em R$ 9,25 para reproduzir o custo de 90,75 da especificação.

import { describe, it, expect } from 'vitest';
import { formarPreco, custoDaCompra, compraHoje, simular, linhaDoTempo } from './motor.js';
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

describe('T2 · Custo da compra (nota de 100,00)', () => {
  it('hoje e 2026: Lucro Real credita 9,25% de PIS/Cofins, qualquer fornecedor; demais regimes, custo = nota', () => {
    expect(compraHoje({ V: 100, creditaPis: true }).custo).toBe(90.75);
    expect(compraHoje({ V: 100 }).custo).toBe(100);
  });
  it('2027: quem credita desconta o IBS/CBS da nota (100 − 9,31% = 90,69)', () => {
    expect(custoDaCompra({ V: 100, fornecedor: 'real', ibsCbsV: 9.31, creditaIbs: true }).custo).toBe(90.69);
  });
  it('2027: quem não credita fica com a nota inteira', () => {
    expect(custoDaCompra({ V: 100, fornecedor: 'real', ibsCbsV: 9.31, creditaIbs: false }).custo).toBe(100);
  });
  it('fornecedor Simples Híbrido: crédito integral do IBS/CBS destacado', () => {
    expect(custoDaCompra({ V: 100, fornecedor: 'simples_hibrido', ibsCbsV: 9.31, creditaIbs: true }).credito).toBe(9.31);
  });
  it('fornecedor Simples Nacional: crédito = nota × DAS × 15,5% (1,24)', () => {
    const c = custoDaCompra({ V: 100, fornecedor: 'simples_unico', dasFornecedor: 0.08, parcela: 0.155, ibsCbsV: 9.31, creditaIbs: true });
    expect(c.credito).toBe(1.24);
    expect(c.custo).toBe(98.76);
  });
  it('ICMS destacado também sai do custo de quem credita', () => {
    expect(custoDaCompra({ V: 100, fornecedor: 'real', ibsCbsV: 9.31, icmsV: 12, creditaIbs: true, creditaIcms: true }).custo).toBe(78.69);
    expect(compraHoje({ V: 100, icmsV: 12, creditaPis: true, creditaIcms: true }).custo).toBe(78.75);
  });
});

describe('T3 · Presumido comprando do Lucro Real (sem ICMS, 2027)', () => {
  const p = { ...P0, icmsProduto: 0 };
  const ent = { ano: 2027, regime: 'presumido', atividade: 'comercio', valorCompra: 100, fornecedor: 'real', ibsCbsModo: 'rs', ibsCbsCompra: 9.25, despesasVar: 10, modo: 'margem', margem: 20, cliente: 'consumidor', das: 8 };
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
      expect(cent(c.despesasVar)).toBe(e.despesas);
      expect(cent(c.lair)).toBe(e.lair);
      expect(cent(c.ir)).toBe(e.ir);
      expect(cent(c.lucroLiquido)).toBe(e.lucroLiquido);
      expect(Number(c.margemLiquida.toFixed(4))).toBe(e.margem);
    });
  }
  it('margem sobre o preço de venda = margem embutida (hoje e repassar)', () => {
    expect(s.hoje.margemPreco).toBeCloseTo(0.2, 10);
    expect(s.repassar.margemPreco).toBeCloseTo(0.2, 10);
  });
  it('Lucro líquido (Contábil) com 1 casa, como na especificação (20,8% · 20,0% · 22,5% · 24,2%)', () => {
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
  const ent = { regime: 'presumido', atividade: 'comercio', valorCompra: 100, fornecedor: 'real', despesasVar: 10, modo: 'margem', margem: 20, cliente: 'consumidor', das: 8 };
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
  const base = { ano: 2027, atividade: 'comercio', valorCompra: 100, fornecedor: 'real', despesasVar: 10, modo: 'margem', margem: 20, cliente: 'consumidor', das: 8 };
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

describe('ajustes da segunda rodada', () => {
  const base = { ano: 2027, regime: 'presumido', atividade: 'comercio', valorCompra: 100, fornecedor: 'real', icmsFornecedor: 0, despesasVar: 10, despesasFixas: 0, modo: 'margem', margem: 20, cliente: 'consumidor', das: 8 };

  it('fixos somados ao custo e variáveis no divisor: 100 + 10% = 110 → 110 ÷ 0,9 = 122,22', () => {
    expect(cent(formarPreco({ custo: 100, fixos: 10, despesas: 0.1 }).preco)).toBe(122.22);
  });
  it('fixos em R$: mantidos no valor de hoje mesmo com o custo caindo', () => {
    const s = simular({ ...base, despesasFixas: 10 }, { ...P0, icmsProduto: 0 });
    expect(cent(s.hoje.fixos)).toBe(cent(s.custoHoje * 0.1));
    expect(cent(s.lucro.fixos)).toBe(cent(s.hoje.fixos));
    expect(cent(s.lucro.lucroLiquido)).toBe(cent(s.hoje.lucroLiquido));
  });
  it('fixos em %: acompanham o custo do ano', () => {
    const s = simular({ ...base, despesasFixas: 10 }, { ...P0, icmsProduto: 0, fixosModo: 'pct' });
    expect(cent(s.lucro.fixos)).toBe(cent(s.custoAno * 0.1));
  });
  it('preço de hoje com fixos segue a fórmula (custo + fixos) ÷ divisor', () => {
    const s = simular({ ...base, despesasFixas: 10 }, { ...P0, icmsProduto: 0 });
    expect(s.hoje.preco).toBeCloseTo((s.custoHoje * 1.1) / s.hoje.divisor, 10);
  });

  it('campo IBS/CBS vazio usa a alíquota do ano sobre a nota; % e R$ informados', () => {
    const p = { ...P0, icmsProduto: 0 };
    expect(simular(base, p).custoAno).toBe(90.69);
    expect(simular({ ...base, ibsCbsCompra: 5 }, p).custoAno).toBe(95);
    expect(simular({ ...base, ibsCbsModo: 'rs', ibsCbsCompra: 7.5 }, p).custoAno).toBe(92.5);
  });
  it('2026: Lucro Real = nota − 9,25%; demais regimes = nota', () => {
    const p = { ...P0, icmsProduto: 0 };
    expect(simular({ ...base, ano: 2026, regime: 'real' }, p).custoAno).toBe(90.75);
    expect(simular({ ...base, ano: 2026, regime: 'presumido' }, p).custoAno).toBe(100);
    expect(simular({ ...base, ano: 2026, regime: 'presumido', fornecedor: 'simples_unico' }, p).custoAno).toBe(100);
  });
  it('ICMS em %: alíquota cheia reduzida pelo fator do ano; serviço não credita', () => {
    const p = { ...P0, icmsProduto: 0 };
    const s30 = simular({ ...base, ano: 2030, icmsFornecedor: 12 }, p);
    expect(s30.compra.icmsV).toBe(9.6);
    const serv = simular({ ...base, atividade: 'servico', icmsFornecedor: 12 }, p);
    expect(serv.compra.creditoIcms).toBe(0);
  });
  it('Simples Híbrido: DAS informado já é sem IBS/CBS; hoje usa o DAS cheio', () => {
    const s = simular({ ...base, regime: 'simples_hibrido', das: 6.76 }, P0);
    expect(s.ctxAno.itens[0].aliq).toBeCloseTo(0.0676, 10);
    expect(s.ctxHoje.itens[0].aliq).toBeCloseTo(0.0676 / 0.845, 10);
    expect(s.hoje.margemPreco).toBeCloseTo(0.2, 10);
    expect(s.repassar.margemPreco).toBeCloseTo(0.2, 10);
  });
  it('margem sobre o preço = margem embutida em todos os regimes', () => {
    for (const regime of ['presumido', 'real', 'simples_unico', 'simples_hibrido']) {
      const s = simular({ ...base, regime, despesasFixas: 5 }, P0);
      expect(s.hoje.margemPreco, regime).toBeCloseTo(0.2, 10);
      expect(s.repassar.margemPreco, regime).toBeCloseTo(0.2, 10);
    }
  });
  it('serviço usa ISS no lugar do ICMS, com a mesma redução (ADCT, art. 128)', () => {
    const s = simular({ ...base, atividade: 'servico', ano: 2029 }, P0);
    expect(s.taxas.nomeLocal).toBe('ISS');
    expect(s.taxas.ic).toBeCloseTo(0.045, 10);
    expect(s.hoje.e).toBeCloseTo(0.05, 10);
    expect(s.memoria['lucro.icms'].rotulo).toMatch(/^ISS/);
    // IBS da hipótese repõe o ISS que saiu: (5% − 4,5%) ÷ (1 − 4,5%)
    expect(s.taxas.ibs).toBeCloseTo(0.005 / 0.955, 10);
  });
  it('serviço não usa a chave S (ela é só do ICMS)', () => {
    const n = simular({ ...base, atividade: 'servico' }, P0);
    const comChave = simular({ ...base, atividade: 'servico' }, { ...P0, chaveIbsCbsNaBaseIcms: true });
    expect(comChave.repassar.nota).toBe(n.repassar.nota);
  });

  it('2026: ano de teste, preço e nota iguais aos de hoje; IBS/CBS só informativo', () => {
    const s = simular({ ...base, ano: 2026 }, P0);
    expect(s.teste).toBe(true);
    for (const id of ['lucro', 'repassar', 'nota']) {
      expect(cent(s[id].preco)).toBe(cent(s.hoje.preco));
      expect(s[id].nota).toBe(s.hoje.nota);
      expect(s[id].ibsCbs).toBe(0);
    }
    expect(s.taxas.cbs).toBeCloseTo(0.009, 10);
    const base26 = s.lucro.preco * (1 - 0.195);
    expect(s.lucro.info.ibsCbs).toBe(r2(r2(base26 * 0.009) + r2(base26 * 0.001)));
    expect(s.memoria['lucro.ibsCbsInfo']).toBeTruthy();
  });
  it('linha do tempo começa em 2026', () => {
    expect(linhaDoTempo(base, P0)[0].ano).toBe(2026);
  });
  it('todo número de todos os anos e regimes tem memória', () => {
    for (const regime of ['presumido', 'real', 'simples_unico', 'simples_hibrido']) {
      for (const atividade of ['comercio', 'servico']) {
        for (const l of linhaDoTempo({ ...base, regime, atividade, despesasFixas: 5, icmsFornecedor: 12 }, P0)) {
          expect(l.erro, regime + ' ' + atividade + ' ' + l.ano).toBeUndefined();
          for (const m of Object.values(l.memoria)) {
            expect(m.formula, m.id).toBeTruthy();
            expect(m.subst, m.id).toBeTruthy();
          }
        }
      }
    }
  });
});
