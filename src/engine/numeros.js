// Arredondamento e formatação no padrão brasileiro.

/** Arredonda a 2 casas, meio para cima (simétrico para negativos). */
export function r2(x) {
  if (!Number.isFinite(x)) return x;
  const sinal = x < 0 ? -1 : 1;
  // toPrecision elimina o ruído binário (ex.: 1,005 * 100 = 100,49999...)
  return (sinal * Math.round(Number((Math.abs(x) * 100).toPrecision(12)))) / 100;
}

const fmt2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt4 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

/** Valor em reais sem símbolo: 1234,5 → "1.234,50" */
export const R = (x) => fmt2.format(r2(x) + 0);
/** Valor em reais com símbolo */
export const RS = (x) => 'R$ ' + R(x);
/** Fração → percentual com 2 casas: 0,0931 → "9,31%" */
export const P = (f) => fmt2.format(r2(f * 100) + 0) + '%';
/** Número com 4 casas (divisor, multiplicador) */
export const N4 = (x) => fmt4.format(x);
