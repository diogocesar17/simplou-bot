import * as databaseService from '../../databaseService';

// TODO: Tipar corretamente. Usar any onde necessário.

// Funções para configurar cartões
export async function salvarConfiguracaoCartao(
  userId: string,
  nomeCartao: string,
  diaVencimento: number,
  diaFechamento: number | null | undefined = null
): Promise<any> {
  return await databaseService.salvarConfiguracaoCartao(userId, nomeCartao, diaVencimento, diaFechamento as any);
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

export async function atualizarCartaoConfigurado(
  userId: string,
  nomeCartao: string,
  diaVencimento: number,
  diaFechamento: number | null | undefined = null
): Promise<any> {
  return await databaseService.atualizarCartaoConfigurado(userId, nomeCartao, diaVencimento, diaFechamento as any);
}

// Wrappers de atualização parcial para compatibilidade com comandos de edição
export async function atualizarVencimentoCartao(userId: string, nomeCartao: string, novoDiaVencimento: number): Promise<any> {
  // Buscar configuração atual para preservar o fechamento
  const configAtual = await buscarConfiguracaoCartao(userId, nomeCartao);
  const diaFechamentoAtual = configAtual?.dia_fechamento ?? null;
  return await atualizarCartaoConfigurado(userId, nomeCartao, novoDiaVencimento, diaFechamentoAtual);
}

export async function atualizarFechamentoCartao(userId: string, nomeCartao: string, novoDiaFechamento: number | null): Promise<any> {
  // Buscar configuração atual para preservar o vencimento
  const configAtual = await buscarConfiguracaoCartao(userId, nomeCartao);
  const diaVencimentoAtual = configAtual?.dia_vencimento;
  if (diaVencimentoAtual === undefined || diaVencimentoAtual === null) {
    throw new Error('Dia de vencimento atual não encontrado para o cartão');
  }
  return await atualizarCartaoConfigurado(userId, nomeCartao, diaVencimentoAtual, novoDiaFechamento ?? null);
}

export async function buscarFaturaCartao(userId: string, nomeCartao: string, mes: number, ano: number): Promise<any[]> {
  return await databaseService.buscarFaturaCartao(userId, nomeCartao, mes, ano);
}
