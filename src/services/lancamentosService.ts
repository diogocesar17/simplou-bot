// @ts-nocheck
import * as databaseService from '../../databaseService';

// TODO: Tipar corretamente. Usar any onde necessário.

// Funções para resumos
export async function getResumoDoDia(userId: string): Promise<any> {
  return await databaseService.getResumoDoDia(userId);
}

export async function getResumoDoMesAtual(userId: string): Promise<any> {
  return await databaseService.getResumoDoMesAtual(userId);
}

export async function getResumoPorMes(userId: string, mes: number, ano: number): Promise<any> {
  return await databaseService.getResumoPorMes(userId, mes, ano);
}

export async function getResumoReal(userId: string, mes?: number, ano?: number): Promise<any> {
  return await databaseService.getResumoReal(userId, mes, ano);
}

// Funções para listagem
export async function listarLancamentos(userId: string, limite: number = 10, mes?: number, ano?: number): Promise<any[]> {
  return await databaseService.listarLancamentos(userId, limite, mes, ano);
}

export async function getUltimosLancamentos(userId: string, limite: number = 10): Promise<any[]> {
  return await databaseService.getUltimosLancamentos(userId, limite);
}

export async function getLancamentoPorId(userId: string, id: number): Promise<any> {
  return await databaseService.getLancamentoPorId(userId, id);
}

// Funções para salvar/atualizar
export async function salvarLancamento(userId: string, dados: any): Promise<any> {
  // Converter objeto para array na ordem correta dos campos
  const values = [
    dados.data,                    // $2
    dados.tipo,                    // $3
    dados.descricao,               // $4
    dados.valor,                   // $5
    dados.categoria,               // $6
    dados.pagamento,               // $7
    dados.parcelamento_id || null, // $8
    dados.parcela_atual || null,   // $9
    dados.total_parcelas || null,  // $10
    dados.recorrente || null,      // $11
    dados.recorrente_fim || null,  // $12
    dados.recorrente_id || null,   // $13
    dados.cartao_nome || null,     // $14
    dados.data_lancamento || null, // $15
    dados.data_contabilizacao || null, // $16
    dados.mes_fatura || null,      // $17
    dados.ano_fatura || null,      // $18
    dados.dia_vencimento || null,  // $19
    dados.status_fatura || null,   // $20
    dados.data_vencimento || null  // $21
  ];
  
  return await databaseService.appendRowToDatabase(userId, values);
}

export async function atualizarLancamentoPorId(userId: string, id: number, dados: any): Promise<any> {
  return await databaseService.atualizarLancamentoPorId(userId, id, dados);
}

export async function excluirLancamentoPorId(userId: string, id: number): Promise<any> {
  return await databaseService.excluirLancamentoPorId(userId, id);
}

// Funções para análise
export async function buscarDadosParaAnalise(userId: string, meses: number = 6): Promise<any> {
  return await databaseService.getDatabaseData(userId);
}

export async function buscarDadosParaSugestoes(userId: string): Promise<any> {
  return await databaseService.getDatabaseData(userId);
}

export async function buscarDadosParaPrevisao(userId: string): Promise<any> {
  return await databaseService.getDatabaseData(userId);
}

// Funções para cartões
export async function buscarFaturaCartao(userId: string, nomeCartao: string, mes: number, ano: number): Promise<any[]> {
  return await databaseService.buscarFaturaCartao(userId, nomeCartao, mes, ano);
}

export async function buscarGastosPorCategoria(userId: string, categoria: string, limite: number = 20, mes?: number, ano?: number): Promise<any[]> {
  return await databaseService.buscarGastosPorCategoria(userId, categoria, limite, mes, ano);
}

export async function buscarGastosValorAlto(userId: string, valorMinimo: number = 100): Promise<any[]> {
  return await databaseService.buscarGastosValorAlto(userId, valorMinimo);
}

// Funções para parcelamentos e recorrentes
export async function buscarParceladosAtivos(userId: string): Promise<any[]> {
  return await databaseService.buscarParceladosAtivos(userId);
}

export async function buscarRecorrentesAtivos(userId: string): Promise<any[]> {
  return await databaseService.buscarRecorrentesAtivos(userId);
}

export async function excluirParcelamentoPorId(userId: string, id: number): Promise<any> {
  return await databaseService.excluirParcelamentoPorId(userId, id);
}

export async function excluirRecorrentePorId(userId: string, id: number): Promise<any> {
  return await databaseService.excluirRecorrentePorId(userId, id);
}

// Funções para vencimentos
export async function buscarProximosVencimentos(userId: string, dias: number = 7): Promise<any[]> {
  return await databaseService.buscarProximosVencimentos(userId, dias);
}

// Funções para exclusão em lote
export async function buscarLancamentosParaExclusao(userId: string, filtros: any): Promise<any[]> {
  return await databaseService.buscarLancamentosParaExclusao(userId, filtros);
}

// Função para gerar relatório CSV
export async function gerarRelatorioCSV(userId: string, mes: number, ano: number): Promise<any> {
  return await databaseService.gerarRelatorioCSV(userId, mes, ano);
} 