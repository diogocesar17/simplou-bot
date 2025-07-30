// Função para formatar valores de forma segura
function formatarValor(valor: number | string | null | undefined, casasDecimais: number = 2): string {
  if (valor === null || valor === undefined) return '0.00';
  const valorNumerico = Number(valor);
  if (isNaN(valorNumerico)) return '0.00';
  return valorNumerico.toFixed(casasDecimais);
}

export {
  formatarValor,
}; 