const { 
  gerarEstatisticasSistema: gerarEstatisticasDB,
  gerarLogAuditoria: gerarLogAuditoriaDB,
  limparDadosAntigos: limparDadosAntigosDB,
  gerarBackupCSV: gerarBackupCSVDB,
  queryDatabase: queryDatabaseDB,
  registrarLog: registrarLogDB,
  buscarLogsRecentes: buscarLogsRecentesDB
} = require('../../databaseService');

async function contarLancamentos() {
  try {
    const estatisticas = await gerarEstatisticasDB();
    return estatisticas.totalLancamentos || 0;
  } catch (error) {
    console.error('Erro ao contar lançamentos:', error);
    throw new Error('Erro ao contar lançamentos');
  }
}

async function gerarLogsAuditoria(limite = 100) {
  try {
    return await gerarLogAuditoriaDB(limite);
  } catch (error) {
    console.error('Erro ao gerar logs de auditoria:', error);
    throw new Error('Erro ao gerar logs de auditoria');
  }
}

async function limparDadosAntigos() {
  try {
    return await limparDadosAntigosDB();
  } catch (error) {
    console.error('Erro ao limpar dados antigos:', error);
    throw new Error('Erro ao limpar dados antigos');
  }
}

async function gerarEstatisticasSistema() {
  try {
    return await gerarEstatisticasDB();
  } catch (error) {
    console.error('Erro ao gerar estatísticas do sistema:', error);
    throw new Error('Erro ao gerar estatísticas do sistema');
  }
}

async function gerarBackupCSV(userId) {
  try {
    return await gerarBackupCSVDB(userId);
  } catch (error) {
    console.error('Erro ao gerar backup CSV:', error);
    throw new Error('Erro ao gerar backup CSV');
  }
}

async function registrarLog(userId, acao, detalhes = null) {
  try {
    return await registrarLogDB(userId, acao, detalhes);
  } catch (error) {
    console.error('Erro ao registrar log:', error);
    throw new Error('Erro ao registrar log');
  }
}

async function buscarLogsRecentes(limite = 10) {
  try {
    return await buscarLogsRecentesDB(limite);
  } catch (error) {
    console.error('Erro ao buscar logs recentes:', error);
    throw new Error('Erro ao buscar logs recentes');
  }
}

async function executarQuery(query, params = []) {
  try {
    return await queryDatabaseDB(query, params);
  } catch (error) {
    console.error('Erro ao executar query:', error);
    throw new Error('Erro ao executar query');
  }
}

module.exports = {
  contarLancamentos,
  gerarLogsAuditoria,
  limparDadosAntigos,
  gerarEstatisticasSistema,
  gerarBackupCSV,
  registrarLog,
  buscarLogsRecentes,
  executarQuery
}; 