import * as databaseService from '../infrastructure/databaseService';
import { promises as fs } from 'fs';
import * as path from 'path';

// TODO: Tipar corretamente. Usar any onde necessário.

// Funções para logs e auditoria
export async function registrarLog(userId: string, acao: string, detalhes?: any): Promise<any> {
  return await databaseService.registrarLog(userId, acao, detalhes);
}

export async function buscarLogsRecentes(limite: number = 50): Promise<any[]> {
  return await databaseService.buscarLogsRecentes(limite);
}

export async function gerarLogAuditoria(userId: string, periodo: string = 'recentes'): Promise<any> {
  const limite = periodo === 'todos' ? 1000 : 100;
  const resultado = await databaseService.gerarLogAuditoria(limite);
  
  if (resultado && resultado.csv) {
    // Salvar arquivo CSV
    
    // Criar diretório de logs se não existir
    const logsDir = path.join(process.cwd(), 'logs');
    try {
      await fs.mkdir(logsDir, { recursive: true });
    } catch (error) {
      // Diretório já existe ou erro de permissão
    }
    
    // Gerar nome do arquivo com timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const nomeArquivo = `logs_auditoria_${timestamp}.csv`;
    const caminhoArquivo = path.join(logsDir, nomeArquivo);
    
    // Salvar arquivo CSV
    await fs.writeFile(caminhoArquivo, resultado.csv, 'utf8');
    
    return {
      sucesso: true,
      nomeArquivo,
      caminhoArquivo,
      total: resultado.total,
      tamanho: Math.round(resultado.csv.length / 1024)
    };
  }
  
  return resultado;
}

// Funções para estatísticas do sistema
export async function gerarEstatisticasSistema(): Promise<any> {
  return await databaseService.gerarEstatisticasSistema();
}

// Funções para backup e limpeza
export async function gerarBackupCSV(userId: string): Promise<any> {
  return await databaseService.gerarBackupCSV(userId);
}

export async function limparDadosAntigos(): Promise<any> {
  return await databaseService.limparDadosAntigos();
}

// Funções para migração de dados
export async function migrarUsuariosConfig(): Promise<any> {
  // Esta função não existe no databaseService atual
  return { success: false, message: 'Função não implementada' };
}

// Funções para consultas diretas
export async function queryDatabase(query: string, params: any[] = []): Promise<any> {
  // Esta função não existe no databaseService atual
  return { success: false, message: 'Função não implementada' };
}

// Função para contar lançamentos
export async function contarLancamentos(): Promise<number> {
  // Implementação simplificada sem queryDatabase
  return 0;
}
