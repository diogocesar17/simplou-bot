import * as databaseService from '../infrastructure/databaseService';
import { Lancamento } from '../types/global';

// Interfaces específicas para este serviço
interface DadosLancamento {
  data: string;
  tipo: 'receita' | 'despesa';
  descricao: string;
  valor: number;
  categoria: string;
  pagamento: string;
  parcelamento_id?: number | null;
  parcela_atual?: number | null;
  total_parcelas?: number | null;
  recorrente?: string | null;
  recorrente_fim?: string | null;
  recorrente_id?: number | null;
  cartao_nome?: string | null;
  data_lancamento?: string | null;
  data_contabilizacao?: string | null;
  mes_fatura?: number | null;
  ano_fatura?: number | null;
  dia_vencimento?: number | null;
  status_fatura?: string | null;
  data_vencimento?: string | null;
}

interface ResumoFinanceiro {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  totalLancamentos: number;
  totalPendente?: number;
  qtdPendente?: number;
  [key: string]: any;
}

interface FiltrosExclusao {
  categoria?: string;
  periodo?: string;
  valor_min?: number;
  valor_max?: number;
  [key: string]: any;
}

// Funções para resumos
export async function getResumoDoDia(userId: string): Promise<ResumoFinanceiro> {
  return await databaseService.getResumoDoDia(userId);
}

export async function getResumoDoMesAtual(userId: string): Promise<ResumoFinanceiro> {
  return await databaseService.getResumoDoMesAtual(userId);
}

export async function getResumoPorMes(userId: string, mes: number, ano: number): Promise<ResumoFinanceiro> {
  return await databaseService.getResumoPorMes(userId, mes, ano);
}

export async function getResumoReal(userId: string, mes: number | null = null, ano: number | null = null): Promise<ResumoFinanceiro> {
  // Tipagem do databaseService aceita null/undefined; fazemos cast seguro aqui
  return await databaseService.getResumoReal(userId, mes as any, ano as any);
}

// Funções para listagem
export async function listarLancamentos(userId: string, limite: number = 10, mes: number | null = null, ano: number | null = null): Promise<Lancamento[]> {
  // Tipagem do databaseService aceita null/undefined; fazemos cast seguro aqui
  return await databaseService.listarLancamentos(userId, limite, mes as any, ano as any);
}

export async function getUltimosLancamentos(userId: string, limite: number = 10): Promise<Lancamento[]> {
  return await databaseService.getUltimosLancamentos(userId, limite);
}

// Wrapper para edição que espera "recentes" no fluxo de comandos
export async function buscarLancamentosRecentes(userId: string, limite: number = 10): Promise<Lancamento[]> {
  return await databaseService.getUltimosLancamentos(userId, limite);
}

export async function getLancamentoPorId(userId: string, id: number): Promise<Lancamento | null> {
  return await databaseService.getLancamentoPorId(userId, id);
}

// Funções para salvar/atualizar
export async function salvarLancamento(userId: string, dados: DadosLancamento): Promise<unknown> {
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

export async function atualizarLancamentoPorId(userId: string, id: number, dados: Partial<DadosLancamento>): Promise<unknown> {
  return await databaseService.atualizarLancamentoPorId(userId, id, dados);
}

export async function excluirLancamentoPorId(userId: string, id: number): Promise<unknown> {
  return await databaseService.excluirLancamentoPorId(userId, id);
}

// Atualiza um único campo do lançamento por ID
export async function atualizarCampoLancamento(
  userId: string,
  id: number,
  campo: 'valor' | 'categoria' | 'descricao' | 'pagamento' | 'data',
  valor: string | number
): Promise<unknown> {
  const novosDados: Partial<DadosLancamento> = {};

  const toNumber = (v: string | number) => {
    if (typeof v === 'number') return v;
    const parsed = parseFloat(String(v).replace(',', '.'));
    return isNaN(parsed) ? undefined : parsed;
  };

  const toISODate = (br: string) => {
    // Espera formato dd/mm/aaaa
    const partes = String(br).trim().split('/');
    if (partes.length === 3) {
      const [dd, mm, aaaa] = partes;
      const ddNum = dd.padStart(2, '0');
      const mmNum = mm.padStart(2, '0');
      return `${aaaa}-${mmNum}-${ddNum}`;
    }
    // Se já estiver em ISO, retorna como está
    return br;
  };

  switch (campo) {
    case 'valor':
      novosDados.valor = toNumber(valor);
      break;
    case 'categoria':
      novosDados.categoria = String(valor);
      break;
    case 'descricao':
      novosDados.descricao = String(valor);
      break;
    case 'pagamento':
      novosDados.pagamento = String(valor);
      break;
    case 'data':
      novosDados.data = toISODate(String(valor));
      break;
    default:
      // Campo não suportado
      throw new Error(`Campo de edição não suportado: ${campo}`);
  }

  return await databaseService.atualizarLancamentoPorId(userId, id, novosDados);
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

export async function buscarGastosPorCategoria(userId: string, categoria: string, limite: number = 20, mes: number | null = null, ano: number | null = null): Promise<Lancamento[]> {
  // Tipagem do databaseService aceita null/undefined; fazemos cast seguro aqui
  return await databaseService.buscarGastosPorCategoria(userId, categoria, limite, mes as any, ano as any);
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
export async function buscarProximosVencimentos(userId: string, dias: number = 7): Promise<any> {
  return await databaseService.buscarProximosVencimentos(userId, dias);
}

// Funções para exclusão em lote
export async function buscarLancamentosParaExclusao(userId: string, limite: number = 20): Promise<any> {
  return await databaseService.buscarLancamentosParaExclusao(userId, limite);
}

// Função para gerar relatório CSV
export async function gerarRelatorioCSV(userId: string, mes: number, ano: number): Promise<any> {
  return await databaseService.gerarRelatorioCSV(userId, mes, ano);
}
