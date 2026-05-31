import { getMoedaCtx } from '../configs/userContext';

function formatarValor(valor: number | string | null | undefined, casasDecimais: number = 2): string {
  if (valor === null || valor === undefined) return '0.00';
  const valorNumerico = Number(valor);
  if (isNaN(valorNumerico)) return '0.00';
  return valorNumerico.toFixed(casasDecimais);
}

// Formata valor com o símbolo da moeda do contexto atual (ex: 'R$ 150,00' ou '€ 150,00').
function formatarComMoeda(valor: number | string | null | undefined, casasDecimais: number = 2): string {
  return `${getMoedaCtx()} ${formatarValor(valor, casasDecimais)}`;
}

export {
  formatarValor,
  formatarComMoeda,
};
