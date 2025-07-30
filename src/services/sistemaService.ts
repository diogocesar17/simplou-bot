// @ts-nocheck
import * as databaseService from '../../databaseService';

// TODO: Tipar corretamente. Usar any onde necessário.

// Funções para logs e auditoria
export async function registrarLog(userId: string, acao: string, detalhes?: string): Promise<any> {
  return await databaseService.registrarLog(userId, acao, detalhes);
}

export async function buscarLogsRecentes(userId: string, limite: number = 50): Promise<any[]> {
  return await databaseService.buscarLogsRecentes(userId, limite);
}

export async function gerarLogAuditoria(userId: string, periodo: string = 'recentes'): Promise<any> {
  const limite = periodo === 'todos' ? 1000 : 100;
  const resultado = await databaseService.gerarLogAuditoria(limite);
  
  if (resultado && resultado.csv) {
    // Salvar arquivo CSV
    const fs = require('fs').promises;
    const path = require('path');
    
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

export async function limparDadosAntigos(dias: number = 365): Promise<any> {
  return await databaseService.limparDadosAntigos(dias);
}

// Funções para migração de dados
export async function migrarUsuariosConfig(): Promise<any> {
  return await databaseService.migrarUsuariosConfig();
}

// Funções para consultas diretas
export async function queryDatabase(query: string, params: any[] = []): Promise<any> {
  return await databaseService.queryDatabase(query, params);
}

// Função para contar lançamentos
export async function contarLancamentos(): Promise<number> {
  const result = await databaseService.queryDatabase('SELECT COUNT(*) as total FROM lancamentos');
  return result[0]?.total || 0;
} 