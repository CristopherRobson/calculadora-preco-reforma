import { CampoNumero, Opcoes, Selecao, Chave } from './componentes.jsx';
import { CLIENTES, FORNECEDORES } from '../engine/motor.js';

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
        {ent.regime === 'presumido' && (
          <Opcoes
            rotulo="Atividade"
            valor={ent.atividade}
            onChange={(v) => set('atividade', v)}
            colunas={2}
            opcoes={[
              { valor: 'comercio', nome: 'Comércio', sub: 'IRPJ/CSLL 2,28%' },
              { valor: 'servico', nome: 'Serviço', sub: 'IRPJ/CSLL 7,68%' },
            ]}
          />
        )}
        {ehSimples(ent.regime) ? (
          <CampoNumero id="das" rotulo="Alíquota efetiva do DAS" sufixo="%" valor={ent.das} onChange={(v) => set('das', v)} dica="Está no extrato do PGDAS-D. O ICMS já vem dentro do DAS." />
        ) : (
          <CampoNumero id="icms" rotulo="ICMS do produto (alíquota cheia)" sufixo="%" valor={premissas.icmsProduto} onChange={(v) => setPremissa('icmsProduto', v)} dica="Use 0 se o produto não tem ICMS." />
        )}
      </Passo>

      <Passo n={2} titulo="Sua compra">
        <CampoNumero id="compra" rotulo="Quanto você paga hoje na nota de compra?" prefixo="R$" valor={ent.valorCompra} onChange={(v) => set('valorCompra', v)} dica="Por unidade. Pode usar 100 para pensar em percentual." />
        <Selecao
          id="fornecedor"
          rotulo="Seu fornecedor é do"
          valor={ent.fornecedor}
          onChange={(v) => set('fornecedor', v)}
          opcoes={Object.entries(FORNECEDORES).map(([valor, nome]) => ({ valor, nome }))}
          dica="Se não souber, deixe Lucro Real (é o caso da maioria das indústrias e distribuidoras)."
        />
        {ehSimples(ent.fornecedor) && <CampoNumero id="dasforn" rotulo="DAS do fornecedor" sufixo="%" valor={ent.dasFornecedor} onChange={(v) => set('dasFornecedor', v)} compacto />}
        <Chave rotulo="É compra para uso e consumo pessoal" valor={ent.usoPessoal} onChange={(v) => set('usoPessoal', v)} dica="Nesse caso não há crédito de IBS/CBS." />
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
          <CampoNumero
            id="margem"
            rotulo={ent.regime === 'real' ? 'Margem de lucro líquida (depois do IR)' : 'Margem de lucro'}
            sufixo="%"
            valor={ent.margem}
            onChange={(v) => set('margem', v)}
            dica="Quanto sobra de lucro sobre o preço de venda."
          />
        ) : (
          <CampoNumero id="precohoje" rotulo="Preço de venda hoje" prefixo="R$" valor={ent.precoHoje} onChange={(v) => set('precoHoje', v)} dica="O valor da sua nota hoje. A calculadora descobre a margem." />
        )}
        <CampoNumero id="despesas" rotulo="Despesas operacionais" sufixo="%" valor={ent.despesas} onChange={(v) => set('despesas', v)} dica="Aluguel, folha, comissões etc., em % do faturamento." />
      </Passo>

      <Passo n={4} titulo="Para quem você vende">
        <Selecao id="cliente" rotulo="Seu cliente típico" valor={ent.cliente} onChange={(v) => set('cliente', v)} opcoes={Object.entries(CLIENTES).map(([valor, c]) => ({ valor, nome: c.nome }))} />
      </Passo>
    </form>
  );
}
