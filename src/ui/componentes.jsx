import { createContext, useContext, useEffect, useState } from 'react';
import { R, P, N4 } from '../engine/numeros.js';

// ---------------------------------------------------------------------------
// Memória: todo número exibido é um botão que abre a própria memória de cálculo
// ---------------------------------------------------------------------------

export const MemoriaCtx = createContext({ memoria: {}, abrir: () => {} });

export function formatar(item) {
  if (!item) return '—';
  if (item.tipo === 'pct') return P(item.valor);
  if (item.tipo === 'n4') return N4(item.valor);
  return R(item.valor);
}

/** Número com memória. `mem` permite usar a memória de outra simulação (linha do tempo). */
export function Num({ id, mem, prefixo = '', className = '' }) {
  const ctx = useContext(MemoriaCtx);
  const memoria = mem || ctx.memoria;
  const item = memoria[id];
  if (!item) {
    if (import.meta.env.DEV) console.warn('Número sem memória:', id);
    return <span className={className}>—</span>;
  }
  return (
    <button type="button" className={`num ${item.alerta ? 'num--alerta' : ''} ${className}`} onClick={() => ctx.abrir(item)} title="Ver a memória de cálculo">
      {prefixo}
      {formatar(item)}
    </button>
  );
}

export function MemoriaItem({ item, compacto = false }) {
  return (
    <div className={`memo ${compacto ? 'memo--compacto' : ''}`}>
      <div className="memo__topo">
        <span className="memo__rotulo">{item.rotulo}</span>
        <span className="memo__valor">{formatar(item)}</span>
      </div>
      <div className="memo__linha">
        <span className="eyebrow">Fórmula</span>
        <p>{item.formula}</p>
      </div>
      <div className="memo__linha">
        <span className="eyebrow">Com os valores</span>
        <p className="memo__conta">{item.subst}</p>
      </div>
      {item.base && (
        <div className="memo__linha">
          <span className="eyebrow">Base legal</span>
          <p>{item.base}</p>
        </div>
      )}
      {item.alerta && <p className="memo__alerta">{item.alerta}</p>}
    </div>
  );
}

export function Gaveta({ aberta, onFechar, titulo, eyebrow, children, larga = false }) {
  useEffect(() => {
    if (!aberta) return;
    const esc = (e) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aberta, onFechar]);
  if (!aberta) return null;
  return (
    <div className="gaveta-fundo no-print" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <aside className={`gaveta ${larga ? 'gaveta--larga' : ''}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="gaveta__topo">
          <div>
            {eyebrow && <span className="eyebrow eyebrow--ouro">{eyebrow}</span>}
            <h2>{titulo}</h2>
          </div>
          <button type="button" className="btn-fechar" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </header>
        <div className="gaveta__corpo">{children}</div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campos
// ---------------------------------------------------------------------------

const paraTexto = (v) => (v === '' || v === null || v === undefined ? '' : String(v).replace('.', ','));
function paraNumero(txt) {
  const t = String(txt).trim();
  if (t === '') return '';
  const limpo = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** Campo numérico no formato brasileiro (aceita vírgula). */
export function CampoNumero({ rotulo, valor, onChange, sufixo, prefixo, dica, placeholder, id, compacto }) {
  const [txt, setTxt] = useState(paraTexto(valor));
  const [foco, setFoco] = useState(false);
  useEffect(() => {
    if (!foco) setTxt(paraTexto(valor));
  }, [valor, foco]);
  return (
    <label className={`campo ${compacto ? 'campo--compacto' : ''}`} htmlFor={id}>
      {rotulo && <span className="campo__rotulo">{rotulo}</span>}
      <span className="campo__caixa">
        {prefixo && <span className="campo__afixo">{prefixo}</span>}
        <input
          id={id}
          inputMode="decimal"
          value={txt}
          placeholder={placeholder}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          onChange={(e) => {
            setTxt(e.target.value);
            const n = paraNumero(e.target.value);
            if (n !== null) onChange(n);
          }}
        />
        {sufixo && <span className="campo__afixo">{sufixo}</span>}
      </span>
      {dica && <span className="campo__dica">{dica}</span>}
    </label>
  );
}

/** Campo numérico com escolha de unidade (% ou R$). */
export function CampoUnidade({ rotulo, valor, onChange, unidade, onUnidade, dica, placeholder, id }) {
  return (
    <div className="campo">
      <span className="campo__rotulo campo__rotulo--com-unidade">
        <label htmlFor={id}>{rotulo}</label>
        <span className="unidade" role="radiogroup" aria-label={`Unidade de ${rotulo}`}>
          {[
            ['pct', '%'],
            ['rs', 'R$'],
          ].map(([v, n]) => (
            <button key={v} type="button" role="radio" aria-checked={unidade === v} className={`unidade__op ${unidade === v ? 'unidade__op--ativa' : ''}`} onClick={() => onUnidade(v)}>
              {n}
            </button>
          ))}
        </span>
      </span>
      <CampoNumero id={id} valor={valor} onChange={onChange} prefixo={unidade === 'rs' ? 'R$' : undefined} sufixo={unidade === 'pct' ? '%' : undefined} placeholder={placeholder} />
      {dica && <span className="campo__dica">{dica}</span>}
    </div>
  );
}

export function Opcoes({ rotulo, valor, onChange, opcoes, dica, colunas }) {
  return (
    <div className="campo">
      {rotulo && <span className="campo__rotulo">{rotulo}</span>}
      <div className="opcoes" role="radiogroup" aria-label={rotulo} style={colunas ? { gridTemplateColumns: `repeat(${colunas}, 1fr)` } : undefined}>
        {opcoes.map((o) => (
          <button type="button" role="radio" aria-checked={valor === o.valor} key={o.valor} className={`opcao ${valor === o.valor ? 'opcao--ativa' : ''}`} onClick={() => onChange(o.valor)}>
            <span className="opcao__nome">{o.nome}</span>
            {o.sub && <span className="opcao__sub">{o.sub}</span>}
          </button>
        ))}
      </div>
      {dica && <span className="campo__dica">{dica}</span>}
    </div>
  );
}

export function Selecao({ rotulo, valor, onChange, opcoes, dica, id }) {
  return (
    <label className="campo" htmlFor={id}>
      <span className="campo__rotulo">{rotulo}</span>
      <span className="campo__caixa campo__caixa--select">
        <select id={id} value={valor} onChange={(e) => onChange(e.target.value)}>
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.nome}
            </option>
          ))}
        </select>
      </span>
      {dica && <span className="campo__dica">{dica}</span>}
    </label>
  );
}

export function Chave({ rotulo, valor, onChange, dica }) {
  return (
    <label className="chave">
      <input type="checkbox" checked={!!valor} onChange={(e) => onChange(e.target.checked)} />
      <span className="chave__trilho" aria-hidden="true" />
      <span>
        <span className="chave__rotulo">{rotulo}</span>
        {dica && <span className="campo__dica">{dica}</span>}
      </span>
    </label>
  );
}
