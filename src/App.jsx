import { useCallback, useEffect, useMemo, useState } from 'react';
import { simular, linhaDoTempo, ENTRADAS_PADRAO, CLIENTES, FORNECEDORES } from './engine/motor.js';
import { PREMISSAS_PADRAO, ANOS, REGIMES } from './engine/premissas.js';
import { P, R } from './engine/numeros.js';
import { MemoriaCtx, Gaveta, MemoriaItem } from './ui/componentes.jsx';
import Formulario from './ui/Formulario.jsx';
import Premissas from './ui/Premissas.jsx';
import { Destaque, SeletorEstrategia, Cartoes, TabelaDRE, VisaoCliente, CustoCompra, LinhaDoTempo, MemoriaCompleta } from './ui/Resultado.jsx';

const CHAVE = 'calc-preco-reforma-v1';

function lerSalvo() {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE));
    if (s && s.ent && s.p) {
      const ent = { ...ENTRADAS_PADRAO, ...s.ent };
      if (!CLIENTES[ent.cliente]) ent.cliente = { real: 'regular', presumido_hibrido: 'regular', simples_unico: 'simples' }[ent.cliente] || 'consumidor';
      // versões anteriores: despesas em um campo só (vira "variáveis")
      if (s.ent.despesasVar === undefined && s.ent.despesas !== undefined) ent.despesasVar = s.ent.despesas;
      const p = { ...PREMISSAS_PADRAO, ...s.p };
      // versões anteriores gravavam os padrões do IBS como números; volta a tratá-los como padrão
      const antigo = { 2027: 0.1, 2028: 0.1, 2033: 18.7 };
      p.ibsAno = { ...PREMISSAS_PADRAO.ibsAno, ...p.ibsAno };
      p.fatorIcms = { ...PREMISSAS_PADRAO.fatorIcms, ...p.fatorIcms };
      for (const [ano, v] of Object.entries(antigo)) if (p.ibsAno[ano] === v) p.ibsAno[ano] = null;
      return { ent, p };
    }
  } catch {
    /* sem armazenamento: usa o padrão */
  }
  return { ent: ENTRADAS_PADRAO, p: PREMISSAS_PADRAO };
}

const ABAS = [
  { id: 'dre', nome: 'Comparar com hoje' },
  { id: 'cliente', nome: 'Visão do cliente' },
  { id: 'compra', nome: 'Custo da compra' },
  { id: 'tempo', nome: 'Linha do tempo' },
  { id: 'memoria', nome: 'Memória de cálculo' },
];

export default function App() {
  const inicial = useMemo(lerSalvo, []);
  const [ent, setEnt] = useState(inicial.ent);
  const [p, setP] = useState(inicial.p);
  const [est, setEst] = useState('lucro');
  const [aba, setAba] = useState('dre');
  const [memo, setMemo] = useState(null);
  const [premAberta, setPremAberta] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ ent, p }));
    } catch {
      /* ignorado */
    }
  }, [ent, p]);

  const set = useCallback((k, v) => setEnt((e) => ({ ...e, [k]: v })), []);
  const setPremissa = useCallback((k, v) => setP((x) => ({ ...x, [k]: v })), []);

  const { s, erro } = useMemo(() => {
    try {
      return { s: simular(ent, p) };
    } catch (e) {
      return { erro: e.message };
    }
  }, [ent, p]);
  const linhas = useMemo(() => (aba === 'tempo' ? linhaDoTempo(ent, p) : []), [ent, p, aba]);

  const ctx = useMemo(() => ({ memoria: s ? s.memoria : {}, abrir: setMemo }), [s]);
  const fecharMemo = useCallback(() => setMemo(null), []);
  const fecharPrem = useCallback(() => setPremAberta(false), []);

  return (
    <MemoriaCtx.Provider value={ctx}>
      <div className="app">
        <header className="topo">
          <div className="topo__marca">
            <span className="eyebrow eyebrow--ouro">Reforma Tributária · IBS e CBS</span>
            <h1>Qual preço praticar para não perder lucro?</h1>
          </div>
          <div className="topo__acoes no-print">
            <button type="button" className="btn btn--claro" onClick={() => setPremAberta(true)}>
              Ajustes avançados
            </button>
            <button type="button" className="btn btn--ouro" onClick={() => window.print()} disabled={!s}>
              Exportar PDF
            </button>
          </div>
        </header>

        <main className="principal">
          <aside className="lateral no-print">
            <Formulario ent={ent} set={set} premissas={p} setPremissa={setPremissa} />
          </aside>

          <div className="conteudo">
            <div className="anos no-print" role="tablist" aria-label="Ano da simulação">
              <span className="eyebrow">Ano</span>
              {ANOS.map((a) => (
                <button key={a} type="button" role="tab" aria-selected={ent.ano === a} className={`ano ${ent.ano === a ? 'ano--ativo' : ''}`} onClick={() => set('ano', a)}>
                  {a}
                </button>
              ))}
            </div>

            {erro ? (
              <section className="destaque destaque--erro">
                <span className="eyebrow eyebrow--ouro">Confira os dados</span>
                <p className="destaque__frase">{erro}</p>
              </section>
            ) : (
              <>
                <SeletorEstrategia est={est} setEst={setEst} />
                <Destaque s={s} est={est} />
                <Cartoes est={est} />

                <nav className="abas no-print" role="tablist">
                  {ABAS.map((a) => (
                    <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={`aba ${aba === a.id ? 'aba--ativa' : ''}`} onClick={() => setAba(a.id)}>
                      {a.nome}
                    </button>
                  ))}
                </nav>
                <section className="painel no-print">
                  {aba === 'dre' && <TabelaDRE s={s} est={est} setEst={setEst} />}
                  {aba === 'cliente' && <VisaoCliente s={s} est={est} />}
                  {aba === 'compra' && <CustoCompra s={s} fornecedor={ent.fornecedor} />}
                  {aba === 'tempo' && <LinhaDoTempo linhas={linhas} est={est} anoAtual={ent.ano} setAno={(a) => set('ano', a)} />}
                  {aba === 'memoria' && <MemoriaCompleta s={s} />}
                </section>

                <Relatorio s={s} ent={ent} p={p} est={est} />
              </>
            )}
          </div>
        </main>

        <footer className="rodape no-print">
          Simulação didática. Premissas editáveis em "Ajustes avançados". Não inclui ICMS-ST, reduções de alíquota, Imposto Seletivo nem ISS.
        </footer>
      </div>

      <Gaveta aberta={!!memo} onFechar={fecharMemo} titulo="Memória de cálculo" eyebrow="De onde vem este número">
        {memo && <MemoriaItem item={memo} />}
      </Gaveta>
      <Gaveta aberta={premAberta} onFechar={fecharPrem} titulo="Premissas" eyebrow="Ajustes avançados · contabilidade" larga>
        <Premissas p={p} setP={setP} restaurar={() => setP(PREMISSAS_PADRAO)} />
      </Gaveta>
    </MemoriaCtx.Provider>
  );
}

/** Versão para impressão/PDF: entradas, premissas, resultado, DRE e memória completa. */
function Relatorio({ s, ent, p, est }) {
  const linhas = [
    ['Ano', ent.ano],
    ['Regime', REGIMES[ent.regime] + (!ent.regime.startsWith('simples') ? ` (${ent.atividade === 'servico' ? 'serviço' : 'comércio'})` : '')],
    ent.regime.startsWith('simples')
      ? ['DAS', `${R(ent.das)}%`]
      : ent.atividade === 'servico'
        ? ['ISS do serviço', `${R(p.issServico)}%`]
        : ['ICMS do produto', `${R(p.icmsProduto)}%`],
    [ent.fornecedor.startsWith('simples') ? 'Valor da nota de compra' : 'Valor da compra sem PIS/Cofins', `R$ ${R(ent.valorCompra)}`],
    ['Fornecedor', FORNECEDORES[ent.fornecedor] + (ent.usoPessoal ? ' · uso e consumo pessoal' : '')],
    ...(ent.fornecedor.startsWith('simples') ? [] : [['ICMS na nota do fornecedor', `${R(ent.icmsFornecedor || 0)}%`]]),
    ent.modo === 'preco' ? ['Preço de venda hoje', `R$ ${R(ent.precoHoje)}`] : ['Margem', `${R(ent.margem)}%${ent.regime === 'real' ? ' (depois do IR)' : ''}`],
    ['Custos/despesas fixos', `${R(ent.despesasFixas || 0)}% do custo`],
    ['Custos/despesas variáveis', `${R(ent.despesasVar || 0)}% do preço`],
    ['Cliente', CLIENTES[ent.cliente]?.nome],
  ];
  const prem = [
    ['CBS', P(s.taxas.cbs)],
    [`IBS ${s.ano}`, P(s.taxas.ibs)],
    [`${s.taxas.nomeLocal} ${s.ano}`, P(s.taxas.ic)],
    ['IBS/CBS na base do ICMS', p.chaveIbsCbsNaBaseIcms ? 'Sim' : 'Não'],
    ['PIS/Cofins cumulativo / não cumulativo', `${R(p.pisCofinsCumulativo)}% / ${R(p.pisCofinsNaoCumulativo)}%`],
    ['IRPJ / CSLL', `${R(p.aliqIrpj)}% / ${R(p.aliqCsll)}%`],
    ['Presunção comércio (IRPJ/CSLL)', `${R(p.presuncao.comercio.irpj)}% / ${R(p.presuncao.comercio.csll)}%`],
    ['Presunção serviço (IRPJ/CSLL)', `${R(p.presuncao.servico.irpj)}% / ${R(p.presuncao.servico.csll)}%`],
    ['IRPJ/CSLL Lucro Real', `${R(p.irLucroReal)}% do LAIR`],
    ['Parcela de IBS/CBS no DAS', `${R(p.parcelaIbsCbsNoDas)}%`],
    ['DAS estimado do fornecedor do Simples', `${R(p.dasFornecedor)}%`],
    ['Custos/despesas fixos nos anos da Reforma', p.fixosModo === 'pct' ? '% sobre o custo do ano' : 'valor em R$ de hoje'],
  ];
  return (
    <div className="relatorio print-only">
      <section>
        <h2>Entradas da operação</h2>
        <dl className="relatorio__lista">
          {linhas.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <h2>Premissas</h2>
        <dl className="relatorio__lista">
          {prem.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h2>DRE comparada</h2>
        <TabelaDRE s={s} est={est} />
      </section>
      <section>
        <h2>Visão do cliente</h2>
        <VisaoCliente s={s} est={est} />
      </section>
      <section className="relatorio__memoria">
        <h2>Memória de cálculo</h2>
        <MemoriaCompleta s={s} todos />
      </section>
    </div>
  );
}
