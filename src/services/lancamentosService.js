const { 
  getResumoDoDia: getResumoDoDiaDB,
  getResumoDoMesAtual: getResumoDoMesAtualDB,
  getResumoPorMes: getResumoPorMesDB,
  listarLancamentos: listarLancamentosDB,
  buscarFaturaCartao: buscarFaturaCartaoDB,
  buscarGastosPorCategoria: buscarGastosPorCategoriaDB,
  buscarGastosValorAlto: buscarGastosValorAltoDB,
  buscarParceladosAtivos: buscarParceladosAtivosDB,
  buscarRecorrentesAtivos: buscarRecorrentesAtivosDB,
  buscarProximosVencimentos: buscarProximosVencimentosDB,
  excluirLancamentoPorId: excluirLancamentoPorIdDB,
  getDatabaseData: getDatabaseDataDB,
  appendRowToDatabase: appendRowToDatabaseDB,
  getLancamentoPorId: getLancamentoPorIdDB,
  atualizarLancamentoPorId: atualizarLancamentoPorIdDB
} = require('../../databaseService');

const { converterDataParaISO } = require('../utils/dataUtils');

async function getResumoDoDia(userId) {
  try {
    return await getResumoDoDiaDB(userId);
  } catch (error) {
    console.error('Erro ao buscar resumo do dia:', error);
    throw new Error('Erro ao buscar resumo do dia');
  }
}

async function getResumoDoMesAtual(userId) {
  try {
    return await getResumoDoMesAtualDB(userId);
  } catch (error) {
    console.error('Erro ao buscar resumo do mês atual:', error);
    throw new Error('Erro ao buscar resumo do mês atual');
  }
}

async function getResumoPorMes(userId, mes, ano) {
  try {
    return await getResumoPorMesDB(userId, mes, ano);
  } catch (error) {
    console.error('Erro ao buscar resumo por mês:', error);
    throw new Error('Erro ao buscar resumo por mês');
  }
}

async function listarLancamentos(userId, limite = 10, mes = null, ano = null) {
  try {
    return await listarLancamentosDB(userId, limite, mes, ano);
  } catch (error) {
    console.error('Erro ao listar lançamentos:', error);
    throw new Error('Erro ao listar lançamentos');
  }
}

async function buscarFaturaCartao(userId, nomeCartao, mes, ano) {
  try {
    return await buscarFaturaCartaoDB(userId, nomeCartao, mes, ano);
  } catch (error) {
    console.error('Erro ao buscar fatura do cartão:', error);
    throw new Error('Erro ao buscar fatura do cartão');
  }
}

async function buscarGastosPorCategoria(userId, categoria, limite = 20, mes = null, ano = null) {
  try {
    return await buscarGastosPorCategoriaDB(userId, categoria, limite, mes, ano);
  } catch (error) {
    console.error('Erro ao buscar gastos por categoria:', error);
    throw new Error('Erro ao buscar gastos por categoria');
  }
}

async function buscarGastosValorAlto(userId, valorMinimo = 100, limite = 20, mes = null, ano = null) {
  try {
    return await buscarGastosValorAltoDB(userId, valorMinimo, limite, mes, ano);
  } catch (error) {
    console.error('Erro ao buscar gastos de valor alto:', error);
    throw new Error('Erro ao buscar gastos de valor alto');
  }
}

async function buscarParceladosAtivos(userId, limite = 20) {
  try {
    return await buscarParceladosAtivosDB(userId, limite);
  } catch (error) {
    console.error('Erro ao buscar parcelados ativos:', error);
    throw new Error('Erro ao buscar parcelados ativos');
  }
}

async function buscarRecorrentesAtivos(userId, limite = 20) {
  try {
    return await buscarRecorrentesAtivosDB(userId, limite);
  } catch (error) {
    console.error('Erro ao buscar recorrentes ativos:', error);
    throw new Error('Erro ao buscar recorrentes ativos');
  }
}

async function buscarProximosVencimentos(userId, dias = 30) {
  try {
    return await buscarProximosVencimentosDB(userId, dias);
  } catch (error) {
    console.error('Erro ao buscar próximos vencimentos:', error);
    throw new Error('Erro ao buscar próximos vencimentos');
  }
}

async function excluirLancamentoPorId(userId, id) {
  try {
    return await excluirLancamentoPorIdDB(userId, id);
  } catch (error) {
    console.error('Erro ao excluir lançamento:', error);
    throw new Error('Erro ao excluir lançamento');
  }
}

async function buscarDadosParaSugestoes(userId, meses = 2) {
  try {
    // Buscar dados dos últimos X meses para análise de sugestões
    const dataInicio = new Date();
    dataInicio.setMonth(dataInicio.getMonth() - meses);
    
    const dados = await getDatabaseDataDB(userId);
    return dados.filter(lancamento => {
      const dataLancamento = new Date(lancamento.data);
      return dataLancamento >= dataInicio;
    });
  } catch (error) {
    console.error('Erro ao buscar dados para sugestões:', error);
    throw new Error('Erro ao buscar dados para sugestões');
  }
}

async function buscarDadosParaPrevisao(userId, meses = 6) {
  try {
    // Buscar dados dos últimos X meses para previsão
    const dataInicio = new Date();
    dataInicio.setMonth(dataInicio.getMonth() - meses);
    
    const dados = await getDatabaseDataDB(userId);
    return dados.filter(lancamento => {
      const dataLancamento = new Date(lancamento.data);
      return dataLancamento >= dataInicio;
    });
  } catch (error) {
    console.error('Erro ao buscar dados para previsão:', error);
    throw new Error('Erro ao buscar dados para previsão');
  }
}

async function buscarDadosParaAnalise(userId, meses = 3) {
  try {
    // Buscar dados dos últimos X meses para análise de padrões
    const dataInicio = new Date();
    dataInicio.setMonth(dataInicio.getMonth() - meses);
    
    const dados = await getDatabaseDataDB(userId);
    return dados.filter(lancamento => {
      const dataLancamento = new Date(lancamento.data);
      return dataLancamento >= dataInicio;
    });
  } catch (error) {
    console.error('Erro ao buscar dados para análise:', error);
    throw new Error('Erro ao buscar dados para análise');
  }
}

// Funções adicionais para operações CRUD
async function salvarLancamento(userId, dados) {
  try {
    // Converter data de vencimento para formato ISO se estiver no formato brasileiro
    const dataVencimento = converterDataParaISO(dados.data_vencimento);
    
    // Converter objeto para array na ordem correta do appendRowToDatabase
    const values = [
      dados.data,                    // $2 - data
      dados.tipo,                    // $3 - tipo
      dados.descricao,               // $4 - descricao
      dados.valor,                   // $5 - valor
      dados.categoria,               // $6 - categoria
      dados.pagamento,               // $7 - pagamento
      dados.parcelamento_id || null, // $8 - parcelamento_id
      dados.parcela_atual || null,   // $9 - parcela_atual
      dados.total_parcelas || null,  // $10 - total_parcelas
      dados.recorrente || null,      // $11 - recorrente
      dados.recorrente_fim || null,  // $12 - recorrente_fim
      dados.recorrente_id || null,   // $13 - recorrente_id
      dados.cartao_nome || null,     // $14 - cartao_nome
      dados.data_lancamento || null, // $15 - data_lancamento
      dados.data_contabilizacao || null, // $16 - data_contabilizacao
      dados.mes_fatura || null,      // $17 - mes_fatura
      dados.ano_fatura || null,      // $18 - ano_fatura
      dados.dia_vencimento || null,  // $19 - dia_vencimento
      dados.status_fatura || null,   // $20 - status_fatura
      dataVencimento                 // $21 - data_vencimento (convertida)
    ];
    
    return await appendRowToDatabaseDB(userId, values);
  } catch (error) {
    console.error('Erro ao salvar lançamento:', error);
    throw new Error('Erro ao salvar lançamento');
  }
}

async function buscarLancamentoPorId(userId, id) {
  try {
    return await getLancamentoPorIdDB(userId, id);
  } catch (error) {
    console.error('Erro ao buscar lançamento por ID:', error);
    throw new Error('Erro ao buscar lançamento');
  }
}

async function atualizarLancamento(userId, id, novosDados) {
  try {
    return await atualizarLancamentoPorIdDB(userId, id, novosDados);
  } catch (error) {
    console.error('Erro ao atualizar lançamento:', error);
    throw new Error('Erro ao atualizar lançamento');
  }
}

module.exports = {
  getResumoDoDia,
  getResumoDoMesAtual,
  getResumoPorMes,
  listarLancamentos,
  buscarFaturaCartao,
  buscarGastosPorCategoria,
  buscarGastosValorAlto,
  buscarParceladosAtivos,
  buscarRecorrentesAtivos,
  buscarProximosVencimentos,
  excluirLancamentoPorId,
  buscarDadosParaSugestoes,
  buscarDadosParaPrevisao,
  buscarDadosParaAnalise,
  salvarLancamento,
  buscarLancamentoPorId,
  atualizarLancamento
}; 