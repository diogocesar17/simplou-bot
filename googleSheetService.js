const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

const credentials = process.env.GOOGLE_SERVICE_CREDENTIALS
  ? JSON.parse(process.env.GOOGLE_SERVICE_CREDENTIALS)
  : require('./credentials/google-service-account.json');

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function appendRowToSheet(values) {
  const id = uuidv4();
  const row = [id, ...values];
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET_ID,
    range: 'Gastos!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [row],
    },
  });
}

async function getSheetData() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: 'Gastos!A2:G',
  });

  return res.data.values || [];
}

function isSameMonth(dateString) {
  try {
  const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Tenta diferentes formatos de data
    let data;
    if (dateString.includes('/')) {
      // Formato brasileiro: DD/MM/YYYY
      const parts = dateString.split('/');
      if (parts.length === 3) {
        data = new Date(parts[2], parts[1] - 1, parts[0]);
      }
    } else {
      // Tenta formato ISO ou outros
      data = new Date(dateString);
    }
    
    if (isNaN(data.getTime())) {
      return false;
    }
    
    return data.getMonth() === currentMonth && data.getFullYear() === currentYear;
  } catch (error) {
    return false;
  }
}

async function getResumoDoMesAtual() {
  const linhas = await getSheetData();

  let totalReceitas = 0;
  let totalDespesas = 0;
  let total = 0;

  for (const linha of linhas) {
    const [id, data, tipo, descricao, valorStr, categoria, pagamento] = linha;
    if (!data || !valorStr || !tipo) continue;

    if (isSameMonth(data)) {
      const valor = parseFloat(valorStr.toString().replace(',', '.'));
      if (isNaN(valor)) continue;
      
      const tipoLower = tipo.toLowerCase();
      if (tipoLower === 'receita') {
        totalReceitas += valor;
      } else if (tipoLower === 'gasto') {
        totalDespesas += valor;
      }

      total++;
    }
  }

  const saldo = totalReceitas - totalDespesas;

  return {
    totalReceitas,
    totalDespesas,
    saldo,
    totalLancamentos: total,
  };
}

function parseMonthYear(input) {
  console.log('DEBUG: [parseMonthYear] Entrada recebida:', input);
  const meses = {
    'janeiro': 0, 'jan': 0, '1': 0,
    'fevereiro': 1, 'fev': 1, '2': 1,
    'marco': 2, 'março': 2, 'mar': 2, '3': 2,
    'abril': 3, 'abr': 3, '4': 3,
    'maio': 4, '5': 4,
    'junho': 5, 'jun': 5, '6': 5,
    'julho': 6, 'jul': 6, '7': 6,
    'agosto': 7, 'ago': 7, '8': 7,
    'setembro': 8, 'set': 8, '9': 8,
    'outubro': 9, 'out': 9, '10': 9,
    'novembro': 10, 'nov': 10, '11': 10,
    'dezembro': 11, 'dez': 11, '12': 11
  };
  const inputLower = input.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('ç','c');
  console.log('DEBUG: [parseMonthYear] Entrada normalizada:', inputLower);
  // Padrões: "janeiro 2024", "jan 2024", "1 2024", "2024"
  const patterns = [
    /^(\w+)\s+(\d{4})$/, // "janeiro 2024"
    /^(\d{1,2})\s+(\d{4})$/, // "1 2024"
    /^(\d{4})$/, // "2024" (ano completo)
    /^(\w+)$/, // "janeiro" (mês do ano atual)
    /^(\d{1,2})$/, // "1" (mês do ano atual)
  ];

  for (const pattern of patterns) {
    const match = inputLower.match(pattern);
    console.log('DEBUG: [parseMonthYear] Testando pattern:', pattern, 'Match:', match);
    if (match) {
      const now = new Date();
      let mes, ano;

      if (pattern.source === /^(\d{4})$/.source) {
        // Apenas ano: "2024"
        mes = now.getMonth(); // Mês atual
        ano = parseInt(match[1]);
      } else if (pattern.source === /^(\w+)$/.source || pattern.source === /^(\d{1,2})$/.source) {
        // Apenas mês: "janeiro" ou "1"
        const mesInput = match[1];
        if (meses.hasOwnProperty(mesInput)) {
          mes = meses[mesInput];
          ano = now.getFullYear();
        } else {
          return null;
        }
      } else {
        // Mês e ano: "janeiro 2024"
        const mesInput = match[1];
        if (meses.hasOwnProperty(mesInput)) {
          mes = meses[mesInput];
          ano = parseInt(match[2]);
        } else {
          return null;
        }
      }

      console.log('DEBUG: [parseMonthYear] Resultado final:', { mes, ano });
      return { mes, ano };
    }
  }

  console.log('DEBUG: [parseMonthYear] Nenhum padrão bateu, retornando null');
  return null;
}

function isSameMonthYear(dateString, targetMonth, targetYear) {
  try {
    // Tenta diferentes formatos de data
    let data;
    if (dateString.includes('/')) {
      // Formato brasileiro: DD/MM/YYYY
      const parts = dateString.split('/');
      if (parts.length === 3) {
        data = new Date(parts[2], parts[1] - 1, parts[0]);
      }
    } else {
      // Tenta formato ISO ou outros
      data = new Date(dateString);
    }
    
    if (isNaN(data.getTime())) {
      return false;
    }
    
    return data.getMonth() === targetMonth && data.getFullYear() === targetYear;
  } catch (error) {
    return false;
  }
}

async function getResumoPorMes(mesInput) {
  const parsed = parseMonthYear(mesInput);
  if (!parsed) {
    return { error: 'Formato inválido. Use: "janeiro 2024", "jan 2024", "1 2024" ou "2024"' };
  }

  const { mes, ano } = parsed;
  const linhas = await getSheetData();

  let totalReceitas = 0;
  let totalDespesas = 0;
  let total = 0;

  for (const linha of linhas) {
    const [id, data, tipo, descricao, valorStr, categoria, pagamento] = linha;
    if (!data || !valorStr || !tipo) continue;

    if (isSameMonthYear(data, mes, ano)) {
      const valor = parseFloat(valorStr.toString().replace(',', '.'));
      if (isNaN(valor)) continue;
      
      const tipoLower = tipo.toLowerCase();
      if (tipoLower === 'receita') {
        totalReceitas += valor;
      } else if (tipoLower === 'gasto') {
        totalDespesas += valor;
      }

      total++;
    }
  }

  const saldo = totalReceitas - totalDespesas;
  const nomesMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return {
    mes: nomesMeses[mes],
    ano,
    totalReceitas,
    totalDespesas,
    saldo,
    totalLancamentos: total,
  };
}

async function getGastosPorCategoria(mesInput = null) {
  const linhas = await getSheetData();
  const categorias = {};
  let totalGeral = 0;
  let totalLancamentos = 0;

  // Se mesInput for fornecido, filtra por mês específico
  let filtroMes = null;
  if (mesInput) {
    const parsed = parseMonthYear(mesInput);
    if (parsed) {
      filtroMes = parsed;
    }
  }

  for (const linha of linhas) {
    const [id, data, tipo, descricao, valorStr, categoria, pagamento] = linha;
    if (!data || !valorStr || !tipo || !categoria) continue;

    // Filtra por mês se especificado
    if (filtroMes) {
      if (!isSameMonthYear(data, filtroMes.mes, filtroMes.ano)) continue;
    }

    const valor = parseFloat(valorStr.toString().replace(',', '.'));
    if (isNaN(valor)) continue;

    const tipoLower = tipo.toLowerCase();
    if (tipoLower === 'gasto') {
      if (!categorias[categoria]) {
        categorias[categoria] = {
          total: 0,
          lancamentos: 0,
          media: 0
        };
      }

      categorias[categoria].total += valor;
      categorias[categoria].lancamentos += 1;
      totalGeral += valor;
      totalLancamentos += 1;
    }
  }

  // Calcula médias e ordena por valor total
  for (const categoria in categorias) {
    categorias[categoria].media = categorias[categoria].total / categorias[categoria].lancamentos;
  }

  // Converte para array e ordena por valor total (decrescente)
  const categoriasArray = Object.entries(categorias)
    .map(([nome, dados]) => ({
      nome,
      total: dados.total,
      lancamentos: dados.lancamentos,
      media: dados.media
    }))
    .sort((a, b) => b.total - a.total);

  return {
    categorias: categoriasArray,
    totalGeral,
    totalLancamentos,
    periodo: filtroMes ? `${getNomeMes(filtroMes.mes)}/${filtroMes.ano}` : 'Todos os períodos'
  };
}

async function getGastosCategoriaEspecifica(categoria, mesInput = null) {
  const linhas = await getSheetData();
  const gastos = [];
  let totalCategoria = 0;
  let totalLancamentos = 0;

  // Se mesInput for fornecido, filtra por mês específico
  let filtroMes = null;
  if (mesInput) {
    const parsed = parseMonthYear(mesInput);
    if (parsed) {
      filtroMes = parsed;
    }
  }

  for (const linha of linhas) {
    const [id, data, tipo, descricao, valorStr, categoriaLinha, pagamento] = linha;
    if (!data || !valorStr || !tipo || !categoriaLinha) continue;

    // Filtra por categoria
    if (categoriaLinha.toLowerCase() !== categoria.toLowerCase()) continue;

    // Filtra por mês se especificado
    if (filtroMes) {
      if (!isSameMonthYear(data, filtroMes.mes, filtroMes.ano)) continue;
    }

    const valor = parseFloat(valorStr.toString().replace(',', '.'));
    if (isNaN(valor)) continue;

    const tipoLower = tipo.toLowerCase();
    if (tipoLower === 'gasto') {
      gastos.push({
        id,
        data,
        descricao,
        valor,
        pagamento
      });
      totalCategoria += valor;
      totalLancamentos += 1;
    }
  }

  // Ordena por valor (decrescente)
  gastos.sort((a, b) => b.valor - a.valor);

  return {
    categoria,
    gastos: gastos.slice(0, 10), // Top 10 maiores gastos
    totalCategoria,
    totalLancamentos,
    media: totalLancamentos > 0 ? totalCategoria / totalLancamentos : 0,
    periodo: filtroMes ? `${getNomeMes(filtroMes.mes)}/${filtroMes.ano}` : 'Todos os períodos'
  };
}

function getNomeMes(mes) {
  const nomesMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return nomesMeses[mes];
}

async function getUltimoLancamento() {
  const linhas = await getSheetData();
  
  if (linhas.length === 0) {
    return null;
  }
  
  const ultimaLinha = linhas[linhas.length - 1];
  const [id, data, tipo, descricao, valorStr, categoria, pagamento] = ultimaLinha;
  
  return {
    id,
    data,
    tipo,
    descricao,
    valor: parseFloat(valorStr.toString().replace(',', '.')),
    categoria,
    pagamento,
    linhaIndex: linhas.length // Para referência
  };
}

async function atualizarUltimoLancamento(novosDados) {
  const linhas = await getSheetData();
  
  if (linhas.length === 0) {
    throw new Error('Nenhum lançamento encontrado para editar');
  }
  
  const linhaIndex = linhas.length; // Última linha (base 1)
  const range = `Gastos!A${linhaIndex}:F${linhaIndex}`;
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        novosDados.id,
        novosDados.data,
        novosDados.tipo,
        novosDados.descricao,
        novosDados.valor,
        novosDados.categoria,
        novosDados.pagamento
      ]]
    }
  });
  
  return true;
}

async function getUltimosLancamentos(n = 5) {
  const linhas = await getSheetData();
  if (linhas.length === 0) return [];
  const ultimas = linhas.slice(-n);
  return ultimas.map(linha => {
    const [id, data, tipo, descricao, valorStr, categoria, pagamento] = linha;
    return {
      id,
      data,
      tipo,
      descricao,
      valor: parseFloat(valorStr.toString().replace(',', '.')),
      categoria,
      pagamento
    };
  });
}

async function excluirLancamentoPorIndice(indice) {
  const linhas = await getSheetData();
  if (indice < 1 || indice > linhas.length) {
    throw new Error('Índice inválido para exclusão');
  }
  // Remove o lançamento
  linhas.splice(indice - 1, 1);
  // Reescreve a planilha (sobrescreve tudo)
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SHEET_ID,
    range: 'Gastos!A2',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: linhas
    }
  });
  return true;
}

// Buscar lançamento por ID
async function getLancamentoPorId(id) {
  const linhas = await getSheetData();
  for (const linha of linhas) {
    if (linha[0] === id) {
      const [id, data, tipo, descricao, valorStr, categoria, pagamento] = linha;
      return {
        id, data, tipo, descricao, valor: parseFloat(valorStr.toString().replace(',', '.')), categoria, pagamento
      };
    }
  }
  return null;
}

// Atualizar lançamento por ID
async function atualizarLancamentoPorId(id, novosDados) {
  const linhas = await getSheetData();
  const idx = linhas.findIndex(linha => linha[0] === id);
  if (idx === -1) throw new Error('Lançamento não encontrado');
  linhas[idx] = [id, novosDados.data, novosDados.tipo, novosDados.descricao, novosDados.valor, novosDados.categoria, novosDados.pagamento];
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SHEET_ID,
    range: 'Gastos!A2',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: linhas }
  });
  return true;
}

// Excluir lançamento por ID
async function excluirLancamentoPorId(id) {
  const linhas = await getSheetData();
  const idx = linhas.findIndex(linha => linha[0] === id);
  if (idx === -1) throw new Error('Lançamento não encontrado');
  linhas.splice(idx, 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SHEET_ID,
    range: 'Gastos!A2',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: linhas }
  });
  return true;
}

module.exports = {
  appendRowToSheet,
  getSheetData,
  getResumoDoMesAtual,
  getResumoPorMes,
  getGastosPorCategoria,
  getGastosCategoriaEspecifica,
  getUltimoLancamento,
  atualizarUltimoLancamento,
  getUltimosLancamentos,
  excluirLancamentoPorIndice,
  getLancamentoPorId,
  atualizarLancamentoPorId,
  excluirLancamentoPorId,
  parseMonthYear,
  getNomeMes,
};