const { 
  listarCartoesConfigurados: listarCartoesDB,
  salvarConfiguracaoCartao: salvarCartaoDB,
  atualizarCartaoConfigurado: atualizarCartaoDB,
  excluirCartaoConfigurado: excluirCartaoDB,
  contarLancamentosAssociadosCartao: contarLancamentosDB,
  buscarConfiguracaoCartao: buscarCartaoDB
} = require('../../databaseService');

async function listarCartoesConfigurados(userId) {
  try {
    return await listarCartoesDB(userId);
  } catch (error) {
    console.error('Erro ao listar cartões:', error);
    throw new Error('Erro ao buscar cartões configurados');
  }
}

async function salvarConfiguracaoCartao(userId, nomeCartao, diaVencimento, diaFechamento) {
  try {
    return await salvarCartaoDB(userId, nomeCartao, diaVencimento, diaFechamento);
  } catch (error) {
    console.error('Erro ao salvar cartão:', error);
    throw new Error('Erro ao salvar configuração do cartão');
  }
}

async function atualizarCartaoConfigurado(userId, nomeCartao, diaVencimento, diaFechamento) {
  try {
    return await atualizarCartaoDB(userId, nomeCartao, diaVencimento, diaFechamento);
  } catch (error) {
    console.error('Erro ao atualizar cartão:', error);
    throw new Error('Erro ao atualizar configuração do cartão');
  }
}

async function excluirCartaoConfigurado(userId, nomeCartao) {
  try {
    return await excluirCartaoDB(userId, nomeCartao);
  } catch (error) {
    console.error('Erro ao excluir cartão:', error);
    throw new Error('Erro ao excluir configuração do cartão');
  }
}

async function contarLancamentosAssociadosCartao(userId, nomeCartao) {
  try {
    return await contarLancamentosDB(userId, nomeCartao);
  } catch (error) {
    console.error('Erro ao contar lançamentos:', error);
    throw new Error('Erro ao contar lançamentos associados ao cartão');
  }
}

async function buscarConfiguracaoCartao(userId, nomeCartao) {
  try {
    return await buscarCartaoDB(userId, nomeCartao);
  } catch (error) {
    console.error('Erro ao buscar cartão:', error);
    throw new Error('Erro ao buscar configuração do cartão');
  }
}

module.exports = {
  listarCartoesConfigurados,
  salvarConfiguracaoCartao,
  atualizarCartaoConfigurado,
  excluirCartaoConfigurado,
  contarLancamentosAssociadosCartao,
  buscarConfiguracaoCartao
}; 