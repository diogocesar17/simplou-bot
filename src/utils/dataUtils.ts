const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

interface MesAno {
  mes: number;
  ano: number;
}

function parseMesAno(input: string | null | undefined): MesAno | null {
  if (!input) return null;
  input = input.trim().toLowerCase();
  input = input.replace(/^(resumo|do|de|deste|da|no|em)\s+/i, '');
  let mes: number | null = null, ano: number | null = null;
  const match = input.match(/^([0-9]{1,2})[\/\-\s]?(\d{2,4})?$/);
  if (match) {
    mes = parseInt(match[1]);
    ano = match[2] ? parseInt(match[2]) : (new Date()).getFullYear();
  } else {
    const partes = input.split(/[\s\/\-]+/);
    let nomeMes = partes[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('ç','c');
    let idx = meses.findIndex(m => m.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('ç','c') === nomeMes);
    if (idx === -1 && nomeMes === 'marco') idx = 2;
    if (idx === -1 && nomeMes === 'dezembro') idx = 11;
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

function getNomeMes(mes: number): string {
  const nomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return nomes[mes] || '';
}

/**
 * Converte data do formato brasileiro (DD/MM/YYYY) para formato ISO (YYYY-MM-DD)
 * @param dataBR - Data no formato brasileiro ou ISO
 * @returns Data no formato ISO ou null se inválida
 */
function converterDataParaISO(dataBR: string | null | undefined): string | null {
  if (!dataBR || typeof dataBR !== 'string') return null;
  
  // Se já está no formato ISO, retorna como está
  if (dataBR.includes('-') && dataBR.length === 10) return dataBR;
  
  // Se está no formato brasileiro DD/MM/YYYY, converte
  if (dataBR.includes('/')) {
    const partes = dataBR.split('/');
    if (partes.length === 3) {
      const dia = parseInt(partes[0]);
      const mes = parseInt(partes[1]);
      const ano = parseInt(partes[2]);
      
      // Validação básica
      if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 && ano >= 1900 && ano <= 2100) {
        return `${ano}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
      }
    }
  }
  
  return null;
}

export {
  parseMesAno,
  getNomeMes,
  converterDataParaISO,
  type MesAno
}; 