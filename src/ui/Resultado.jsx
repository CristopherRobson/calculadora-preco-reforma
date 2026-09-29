import { useState } from 'react';
import { Num, MemoriaItem } from './componentes.jsx';
import { ESTRATEGIAS } from '../engine/motor.js';
import { P } from '../engine/numeros.js';

const NOME = { hoje: 'Hoje', lucro: 'Manter lucro', repassar: 'Repassar tudo', nota: 'Manter a nota' };

// ---------------------------------------------------------------------------
// Destaque: a resposta principal
// ---------------------------------------------------------------------------

export function Destaque({ s, est }) {
  const c = s[est];
  const h = s.hoje;
  const varNota = h.nota > 0 ? c.nota / h.nota - 1 : 0;
  const varLucro = c.lucroLiquido - h.lucroLiquido;
  const titulo = {
    lucro: `Para manter seu lucro em ${s.ano}`,
    repassar: `Mantendo sua margem em ${s.ano}`,
    nota: `Mantendo o valor da nota em ${s.ano}`,
  }[est];
  const frase = {
    lucro: (
      <>
        Você continua ganhando <Num id="lucro.lucroLiquido" prefixo="R$ " /> por venda, o mesmo de hoje.
      </>
    ),
    repassar: (
      <>
        Sua margem se mantém, mas o lucro por venda vai de <Num id="hoje.lucroLiquido" prefixo="R$ " /> para <Num id="repassar.lucroLiquido" prefixo="R$ " />
        {varLucro < -0.005 ? ', porque o custo caiu.' : '.'}
      </>
    ),
    nota: (
      <>
        O cliente paga o mesmo total. Seu lucro por venda vai de <Num id="hoje.lucroLiquido" prefixo="R$ " /> para <Num id="nota.lucroLiquido" prefixo="R$ " />.
      </>
    ),
  }[est];

  return (
    <section className="destaque" aria-live="polite">
      <span className="eyebrow eyebrow--ouro">{titulo}</span>
      <div className="destaque__numeros">
        <div className="destaque__bloco">
          <span className="destaque__rotulo">Venda por (preço sem IBS/CBS)</span>
          <Num id={`${est}.preco`} prefixo="R$ " className="destaque__preco" />
          <span className="destaque__sub">
            Hoje: <Num id="hoje.preco" prefixo="R$ " />
          </span>
        </div>
        <div className="destaque__mais" aria-hidden="true">
          +
        </div>
        <div className="destaque__bloco">
          <span className="destaque__rotulo">IBS/CBS por fora</span>
          <Num id={`${est}.ibsCbs`} prefixo="R$ " className="destaque__imposto" />
          <span className="destaque__sub">{s.ctxAno.porFora ? `${P(s.taxas.a)}, somado por fora` : 'Dentro do DAS'}</span>
        </div>
        <div className="destaque__mais" aria-hidden="true">
          =
        </div>
        <div className="destaque__bloco">
          <span className="destaque__rotulo">Total da nota ao cliente</span>
          <Num id={`${est}.nota`} prefixo="R$ " className="destaque__nota" />
          <span className="destaque__sub">
            Hoje: <Num id="hoje.nota" prefixo="R$ " />{' '}
            <span className={`variacao ${varNota > 0.00005 ? 'variacao--sobe' : varNota < -0.00005 ? 'variacao--desce' : ''}`}>
              {varNota > 0 ? '▲' : varNota < 0 ? '▼' : '='} {P(Math.abs(varNota))}
            </span>
          </span>
        </div>
      </div>
      <p className="destaque__frase">{frase}</p>
      <p className="destaque__regra">O IBS/CBS nunca entra no divisor do markup: é calculado sobre o preço e somado no fim.</p>
    </section>
  );
}

export function SeletorEstrategia({ est, setEst }) {
  return (
    <div className="estrategias" role="tablist" aria-label="Estratégia de preço">
      {ESTRATEGIAS.map((e) => (
        <button key={e.id} type="button" role="tab" aria-selected={est === e.id} className={`estrategia ${est === e.id ? 'estrategia--ativa' : ''}`} onClick={() => setEst(e.id)}>
          <span className="estrategia__nome">
            {e.nome}
            {e.id === 'lucro' && <span className="selo">Recomendado</span>}
          </span>
          <span className="estrategia__resumo">{e.resumo}</span>
        </button>
      ))}
    </div>
  );
}

export function Cartoes({ est }) {
  return (
    <div className="cartoes">
      <div className="cartao">
        <span className="eyebrow">Custo real da mercadoria</span>
        <Num id="compra.custo" prefixo="R$ " className="cartao__valor" />
        <span className="cartao__sub">
          Hoje <Num id="compra.hoje" prefixo="R$ " />
        </span>
      </div>
      <div className="cartao">
        <span className="eyebrow">Markup {est === 'repassar' ? '' : 'equivalente'}</span>
        {est === 'repassar' ? (
          <>
            <Num id="repassar.multiplicador" prefixo="× " className="cartao__valor" />
            <span className="cartao__sub">
              Divisor <Num id="repassar.divisor" />
            </span>
          </>
        ) : (
          <>
            <Num id={`${est}.markup`} prefixo="× " className="cartao__valor" />
            <span className="cartao__sub">
              Hoje × <Num id="hoje.multiplicador" />
            </span>
          </>
        )}
      </div>
      <div className="cartao">
        <span className="eyebrow">Lucro líquido</span>
        <Num id={`${est}.lucroLiquido`} prefixo="R$ " className="cartao__valor" />
        <span className="cartao__sub">
          Hoje <Num id="hoje.lucroLiquido" prefixo="R$ " />
        </span>
      </div>
      <div className="cartao">
        <span className="eyebrow">Margem líquida</span>
        <Num id={`${est}.margemLiquida`} className="cartao__valor" />
        <span className="cartao__sub">
          Hoje <Num id="hoje.margemLiquida" />
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DRE comparada (hoje × três estratégias)
// ---------------------------------------------------------------------------

const LINHAS_DRE = [
  { k: 'nota', nome: 'Nota (valor cobrado)', tipo: 'total' },
  { k: 'ibsCbs', nome: '(−) IBS/CBS por fora' },
  { k: 'receitaBruta', nome: '= Receita bruta', tipo: 'sub' },
  { k: 'pis', nome: '(−) PIS/Cofins', opcional: true },
  { k: 'icms', nome: '(−) ICMS', opcional: true },
  { k: 'das', nome: '(−) DAS', opcional: true },
  { k: 'receitaLiquida', nome: '= Receita líquida', tipo: 'sub' },
  { k: 'custo', nome: '(−) Custo da mercadoria' },
  { k: 'lucroBruto', nome: '= Lucro bruto', tipo: 'sub' },
  { k: 'despesas', nome: '(−) Despesas' },
  { k: 'lair', nome: '= Lucro antes do IR/CSLL', tipo: 'sub' },
  { k: 'ir', nome: '(−) IRPJ/CSLL' },
  { k: 'lucroLiquido', nome: '= Lucro líquido', tipo: 'total' },
  { k: 'margemLiquida', nome: 'Margem líquida', tipo: 'pct' },
];

export function TabelaDRE({ s, est, setEst }) {
  const cols = ['hoje', 'lucro', 'repassar', 'nota'];
  const mem = s.memoria;
  const linhas = LINHAS_DRE.filter((l) => !l.opcional || cols.some((c) => mem[`${c}.${l.k}`]));
  return (
    <div className="tabela-rolagem">
      <table className="tabela">
        <thead>
          <tr>
            <th scope="col">DRE por unidade</th>
            {cols.map((c) => (
              <th key={c} scope="col" className={`${c === est ? 'col-ativa' : ''} ${c === 'hoje' ? 'col-hoje' : ''}`}>
                {c === 'hoje' || !setEst ? (
                  <span>{c === 'hoje' ? 'Hoje' : NOME[c]}</span>
                ) : (
                  <button type="button" onClick={() => setEst(c)}>
                    {NOME[c]}
                  </button>
                )}
                <span className="th-sub">{c === 'hoje' ? 'tributos por dentro' : String(s.ano)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.k} className={l.tipo ? `linha--${l.tipo}` : ''}>
              <th scope="row">{l.nome}</th>
              {cols.map((c) => (
                <td key={c} className={c === est ? 'col-ativa' : ''}>
                  {mem[`${c}.${l.k}`] ? <Num id={`${c}.${l.k}`} /> : <span className="vazio">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="legenda">Base: Lei 6.404/1976, art. 187. O IBS/CBS destacado não é receita (DL 1.598/1977, art. 12, §4º). Clique em qualquer número para ver a conta.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visão do cliente
// ---------------------------------------------------------------------------

export function VisaoCliente({ s, est }) {
  return (
    <div className="cliente">
      <p className="aba__intro">
        Quanto a compra custa, de fato, para o seu cliente: <strong>{s.cliente.nome}</strong>. Quem toma crédito desconta o IBS/CBS destacado. Quem não toma paga a nota inteira.
      </p>
      <div className="cliente__grade">
        <div className="cliente__cartao">
          <span className="eyebrow">Hoje</span>
          <Num id="hoje.custoCliente" prefixo="R$ " className="cartao__valor" />
          <span className="cartao__sub">
            {s.cliente.regular ? (
              <>
                nota inteira · Lucro Real <Num id="hoje.custoClienteLR" prefixo="R$ " />
              </>
            ) : (
              'nota inteira'
            )}
          </span>
        </div>
        {['lucro', 'repassar', 'nota'].map((c) => (
          <div key={c} className={`cliente__cartao ${c === est ? 'cliente__cartao--ativo' : ''}`}>
            <span className="eyebrow">
              {NOME[c]} · {s.ano}
            </span>
            <Num id={`${c}.custoCliente`} prefixo="R$ " className="cartao__valor" />
            <span className="cartao__sub">{s[c].creditoCliente ? 'nota − crédito de IBS/CBS' : 'nota inteira'}</span>
          </div>
        ))}
      </div>
      <h4 className="aba__subtitulo">Qualquer cliente, na estratégia {NOME[est]}</h4>
      <div className="cliente__dupla">
        <div>
          <span className="eyebrow">Cliente que credita</span>
          <Num id={`${est}.custoClienteCredita`} prefixo="R$ " className="cartao__valor" />
          <span className="cartao__sub">Empresa no regime regular de IBS/CBS</span>
        </div>
        <div>
          <span className="eyebrow">Cliente que não credita</span>
          <Num id={`${est}.custoClienteNaoCredita`} prefixo="R$ " className="cartao__valor" />
          <span className="cartao__sub">Consumidor final, uso e consumo pessoal, Simples não optante</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custo da compra
// ---------------------------------------------------------------------------

export function CustoCompra({ s }) {
  const m = s.memoria;
  const linhas = [
    ['compra.V', 'Nota de compra hoje'],
    ['compra.hoje', 'Custo da mercadoria hoje'],
    ['compra.base', 'Preço do fornecedor sem o tributo que sai'],
    ['compra.cbs', '(+) CBS'],
    ['compra.ibs', '(+) IBS'],
    ['compra.nota', `= Nota de compra ${s.ano}`],
    ['compra.credito', '(−) Crédito de IBS/CBS'],
    ['compra.custo', `= Custo real ${s.ano}`],
  ].filter(([id]) => m[id]);
  return (
    <div>
      <p className="aba__intro">Premissa de mercado: o fornecedor tira do preço o tributo que hoje está embutido e soma o IBS/CBS por fora. O custo real é a nota menos o crédito.</p>
      <table className="tabela tabela--estreita">
        <tbody>
          {linhas.map(([id, nome]) => (
            <tr key={id} className={nome.startsWith('=') ? 'linha--sub' : ''}>
              <th scope="row">{nome}</th>
              <td>
                <Num id={id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linha do tempo
// ---------------------------------------------------------------------------

export function LinhaDoTempo({ linhas, est, anoAtual, setAno }) {
  const validas = linhas.filter((l) => !l.erro);
  const max = Math.max(...validas.map((l) => l[est].nota), ...validas.map((l) => l.hoje.nota));
  return (
    <div>
      <p className="aba__intro">
        A mesma operação de 2027 a 2033, na estratégia <strong>{NOME[est]}</strong>. O ICMS cai e o IBS sobe. Clique numa linha para simular aquele ano.
      </p>
      <div className="tabela-rolagem">
        <table className="tabela tabela--tempo">
          <thead>
            <tr>
              <th scope="col">Ano</th>
              <th scope="col">ICMS</th>
              <th scope="col">IBS</th>
              <th scope="col">CBS</th>
              <th scope="col">Preço</th>
              <th scope="col">Nota</th>
              <th scope="col">Lucro</th>
              <th scope="col" className="col-barra">
                Nota × hoje
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) =>
              l.erro ? (
                <tr key={l.ano}>
                  <th scope="row">{l.ano}</th>
                  <td colSpan={7} className="erro-linha">
                    {l.erro}
                  </td>
                </tr>
              ) : (
                <tr key={l.ano} className={`linha-ano ${l.ano === anoAtual ? 'linha-ano--ativa' : ''}`} onClick={(e) => !e.target.closest('.num') && setAno(l.ano)}>
                  <th scope="row">{l.ano}</th>
                  <td>
                    <Num id="ano.ic" mem={l.memoria} />
                  </td>
                  <td>
                    <Num id="ano.ibs" mem={l.memoria} />
                  </td>
                  <td>
                    <Num id="ano.cbs" mem={l.memoria} />
                  </td>
                  <td>
                    <Num id={`${est}.preco`} mem={l.memoria} />
                  </td>
                  <td>
                    <Num id={`${est}.nota`} mem={l.memoria} />
                  </td>
                  <td>
                    <Num id={`${est}.lucroLiquido`} mem={l.memoria} />
                  </td>
                  <td className="col-barra">
                    <span className="barra">
                      <span className="barra__hoje" style={{ width: `${(l.hoje.nota / max) * 100}%` }} />
                      <span className="barra__ano" style={{ width: `${(l[est].nota / max) * 100}%` }} />
                    </span>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <p className="legenda">
        <span className="chip-legenda chip-legenda--ano" /> nota no ano <span className="chip-legenda chip-legenda--hoje" /> nota hoje. Em 2033, a reposição do IBS é da arrecadação total, não produto a produto.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Memória completa
// ---------------------------------------------------------------------------

const GRUPOS = [
  { id: 'ano', nome: 'Alíquotas do ano' },
  { id: 'compra', nome: 'Compra' },
  { id: 'hoje', nome: 'Hoje' },
  { id: 'lucro', nome: 'Manter lucro' },
  { id: 'repassar', nome: 'Repassar tudo' },
  { id: 'nota', nome: 'Manter a nota' },
];

export function MemoriaCompleta({ s, todos = false }) {
  const [grupo, setGrupo] = useState('lucro');
  const itens = Object.values(s.memoria);
  const alertas = itens.filter((i) => i.alerta);
  const visiveis = todos ? GRUPOS : GRUPOS.filter((g) => g.id === grupo);
  return (
    <div className="memoria">
      {!todos && (
        <>
          <p className="aba__intro">Todos os números da simulação, com a fórmula, os valores substituídos e a base legal.</p>
          <div className="filtros" role="tablist">
            {GRUPOS.map((g) => (
              <button key={g.id} type="button" role="tab" aria-selected={grupo === g.id} className={`filtro ${grupo === g.id ? 'filtro--ativo' : ''}`} onClick={() => setGrupo(g.id)}>
                {g.nome}
              </button>
            ))}
          </div>
        </>
      )}
      {alertas.length > 0 && !todos && (
        <p className="memo__alerta">
          {alertas.length} {alertas.length === 1 ? 'linha tem' : 'linhas têm'} diferença de arredondamento de centavo, marcadas com ponto dourado. É normal: cada linha é arredondada a 2 casas.
        </p>
      )}
      {visiveis.map((g) => (
        <section key={g.id} className="memoria__grupo">
          {todos && <h3>{g.nome}</h3>}
          <div className="memoria__lista">
            {itens
              .filter((i) => i.id.startsWith(g.id + '.'))
              .map((i) => (
                <MemoriaItem key={i.id} item={i} compacto />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

