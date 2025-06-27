const meses = ['janeiro','fevereiro','março','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function parseMesAno(input) {
  if (!input) return null;
  input = input.trim().toLowerCase();
  let mes = null, ano = null;
  const match = input.match(/^(\d{1,2})[\/\-\s]?(\d{2,4})?$/);
  if (match) {
    mes = parseInt(match[1]);
    ano = match[2] ? parseInt(match[2]) : (new Date()).getFullYear();
  } else {
    const partes = input.split(/\s+/);
    let nomeMes = partes[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('ç','c');
    let idx = meses.findIndex(m => m.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('ç','c') === nomeMes);
    if (idx === -1 && nomeMes === 'marco') idx = 2; // Aceita 'marco' como 'março'
    if (idx !== -1) {
      mes = idx + 1;
      ano = partes[1] ? parseInt(partes[1]) : (new Date()).getFullYear();
    }
  }
  if (mes && mes >= 1 && mes <= 12) {
    if (!ano || ano < 100) ano = 2000 + (ano || 0);
    return { mes, ano };
  }
  return null;
}

console.log('maio:', parseMesAno('maio'));
console.log('fevereiro:', parseMesAno('fevereiro'));
console.log('junho:', parseMesAno('junho'));
console.log('março:', parseMesAno('março'));
console.log('marco:', parseMesAno('marco'));
console.log('dezembro 2024:', parseMesAno('dezembro 2024'));
console.log('01/2025:', parseMesAno('01/2025'));
console.log('dezembro:', parseMesAno('dezembro')); 