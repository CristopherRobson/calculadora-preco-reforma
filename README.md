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
- **Modo "Sei meu preço de venda":** a margem de hoje é deduzida do preço informado.
