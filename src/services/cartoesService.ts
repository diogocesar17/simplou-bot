import * as databaseService from '../../databaseService';

// TODO: Tipar corretamente. Usar any onde necessário.

// Funções para configurar cartões
export async function salvarConfiguracaoCartao(userId: string, nomeCartao: string, diaVencimento: number, diaFechamento: null | undefined = null): Promise<any> {
  return await databaseService.salvarConfiguracaoCartao(userId, nomeCartao, diaVencimento, diaFechamento);
}

export async function buscarConfiguracaoCartao(userId: string, nomeCartao: string): Promise<any> {
  return await databaseService.buscarConfiguracaoCartao(userId, nomeCartao);
}

export async function listarCartoesConfigurados(userId: string): Promise<any[]> {
  return await databaseService.listarCartoesConfigurados(userId);
}

export async function excluirCartaoConfigurado(userId: string, nomeCartao: string): Promise<any> {
  return await databaseService.excluirCartaoConfigurado(userId, nomeCartao);
}

export async function contarLancamentosAssociadosCartao(userId: string, nomeCartao: string): Promise<number> {
  return await databaseService.contarLancamentosAssociadosCartao(userId, nomeCartao);
}

// Funções para calcular datas de contabilização
export async function calcularDataContabilizacao(
  dataLancamento: string,
  diaVencimento: number,
  diaFechamento?: number | null
): Promise<any> {
  // Quando não há fechamento, usar assinatura com 2 argumentos
  if (diaFechamento === null || diaFechamento === undefined) {
    return databaseService.calcularDataContabilizacao(dataLancamento, diaVencimento);
  }
  // Tipagem do databaseService pode estar mais restritiva; garantir compatibilidade
  return (databaseService as any).calcularDataContabilizacao(dataLancamento, diaVencimento, diaFechamento);
}

// Funções para buscar vencimentos
export async function buscarCartoesVencimentoProximo(userId: string, dias: number = 7): Promise<any[]> {
  return await databaseService.buscarCartoesVencimentoProximo(userId);
}

export async function atualizarCartaoConfigurado(userId: string, nomeCartao: string, diaVencimento: number, diaFechamento: null | undefined = null): Promise<any> {
  return await databaseService.atualizarCartaoConfigurado(userId, nomeCartao, diaVencimento, diaFechamento);
}

export async function buscarFaturaCartao(userId: string, nomeCartao: string, mes: number, ano: number): Promise<any[]> {
  return await databaseService.buscarFaturaCartao(userId, nomeCartao, mes, ano);
}
