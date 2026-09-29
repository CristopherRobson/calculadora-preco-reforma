import { CampoNumero, CampoUnidade, Opcoes, Selecao, Chave } from './componentes.jsx';
import { CLIENTES, FORNECEDORES, creditosDoComprador } from '../engine/motor.js';
import { taxasDoAno } from '../engine/premissas.js';
import { P } from '../engine/numeros.js';

const ehSimples = (r) => r === 'simples_unico' || r === 'simples_hibrido';

function Passo({ n, titulo, children }) {
  return (
    <section className="passo">
      <header className="passo__topo">
        <span className="passo__n">{String(n).padStart(2, '0')}</span>
        <h3>{titulo}</h3>
      </header>
      <div className="passo__corpo">{children}</div>
    </section>
  );
}

export default function Formulario({ ent, set, premissas, setPremissa }) {
  const regular = !ehSimples(ent.regime);
  const servico = regular && ent.atividade === 'servico';
  const cred = creditosDoComprador({ ...ent, atividade: regular ? ent.atividade : 'comercio' });
  const taxas = taxasDoAno(premissas, Number(ent.ano), regular ? ent.atividade : 'comercio');
  const fornSimples = ehSimples(ent.fornecedor);
  const dasF = premissas.dasFornecedor / 100;
  const parcela = premissas.parcelaIbsCbsNoDas / 100;

  return (
    <form className="formulario" onSubmit={(e) => e.preventDefault()}>
      <Passo n={1} titulo="Sua empresa">
        <Opcoes
          rotulo="Regime tributário"
          valor={ent.regime}
          onChange={(v) => set('regime', v)}
          colunas={2}
          opcoes={[
            { valor: 'presumido', nome: 'Lucro Presumido' },
            { valor: 'real', nome: 'Lucro Real' },
            { valor: 'simples_unico', nome: 'Simples Nacional' },
            { valor: 'simples_hibrido', nome: 'Simples Híbrido', sub: 'IBS/CBS por fora' },
          ]}
        />
        {regular && (
          <Opcoes
            rotulo="Atividade"
            valor={ent.atividade}
            onChange={(v) => set('atividade', v)}
            colunas={2}
            opcoes={[
              { valor: 'comercio', nome: 'Comércio', sub: ent.regime === 'presumido' ? 'ICMS · IRPJ/CSLL 2,28%' : 'ICMS' },
              { valor: 'servico', nome: 'Serviço', sub: ent.regime === 'presumido' ? 'ISS · IRPJ/CSLL 7,68%' : 'ISS' },
            ]}
          />
        )}
        {!regular ? (
          <CampoNumero
            id="das"
            rotulo={ent.regime === 'simples_hibrido' ? 'Alíquota efetiva do DAS (já sem IBS/CBS)' : 'Alíquota efetiva do DAS'}
            sufixo="%"
            valor={ent.das}
            onChange={(v) => set('das', v)}
            dica={
              ent.regime === 'simples_hibrido'
                ? 'A carga do DAS no híbrido, já sem a parcela de IBS/CBS. ICMS e ISS vêm dentro do DAS.'
                : 'Está no extrato do PGDAS-D. ICMS e ISS já vêm dentro do DAS.'
            }
          />
        ) : servico ? (
          <CampoNumero id="iss" rotulo="ISS do serviço" sufixo="%" valor={premissas.issServico} onChange={(v) => setPremissa('issServico', v)} dica="Alíquota do município (de 2% a 5%)." />
        ) : (
          <CampoNumero id="icms" rotulo="ICMS do produto (alíquota cheia)" sufixo="%" valor={premissas.icmsProduto} onChange={(v) => setPremissa('icmsProduto', v)} dica="Use 0 se o produto não tem ICMS." />
        )}
      </Passo>

      <Passo n={2} titulo="Sua compra">
        <Selecao
          id="fornecedor"
          rotulo="Seu fornecedor é do"
          valor={ent.fornecedor}
          onChange={(v) => set('fornecedor', v)}
          opcoes={Object.entries(FORNECEDORES).map(([valor, nome]) => ({ valor, nome }))}
          dica="Na dúvida, Lucro Real (maioria das indústrias e distribuidoras)."
        />
        <CampoNumero id="compra" rotulo="Valor da nota fiscal de compra" prefixo="R$" valor={ent.valorCompra} onChange={(v) => set('valorCompra', v)} dica="Valor total da nota, por unidade." />
        {!fornSimples && (
          <CampoUnidade
            id="icmsforn"
            rotulo="ICMS destacado na nota"
            unidade={ent.icmsModo}
            onUnidade={(v) => set('icmsModo', v)}
            valor={ent.icmsFornecedor}
            onChange={(v) => set('icmsFornecedor', v)}
            dica={
              cred.icms
                ? ent.icmsModo === 'pct'
                  ? 'Alíquota cheia; nos anos da transição a calculadora aplica a redução. Vira crédito e sai do custo.'
                  : 'Vira crédito e sai do custo.'
                : 'Sua empresa não credita ICMS (serviço ou Simples): ele fica no custo.'
            }
          />
        )}
        {!taxas.teste && !fornSimples ? (
          ent.fornecedor === 'simples_unico' ? null : (
            <CampoUnidade
              id="ibscbsforn"
              rotulo="IBS e CBS destacados na nota"
              unidade={ent.ibsCbsModo}
              onUnidade={(v) => set('ibsCbsModo', v)}
              valor={ent.ibsCbsCompra}
              onChange={(v) => set('ibsCbsCompra', v)}
              placeholder={ent.ibsCbsModo === 'pct' ? P(taxas.a).replace('%', '') : ''}
              dica={
                cred.ibs
                  ? `Crédito integral: sai do custo. Vazio = alíquota de ${taxas.ano} (${P(taxas.a)}) sobre a nota.`
                  : 'Sua empresa não toma crédito de IBS/CBS: ele fica no custo.'
              }
            />
          )
        ) : null}
        {!taxas.teste && ent.fornecedor === 'simples_hibrido' && (
          <CampoUnidade
            id="ibscbsforn"
            rotulo="IBS e CBS destacados na nota"
            unidade={ent.ibsCbsModo}
            onUnidade={(v) => set('ibsCbsModo', v)}
            valor={ent.ibsCbsCompra}
            onChange={(v) => set('ibsCbsCompra', v)}
            placeholder={ent.ibsCbsModo === 'pct' ? P(taxas.a).replace('%', '') : ''}
            dica={cred.ibs ? `Híbrido: crédito integral do IBS/CBS destacado. Vazio = alíquota de ${taxas.ano} (${P(taxas.a)}) sobre a nota.` : 'Sua empresa não toma crédito de IBS/CBS.'}
          />
        )}
        {!taxas.teste && ent.fornecedor === 'simples_unico' && (
          <p className="campo__info">
            {cred.ibs
              ? `Fornecedor do Simples Nacional: crédito de ${P(dasF * parcela)} da nota (DAS estimado de ${P(dasF)} × ${P(parcela)}). Ajuste o DAS em Ajustes avançados.`
              : 'Sua empresa não toma crédito de IBS/CBS.'}
          </p>
        )}
        <Chave rotulo="É compra para uso e consumo pessoal" valor={ent.usoPessoal} onChange={(v) => set('usoPessoal', v)} dica="Nesse caso não há crédito de nenhum tributo." />
      </Passo>

      <Passo n={3} titulo="Seu preço hoje">
        <Opcoes
          valor={ent.modo}
          onChange={(v) => set('modo', v)}
          colunas={2}
          opcoes={[
            { valor: 'margem', nome: 'Sei minha margem' },
            { valor: 'preco', nome: 'Sei meu preço de venda' },
          ]}
        />
        {ent.modo === 'margem' ? (
          <CampoNumero id="margem" rotulo={ent.regime === 'real' ? 'Margem de lucro líquida (depois do IR)' : 'Margem de lucro'} sufixo="%" valor={ent.margem} onChange={(v) => set('margem', v)} />
        ) : (
          <CampoNumero id="precohoje" rotulo="Preço de venda hoje" prefixo="R$" valor={ent.precoHoje} onChange={(v) => set('precoHoje', v)} dica="A calculadora descobre a margem." />
        )}
        <CampoNumero
          id="fixos"
          rotulo="Custos/despesas fixos"
          sufixo="% do custo"
          valor={ent.despesasFixas}
          onChange={(v) => set('despesasFixas', v)}
          dica="Aluguel, folha, administrativo. Somados ao custo: 100 + 10% = 110."
        />
        <CampoNumero
          id="variaveis"
          rotulo="Custos/despesas variáveis"
          sufixo="% do preço"
          valor={ent.despesasVar}
          onChange={(v) => set('despesasVar', v)}
          dica="Comissão, taxa de cartão, frete. Embutidos no preço: 110 ÷ (1 − 10%)."
        />
      </Passo>

      <Passo n={4} titulo="Para quem você vende">
        <Opcoes
          rotulo="Seu cliente típico"
          valor={ent.cliente}
          onChange={(v) => set('cliente', v)}
          colunas={1}
          opcoes={Object.entries(CLIENTES).map(([valor, c]) => ({ valor, nome: c.nome }))}
          dica={CLIENTES[ent.cliente]?.dica}
        />
      </Passo>
    </form>
  );
}
