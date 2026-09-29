import { CampoNumero, Chave } from './componentes.jsx';
import { ANOS, BASE_LEGAL, taxasDoAno } from '../engine/premissas.js';
import { P } from '../engine/numeros.js';

function Grupo({ titulo, base, children }) {
  return (
    <section className="premissas__grupo">
      <h3>{titulo}</h3>
      {base && <p className="premissas__base">{base}</p>}
      <div className="premissas__grade">{children}</div>
    </section>
  );
}

export default function Premissas({ p, setP, restaurar }) {
  const set = (k, v) => setP({ ...p, [k]: v });
  const setAno = (grupo, ano, v) => setP({ ...p, [grupo]: { ...p[grupo], [ano]: v } });
  const setPres = (ativ, k, v) => setP({ ...p, presuncao: { ...p.presuncao, [ativ]: { ...p.presuncao[ativ], [k]: v } } });

  return (
    <div className="premissas">
      <p className="premissas__intro">
        Valores padrão da especificação. Altere quando sair norma nova, por exemplo as alíquotas de referência do Senado. <strong>O IBS/CBS nunca entra no divisor do markup:</strong> ele é
        calculado por fora, no fim.
      </p>
      <button type="button" className="btn btn--contorno" onClick={restaurar}>
        Restaurar padrão
      </button>

      <Grupo titulo="IBS e CBS" base={`${BASE_LEGAL.cbs} · ${BASE_LEGAL.ibsTransicao}`}>
        <CampoNumero rotulo="CBS" sufixo="%" valor={p.cbs} onChange={(v) => set('cbs', v)} compacto />
        {ANOS.map((ano) => {
          const auto = p.ibsAno[ano] === null || p.ibsAno[ano] === '';
          const calc = taxasDoAno({ ...p, ibsAno: { ...p.ibsAno, [ano]: null } }, ano);
          return (
            <CampoNumero
              key={ano}
              rotulo={`IBS ${ano}`}
              sufixo="%"
              valor={auto ? '' : p.ibsAno[ano]}
              placeholder={auto ? `auto ${P(calc.ibs).replace('%', '')}` : ''}
              onChange={(v) => setAno('ibsAno', ano, v === '' ? null : v)}
              dica={ano >= 2029 && ano <= 2032 ? (auto ? 'Hipótese: repõe o ICMS que saiu' : 'Informado') : undefined}
              compacto
            />
          );
        })}
      </Grupo>
      <p className="premissas__nota">Nos anos de 2029 a 2032, deixe o campo vazio para usar a hipótese automática. Em 2033, a reposição é da arrecadação total, não produto a produto.</p>

      <Grupo titulo="ICMS na transição" base={`${BASE_LEGAL.icmsFator} · ${BASE_LEGAL.icms}`}>
        <CampoNumero rotulo="Alíquota ICMS do produto" sufixo="%" valor={p.icmsProduto} onChange={(v) => set('icmsProduto', v)} compacto />
        {ANOS.map((ano) => (
          <CampoNumero key={ano} rotulo={`Fator ${ano}`} valor={p.fatorIcms[ano]} onChange={(v) => setAno('fatorIcms', ano, v === '' ? 0 : v)} compacto />
        ))}
      </Grupo>
      <Chave
        rotulo="IBS/CBS na base do ICMS"
        valor={p.chaveIbsCbsNaBaseIcms}
        onChange={(v) => set('chaveIbsCbsNaBaseIcms', v)}
        dica="LC 87/1996, art. 13, §1º. Tema em disputa; o padrão é Não."
      />

      <Grupo titulo="Tributos atuais" base={`${BASE_LEGAL.pisCum} · ${BASE_LEGAL.presumido}`}>
        <CampoNumero rotulo="PIS/Cofins cumulativo" sufixo="%" valor={p.pisCofinsCumulativo} onChange={(v) => set('pisCofinsCumulativo', v)} compacto />
        <CampoNumero rotulo="PIS/Cofins não cumulativo" sufixo="%" valor={p.pisCofinsNaoCumulativo} onChange={(v) => set('pisCofinsNaoCumulativo', v)} compacto />
        <CampoNumero rotulo="Alíquota IRPJ" sufixo="%" valor={p.aliqIrpj} onChange={(v) => set('aliqIrpj', v)} compacto />
        <CampoNumero rotulo="Alíquota CSLL" sufixo="%" valor={p.aliqCsll} onChange={(v) => set('aliqCsll', v)} compacto />
        <CampoNumero rotulo="Presunção IRPJ · comércio" sufixo="%" valor={p.presuncao.comercio.irpj} onChange={(v) => setPres('comercio', 'irpj', v)} compacto />
        <CampoNumero rotulo="Presunção CSLL · comércio" sufixo="%" valor={p.presuncao.comercio.csll} onChange={(v) => setPres('comercio', 'csll', v)} compacto />
        <CampoNumero rotulo="Presunção IRPJ · serviço" sufixo="%" valor={p.presuncao.servico.irpj} onChange={(v) => setPres('servico', 'irpj', v)} compacto />
        <CampoNumero rotulo="Presunção CSLL · serviço" sufixo="%" valor={p.presuncao.servico.csll} onChange={(v) => setPres('servico', 'csll', v)} compacto />
        <CampoNumero rotulo="IRPJ/CSLL Lucro Real (sobre o LAIR)" sufixo="%" valor={p.irLucroReal} onChange={(v) => set('irLucroReal', v)} compacto />
      </Grupo>

      <Grupo titulo="Simples Nacional" base={`${BASE_LEGAL.simples} · ${BASE_LEGAL.dasParcela}`}>
        <CampoNumero rotulo="Parcela de IBS/CBS dentro do DAS" sufixo="%" valor={p.parcelaIbsCbsNoDas} onChange={(v) => set('parcelaIbsCbsNoDas', v)} compacto />
      </Grupo>

      <p className="premissas__nota">
        Fora do escopo desta versão: ICMS-ST, reduções de 30%, 60% e 100% do IBS/CBS, regimes específicos, Imposto Seletivo, adicional de IRPJ e ISS na transição.
      </p>
    </div>
  );
}
