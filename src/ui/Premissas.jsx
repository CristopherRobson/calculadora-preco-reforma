import { CampoNumero, Chave, Opcoes } from './componentes.jsx';
import { ANOS, BASE_LEGAL, taxasDoAno } from '../engine/premissas.js';
import { P } from '../engine/numeros.js';

function Grupo({ titulo, base, children }) {
  return (
    <section className="premissas__grupo">
      <header className="premissas__cab">
        <h3>{titulo}</h3>
        {base && <p className="premissas__base">{base}</p>}
      </header>
      {children}
    </section>
  );
}

export default function Premissas({ p, setP, restaurar }) {
  const set = (k, v) => setP({ ...p, [k]: v });
  const setAno = (grupo, ano, v) => setP({ ...p, [grupo]: { ...p[grupo], [ano]: v } });
  const setPres = (ativ, k, v) => setP({ ...p, presuncao: { ...p.presuncao, [ativ]: { ...p.presuncao[ativ], [k]: v } } });
  const pres = (ativ) => (p.aliqIrpj / 100) * (p.presuncao[ativ].irpj / 100) + (p.aliqCsll / 100) * (p.presuncao[ativ].csll / 100);

  return (
    <div className="premissas">
      <div className="premissas__topo">
        <p className="premissas__intro">Valores padrão da especificação. Altere quando sair norma nova, como as alíquotas de referência do Senado.</p>
        <button type="button" className="btn btn--contorno" onClick={restaurar}>
          Restaurar padrão
        </button>
      </div>

      <Grupo titulo="Alíquotas-base" base={`${BASE_LEGAL.cbs} · ${BASE_LEGAL.icms}`}>
        <div className="premissas__linha">
          <CampoNumero rotulo="CBS (2027 em diante)" sufixo="%" valor={p.cbs} onChange={(v) => set('cbs', v)} compacto />
          <CampoNumero rotulo="CBS em 2026 (teste)" sufixo="%" valor={p.cbsTeste} onChange={(v) => set('cbsTeste', v)} compacto />
          <span />
          <CampoNumero rotulo="ICMS do produto" sufixo="%" valor={p.icmsProduto} onChange={(v) => set('icmsProduto', v)} compacto />
          <CampoNumero rotulo="ISS do serviço" sufixo="%" valor={p.issServico} onChange={(v) => set('issServico', v)} compacto />
        </div>
        <Chave
          rotulo="IBS/CBS na base do ICMS"
          valor={p.chaveIbsCbsNaBaseIcms}
          onChange={(v) => set('chaveIbsCbsNaBaseIcms', v)}
          dica="LC 87/1996, art. 13, §1º. Tema em disputa; o padrão é Não."
        />
      </Grupo>

      <Grupo titulo="Calendário da transição" base={`${BASE_LEGAL.icmsFator} · ADCT, arts. 127 e 130`}>
        <table className="tabela-prem">
          <thead>
            <tr>
              <th scope="col">Ano</th>
              <th scope="col">Fator ICMS/ISS</th>
              <th scope="col">ICMS do ano</th>
              <th scope="col">IBS</th>
              <th scope="col">Origem do IBS</th>
            </tr>
          </thead>
          <tbody>
            {ANOS.map((ano) => {
              const vazio = p.ibsAno[ano] === null || p.ibsAno[ano] === '';
              const t = taxasDoAno(p, ano);
              const padrao = taxasDoAno({ ...p, ibsAno: { ...p.ibsAno, [ano]: null } }, ano);
              const origem = !vazio ? 'Informado' : ano <= 2026 ? 'Teste' : padrao.ibsAuto ? 'Repõe ICMS/ISS' : ano >= 2033 ? 'Referência' : 'Padrão';
              return (
                <tr key={ano}>
                  <th scope="row">{ano}</th>
                  <td>
                    <CampoNumero valor={p.fatorIcms[ano]} onChange={(v) => setAno('fatorIcms', ano, v === '' ? 0 : v)} compacto />
                  </td>
                  <td className="tabela-prem__calc">{P(t.ic)}</td>
                  <td>
                    <CampoNumero
                      sufixo="%"
                      valor={vazio ? '' : p.ibsAno[ano]}
                      placeholder={P(padrao.ibs).replace('%', '')}
                      onChange={(v) => setAno('ibsAno', ano, v === '' ? null : v)}
                      compacto
                    />
                  </td>
                  <td className={`tabela-prem__origem ${!vazio ? 'tabela-prem__origem--editado' : ''}`}>{origem}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="premissas__nota">Campo do IBS vazio = valor padrão, em cinza. Digite um valor para sobrescrever. Em 2026, CBS e IBS são só destacados, sem cobrança. De 2029 a 2032, o padrão é a hipótese de que o IBS repõe o ICMS/ISS que saiu; o ISS cai com o mesmo fator do ICMS. Em 2033, a reposição é da arrecadação total, não produto a produto.</p>
      </Grupo>

      <Grupo titulo="Tributos atuais" base={`${BASE_LEGAL.pisCum} · ${BASE_LEGAL.presumido}`}>
        <div className="premissas__linha">
          <CampoNumero rotulo="PIS/Cofins cumulativo" sufixo="%" valor={p.pisCofinsCumulativo} onChange={(v) => set('pisCofinsCumulativo', v)} compacto />
          <CampoNumero rotulo="PIS/Cofins não cumulativo" sufixo="%" valor={p.pisCofinsNaoCumulativo} onChange={(v) => set('pisCofinsNaoCumulativo', v)} compacto />
          <CampoNumero rotulo="IRPJ/CSLL Lucro Real (LAIR)" sufixo="%" valor={p.irLucroReal} onChange={(v) => set('irLucroReal', v)} compacto />
        </div>
        <table className="tabela-prem">
          <thead>
            <tr>
              <th scope="col">Presumido</th>
              <th scope="col">Presunção IRPJ</th>
              <th scope="col">Presunção CSLL</th>
              <th scope="col">Sobre a receita</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Alíquota</th>
              <td>
                <CampoNumero sufixo="%" valor={p.aliqIrpj} onChange={(v) => set('aliqIrpj', v)} compacto />
              </td>
              <td>
                <CampoNumero sufixo="%" valor={p.aliqCsll} onChange={(v) => set('aliqCsll', v)} compacto />
              </td>
              <td className="tabela-prem__calc">—</td>
            </tr>
            {[
              ['comercio', 'Comércio'],
              ['servico', 'Serviço'],
            ].map(([ativ, nome]) => (
              <tr key={ativ}>
                <th scope="row">{nome}</th>
                <td>
                  <CampoNumero sufixo="%" valor={p.presuncao[ativ].irpj} onChange={(v) => setPres(ativ, 'irpj', v)} compacto />
                </td>
                <td>
                  <CampoNumero sufixo="%" valor={p.presuncao[ativ].csll} onChange={(v) => setPres(ativ, 'csll', v)} compacto />
                </td>
                <td className="tabela-prem__calc">{P(pres(ativ))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Grupo>

      <Grupo titulo="Simples Nacional" base={`${BASE_LEGAL.simples} · ${BASE_LEGAL.dasParcela}`}>
        <div className="premissas__linha">
          <CampoNumero rotulo="Parcela de IBS/CBS no DAS" sufixo="%" valor={p.parcelaIbsCbsNoDas} onChange={(v) => set('parcelaIbsCbsNoDas', v)} compacto />
          <CampoNumero rotulo="DAS estimado do fornecedor" sufixo="%" valor={p.dasFornecedor} onChange={(v) => set('dasFornecedor', v)} compacto />
        </div>
        <p className="premissas__nota">
          Quem compra de fornecedor do Simples não sabe o DAS dele. Por isso usamos uma estimativa. O impacto é pequeno: cada ponto de DAS muda o custo em cerca de 0,16%. A partir de 2027, o valor real vem destacado na nota do fornecedor.
        </p>
      </Grupo>

      <Grupo titulo="Custos/despesas fixos nos anos da Reforma">
        <Opcoes
          valor={p.fixosModo}
          onChange={(v) => set('fixosModo', v)}
          colunas={2}
          opcoes={[
            { valor: 'rs', nome: 'Manter o valor em R$ de hoje', sub: 'Aluguel e folha não mudam com a Reforma' },
            { valor: 'pct', nome: '% sobre o custo do ano', sub: 'Acompanha o custo da mercadoria' },
          ]}
        />
      </Grupo>

      <p className="premissas__nota">
        Fora do escopo desta versão: ICMS-ST, reduções de 30%, 60% e 100% do IBS/CBS, regimes específicos, Imposto Seletivo, adicional de IRPJ e ISS na transição.
      </p>
    </div>
  );
}
