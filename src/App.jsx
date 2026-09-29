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
    if (s && s.ent && s.p) return { ent: { ...ENTRADAS_PADRAO, ...s.ent }, p: { ...PREMISSAS_PADRAO, ...s.p } };
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
                  {aba === 'compra' && <CustoCompra s={s} />}
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
    ['Regime', REGIMES[ent.regime] + (ent.regime === 'presumido' ? ` (${ent.atividade === 'servico' ? 'serviço' : 'comércio'})` : '')],
    ent.regime.startsWith('simples') ? ['DAS', `${R(ent.das)}%`] : ['ICMS do produto', `${R(p.icmsProduto)}%`],
    ['Nota de compra hoje', `R$ ${R(ent.valorCompra)}`],
    ['Fornecedor', FORNECEDORES[ent.fornecedor] + (ent.usoPessoal ? ' · uso e consumo pessoal' : '')],
    ent.modo === 'preco' ? ['Preço de venda hoje', `R$ ${R(ent.precoHoje)}`] : ['Margem', `${R(ent.margem)}%${ent.regime === 'real' ? ' (depois do IR)' : ''}`],
    ['Despesas', `${R(ent.despesas)}%`],
    ['Cliente', CLIENTES[ent.cliente]?.nome],
  ];
  const prem = [
    ['CBS', P(s.taxas.cbs)],
    [`IBS ${s.ano}`, P(s.taxas.ibs)],
    [`ICMS ${s.ano}`, P(s.taxas.ic)],
    ['IBS/CBS na base do ICMS', p.chaveIbsCbsNaBaseIcms ? 'Sim' : 'Não'],
    ['PIS/Cofins cumulativo / não cumulativo', `${R(p.pisCofinsCumulativo)}% / ${R(p.pisCofinsNaoCumulativo)}%`],
    ['IRPJ / CSLL', `${R(p.aliqIrpj)}% / ${R(p.aliqCsll)}%`],
    ['Presunção comércio (IRPJ/CSLL)', `${R(p.presuncao.comercio.irpj)}% / ${R(p.presuncao.comercio.csll)}%`],
    ['Presunção serviço (IRPJ/CSLL)', `${R(p.presuncao.servico.irpj)}% / ${R(p.presuncao.servico.csll)}%`],
    ['IRPJ/CSLL Lucro Real', `${R(p.irLucroReal)}% do LAIR`],
    ['Parcela de IBS/CBS no DAS', `${R(p.parcelaIbsCbsNoDas)}%`],
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
