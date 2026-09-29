# Calculadora de preço pós-Reforma Tributária

Aplicação de página única (React + Vite), só frontend. Responde a uma pergunta: **qual preço praticar a partir de 2027 para não perder lucro**, com a memória de cálculo de cada número.

```bash
npm install
npm run dev     # desenvolvimento
npm test        # casos da seção 9 da especificação, ao centavo
npm run build   # gera dist/
```

Para publicar, rode `npm run deploy`: ele roda os testes, gera o build e envia para a branch `gh-pages`, que o GitHub Pages serve.

## Estrutura

- `src/engine/`: motor de cálculo puro e testado (`motor.js`, `premissas.js`, `numeros.js`, `motor.test.js`)
- `src/ui/`: formulário, premissas e telas de resultado
- `src/App.jsx`: montagem da página e relatório de impressão (Exportar PDF)

## Decisões tomadas com o usuário

1. **Lucro Real:** a margem informada é **depois** do IRPJ/CSLL. No divisor, ela entra como margem ÷ (1 − 34%), e a DRE mostra a provisão de 34% sobre o LAIR.
2. **Presumido:** opção entre comércio (8%/12% → 2,28%) e serviço (32%/32% → 7,68%). Os percentuais de presunção podem ser editados nas premissas.
3. **Simples:** o DAS é digitado (alíquota efetiva do PGDAS-D).
4. **Arredondamento:** CBS e IBS são arredondados separadamente, e a nota é preço + CBS + IBS (seção 5.8). Com isso, alguns esperados da especificação mudam 1 centavo:
   - T1, nota 2033: 216,80 → **216,79**
   - T2, Simples Híbrido: nota 107,95 → **107,96**; crédito 9,19 → **9,20** (custo real inalterado)
   - T3, Repassar: IBS/CBS 12,48 → **12,47**; nota 146,49 → **146,48**
   - T3, Manter lucro: IBS/CBS 12,94 → **12,95**; nota 151,98 → **151,99**

## Outras regras de implementação

- **Resposta principal:** a estratégia "Manter lucro" (mesmo lucro líquido em R$ de hoje) fica em destaque. As outras duas ficam lado a lado.
- **Manter a nota:** às vezes nenhum preço em centavos fecha a nota exatamente, porque a nota pula 2 centavos. Nesses casos, usa-se a nota mais próxima sem passar da de hoje, e a memória avisa.
- **Arredondamento na DRE:** as linhas são calculadas com o valor exato e exibidas a 2 casas. Quando a soma das linhas exibidas difere em 1 centavo, a memória sinaliza (ponto dourado).
- **Tipo de cliente:** consumidor final ou uso e consumo pessoal (não credita); empresa no regime regular de IBS/CBS, isto é, Lucro Real, Presumido ou Simples optante (credita); empresa do Simples não optante (não credita). Na comparação com hoje, o cliente regular aparece nas duas situações: sem crédito e, se for do Lucro Real, com crédito de PIS/Cofins.
- **Modo "Sei meu preço de venda":** a margem de hoje é deduzida do preço informado.

## Segunda rodada de ajustes

- **Valor da compra sem PIS/Cofins:** é o preço do fornecedor a partir de 2027. Para comparar com hoje, a nota atual é reconstruída: valor ÷ (1 − PIS/Cofins do fornecedor). Fornecedor do Simples: informa-se o valor da nota.
- **ICMS do fornecedor:** vira crédito para quem vende no Presumido ou no Real, na atividade de comércio. Na transição, o ICMS do fornecedor cai com o fator do ano e ele repassa (mantém o preço líquido); para quem credita, o custo fica estável.
- **DAS do fornecedor do Simples:** estimativa de 8% nos ajustes avançados. O comprador não sabe o DAS real; o impacto é de cerca de 0,16% do custo por ponto de DAS.
- **Simples Híbrido × Simples Nacional:** com repasse integral, os dois dão o mesmo custo. O Híbrido dá mais crédito, mas a nota sobe na mesma medida.
- **Serviço:** usa ISS no lugar do ICMS, com a mesma redução da transição (ADCT, art. 128). A chave "IBS/CBS na base do ICMS" não se aplica ao ISS.
- **2026:** ano de teste. CBS 0,9% e IBS 0,1% destacados só para informação; preço, nota e custo iguais aos de hoje.
- **Custos/despesas:** fixos em % do custo, somados ao custo (100 + 10% = 110); variáveis em % do preço, no divisor (110 ÷ 0,9 = 122,22). Nos anos da Reforma, os fixos mantêm o valor em R$ de hoje (padrão) ou acompanham o custo do ano (opção nos ajustes avançados).
