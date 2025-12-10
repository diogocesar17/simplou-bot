import { pool, registrarLog } from '../infrastructure/databaseService';
import { logger } from '../infrastructure/logger';
import { buscarUsuario } from '../infrastructure/databaseService';

export interface Lembrete {
  id: string;
  user_id: string;
  titulo: string;
  descricao?: string;
  valor?: number;
  categoria?: string;
  data_vencimento: Date;
  recorrente: boolean;
  tipo_recorrencia?: 'semanal' | 'mensal' | 'anual';
  dias_antecedencia: number;
  ativo: boolean;
  auto_criar_lancamento: boolean;
  proximo_envio: Date;
  ultimo_envio?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CriarLembreteData {
  titulo: string;
  descricao?: string;
  valor?: number;
  categoria?: string;
  data_vencimento: Date;
  recorrente?: boolean;
  tipo_recorrencia?: 'semanal' | 'mensal' | 'anual';
  dias_antecedencia?: number;
  auto_criar_lancamento?: boolean;
}

export interface AtualizarLembreteData {
  titulo?: string;
  descricao?: string;
  valor?: number;
  categoria?: string;
  data_vencimento?: Date;
  recorrente?: boolean;
  tipo_recorrencia?: 'semanal' | 'mensal' | 'anual';
  dias_antecedencia?: number;
  auto_criar_lancamento?: boolean;
}

// Função para buscar configurações do sistema
export async function buscarConfigSistema(chave: string): Promise<string | null> {
  try {
    const result = await pool.query(
      'SELECT valor FROM config_sistema WHERE chave = $1',
      [chave]
    );
    return result.rows.length > 0 ? result.rows[0].valor : null;
  } catch (error: any) {
    logger.error('Erro ao buscar configuração do sistema:', error.message);
    throw error;
  }
}

// Função para verificar limite de lembretes do usuário
export async function verificarLimiteLembretes(userId: string): Promise<{ permitido: boolean; atual: number; limite: number }> {
  try {
    // Buscar usuário para verificar se é premium
    const usuario = await buscarUsuario(userId);
    const isPremium = usuario?.premium || false;

    // Buscar limites do sistema
    const limiteFree = await buscarConfigSistema('limite_lembretes_free');
    const limitePremium = await buscarConfigSistema('limite_lembretes_premium');
    
    const limite = isPremium ? parseInt(limitePremium || '999') : parseInt(limiteFree || '5');

    // Contar lembretes ativos do usuário
    const result = await pool.query(
      'SELECT COUNT(*) as total FROM lembretes WHERE user_id = $1 AND ativo = true',
      [userId]
    );
    const atual = parseInt(result.rows[0].total);

    return {
      permitido: atual < limite,
      atual,
      limite
    };
  } catch (error: any) {
    logger.error('Erro ao verificar limite de lembretes:', error.message);
    throw error;
  }
}

// Função para calcular próximo envio
function calcularProximoEnvio(dataVencimento: Date, diasAntecedencia: number): Date {
  const proximoEnvio = new Date(dataVencimento);
  proximoEnvio.setDate(proximoEnvio.getDate() - diasAntecedencia);
  return proximoEnvio;
}

// Função para criar um novo lembrete
export async function criarLembrete(userId: string, dados: CriarLembreteData): Promise<Lembrete> {
  try {
    // Verificar limite de lembretes
    const { permitido, atual, limite } = await verificarLimiteLembretes(userId);
    if (!permitido) {
      throw new Error(`Limite de lembretes atingido (${atual}/${limite}). Considere fazer upgrade para premium.`);
    }

    // Validações básicas
    if (!dados.titulo || dados.titulo.trim().length === 0) {
      throw new Error('Título é obrigatório');
    }

    if (dados.recorrente && !dados.tipo_recorrencia) {
      throw new Error('Tipo de recorrência é obrigatório para lembretes recorrentes');
    }

    const diasAntecedencia = dados.dias_antecedencia || 3;
    if (diasAntecedencia < 0 || diasAntecedencia > 30) {
      throw new Error('Dias de antecedência deve estar entre 0 e 30');
    }

    // Calcular próximo envio
    const proximoEnvio = calcularProximoEnvio(dados.data_vencimento, diasAntecedencia);

    const result = await pool.query(`
      INSERT INTO lembretes (
        user_id, titulo, descricao, valor, categoria, data_vencimento,
        recorrente, tipo_recorrencia, dias_antecedencia, auto_criar_lancamento,
        proximo_envio
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      userId,
      dados.titulo.trim(),
      dados.descricao?.trim() || null,
      dados.valor || null,
      dados.categoria || null,
      dados.data_vencimento,
      dados.recorrente || false,
      dados.tipo_recorrencia || null,
      diasAntecedencia,
      dados.auto_criar_lancamento || false,
      proximoEnvio
    ]);

    const lembrete = result.rows[0];
    
    await registrarLog(userId, 'lembrete_criado', {
      lembrete_id: lembrete.id,
      titulo: lembrete.titulo
    });

    return {
      id: lembrete.id,
      user_id: lembrete.user_id,
      titulo: lembrete.titulo,
      descricao: lembrete.descricao,
      valor: lembrete.valor,
      categoria: lembrete.categoria,
      data_vencimento: new Date(lembrete.data_vencimento),
      recorrente: lembrete.recorrente,
      tipo_recorrencia: lembrete.tipo_recorrencia,
      dias_antecedencia: lembrete.dias_antecedencia,
      ativo: lembrete.ativo,
      auto_criar_lancamento: lembrete.auto_criar_lancamento,
      proximo_envio: new Date(lembrete.proximo_envio),
      ultimo_envio: lembrete.ultimo_envio ? new Date(lembrete.ultimo_envio) : undefined,
      created_at: new Date(lembrete.created_at),
      updated_at: new Date(lembrete.updated_at)
    };
  } catch (error: any) {
    logger.error('Erro ao criar lembrete:', error.message);
    throw error;
  }
}

// Função para listar lembretes do usuário
export async function listarLembretes(userId: string, apenasAtivos: boolean = false): Promise<Lembrete[]> {
  try {
    let query = 'SELECT * FROM lembretes WHERE user_id = $1';
    const params = [userId];
    
    if (apenasAtivos) {
      query += ' AND ativo = true';
    }
    
    query += ' ORDER BY data_vencimento ASC';
    
    const result = await pool.query(query, params);
    return result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      titulo: row.titulo,
      descricao: row.descricao,
      valor: row.valor,
      categoria: row.categoria,
      data_vencimento: new Date(row.data_vencimento),
      recorrente: row.recorrente,
      tipo_recorrencia: row.tipo_recorrencia,
      dias_antecedencia: row.dias_antecedencia,
      ativo: row.ativo,
      auto_criar_lancamento: row.auto_criar_lancamento,
      proximo_envio: new Date(row.proximo_envio),
      ultimo_envio: row.ultimo_envio ? new Date(row.ultimo_envio) : undefined,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }));
  } catch (error: any) {
    logger.error('Erro ao listar lembretes:', error.message);
    throw error;
  }
}

// Função para buscar lembrete por ID
export async function buscarLembretePorId(userId: string, lembreteId: string): Promise<Lembrete | null> {
  try {
    const result = await pool.query(
      'SELECT * FROM lembretes WHERE id = $1 AND user_id = $2',
      [lembreteId, userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      titulo: row.titulo,
      descricao: row.descricao,
      valor: row.valor,
      categoria: row.categoria,
      data_vencimento: new Date(row.data_vencimento),
      recorrente: row.recorrente,
      tipo_recorrencia: row.tipo_recorrencia,
      dias_antecedencia: row.dias_antecedencia,
      ativo: row.ativo,
      auto_criar_lancamento: row.auto_criar_lancamento,
      proximo_envio: new Date(row.proximo_envio),
      ultimo_envio: row.ultimo_envio ? new Date(row.ultimo_envio) : undefined,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  } catch (error: any) {
    logger.error('Erro ao buscar lembrete por ID:', error.message);
    throw error;
  }
}

// Função para atualizar lembrete
export async function atualizarLembrete(userId: string, lembreteId: string, dados: AtualizarLembreteData): Promise<Lembrete> {
  try {
    // Buscar lembrete existente
    const lembreteExistente = await buscarLembretePorId(userId, lembreteId);
    if (!lembreteExistente) {
      throw new Error('Lembrete não encontrado');
    }

    // Preparar campos para atualização
    const campos: string[] = [];
    const valores: any[] = [];
    let contador = 1;

    if (dados.titulo !== undefined) {
      campos.push(`titulo = $${contador}`);
      valores.push(dados.titulo.trim());
      contador++;
    }

    if (dados.descricao !== undefined) {
      campos.push(`descricao = $${contador}`);
      valores.push(dados.descricao?.trim() || null);
      contador++;
    }

    if (dados.valor !== undefined) {
      campos.push(`valor = $${contador}`);
      valores.push(dados.valor);
      contador++;
    }

    if (dados.categoria !== undefined) {
      campos.push(`categoria = $${contador}`);
      valores.push(dados.categoria);
      contador++;
    }

    if (dados.data_vencimento !== undefined) {
      campos.push(`data_vencimento = $${contador}`);
      valores.push(dados.data_vencimento);
      contador++;
    }

    if (dados.recorrente !== undefined) {
      campos.push(`recorrente = $${contador}`);
      valores.push(dados.recorrente);
      contador++;
    }

    if (dados.tipo_recorrencia !== undefined) {
      campos.push(`tipo_recorrencia = $${contador}`);
      valores.push(dados.tipo_recorrencia);
      contador++;
    }

    if (dados.dias_antecedencia !== undefined) {
      campos.push(`dias_antecedencia = $${contador}`);
      valores.push(dados.dias_antecedencia);
      contador++;
    }

    if (dados.auto_criar_lancamento !== undefined) {
      campos.push(`auto_criar_lancamento = $${contador}`);
      valores.push(dados.auto_criar_lancamento);
      contador++;
    }

    // Recalcular próximo envio se necessário
    if (dados.data_vencimento !== undefined || dados.dias_antecedencia !== undefined) {
      const novaDataVencimento = dados.data_vencimento || lembreteExistente.data_vencimento;
      const novosDiasAntecedencia = dados.dias_antecedencia || lembreteExistente.dias_antecedencia;
      const novoProximoEnvio = calcularProximoEnvio(novaDataVencimento, novosDiasAntecedencia);
      
      campos.push(`proximo_envio = $${contador}`);
      valores.push(novoProximoEnvio);
      contador++;
    }

    if (campos.length === 0) {
      throw new Error('Nenhum campo para atualizar');
    }

    campos.push(`updated_at = CURRENT_TIMESTAMP`);
    valores.push(lembreteId, userId);

    const query = `
      UPDATE lembretes 
      SET ${campos.join(', ')}
      WHERE id = $${contador} AND user_id = $${contador + 1}
      RETURNING *
    `;

    const result = await pool.query(query, valores);
    const lembreteAtualizado = result.rows[0];

    await registrarLog(userId, 'lembrete_atualizado', {
      lembrete_id: lembreteId,
      campos_alterados: Object.keys(dados)
    });

    return {
      id: lembreteAtualizado.id,
      user_id: lembreteAtualizado.user_id,
      titulo: lembreteAtualizado.titulo,
      descricao: lembreteAtualizado.descricao,
      valor: lembreteAtualizado.valor,
      categoria: lembreteAtualizado.categoria,
      data_vencimento: new Date(lembreteAtualizado.data_vencimento),
      recorrente: lembreteAtualizado.recorrente,
      tipo_recorrencia: lembreteAtualizado.tipo_recorrencia,
      dias_antecedencia: lembreteAtualizado.dias_antecedencia,
      ativo: lembreteAtualizado.ativo,
      auto_criar_lancamento: lembreteAtualizado.auto_criar_lancamento,
      proximo_envio: new Date(lembreteAtualizado.proximo_envio),
      ultimo_envio: lembreteAtualizado.ultimo_envio ? new Date(lembreteAtualizado.ultimo_envio) : undefined,
      created_at: new Date(lembreteAtualizado.created_at),
      updated_at: new Date(lembreteAtualizado.updated_at)
    };
  } catch (error: any) {
    logger.error('Erro ao atualizar lembrete:', error.message);
    throw error;
  }
}

// Função para excluir lembrete
export async function excluirLembrete(userId: string, lembreteId: string): Promise<boolean> {
  try {
    const lembreteExistente = await buscarLembretePorId(userId, lembreteId);
    if (!lembreteExistente) {
      return false;
    }

    const result = await pool.query(
      'DELETE FROM lembretes WHERE id = $1 AND user_id = $2',
      [lembreteId, userId]
    );

    await registrarLog(userId, 'lembrete_excluido', {
      lembrete_id: lembreteId,
      titulo: lembreteExistente.titulo
    });

    return (result.rowCount ?? 0) > 0;
  } catch (error: any) {
    logger.error('Erro ao excluir lembrete:', error.message);
    throw error;
  }
}

// Função para alternar status do lembrete (ativar/desativar)
export async function alternarStatusLembrete(userId: string, lembreteId: string): Promise<Lembrete> {
  try {
    const lembreteExistente = await buscarLembretePorId(userId, lembreteId);
    if (!lembreteExistente) {
      throw new Error('Lembrete não encontrado');
    }

    const novoStatus = !lembreteExistente.ativo;
    
    const result = await pool.query(
      'UPDATE lembretes SET ativo = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *',
      [novoStatus, lembreteId, userId]
    );

    const lembreteAtualizado = result.rows[0];

    await registrarLog(userId, 'lembrete_status_alterado', {
      lembrete_id: lembreteId,
      novo_status: novoStatus
    });

    return {
      id: lembreteAtualizado.id,
      user_id: lembreteAtualizado.user_id,
      titulo: lembreteAtualizado.titulo,
      descricao: lembreteAtualizado.descricao,
      valor: lembreteAtualizado.valor,
      categoria: lembreteAtualizado.categoria,
      data_vencimento: new Date(lembreteAtualizado.data_vencimento),
      recorrente: lembreteAtualizado.recorrente,
      tipo_recorrencia: lembreteAtualizado.tipo_recorrencia,
      dias_antecedencia: lembreteAtualizado.dias_antecedencia,
      ativo: lembreteAtualizado.ativo,
      auto_criar_lancamento: lembreteAtualizado.auto_criar_lancamento,
      proximo_envio: new Date(lembreteAtualizado.proximo_envio),
      ultimo_envio: lembreteAtualizado.ultimo_envio ? new Date(lembreteAtualizado.ultimo_envio) : undefined,
      created_at: new Date(lembreteAtualizado.created_at),
      updated_at: new Date(lembreteAtualizado.updated_at)
    };
  } catch (error: any) {
    logger.error('Erro ao alternar status do lembrete:', error.message);
    throw error;
  }
}

// Função para buscar lembretes que devem ser enviados hoje
export async function buscarLembretesParaEnvio(): Promise<Lembrete[]> {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    const result = await pool.query(`
      SELECT * FROM lembretes 
      WHERE ativo = true 
        AND proximo_envio >= $1 
        AND proximo_envio < $2
      ORDER BY proximo_envio ASC
    `, [hoje, amanha]);

    return result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      titulo: row.titulo,
      descricao: row.descricao,
      valor: row.valor,
      categoria: row.categoria,
      data_vencimento: new Date(row.data_vencimento),
      recorrente: row.recorrente,
      tipo_recorrencia: row.tipo_recorrencia,
      dias_antecedencia: row.dias_antecedencia,
      ativo: row.ativo,
      auto_criar_lancamento: row.auto_criar_lancamento,
      proximo_envio: new Date(row.proximo_envio),
      ultimo_envio: row.ultimo_envio ? new Date(row.ultimo_envio) : undefined,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }));
  } catch (error: any) {
    logger.error('Erro ao buscar lembretes para envio:', error.message);
    throw error;
  }
}

// Função para marcar lembrete como enviado e calcular próximo envio (se recorrente)
export async function marcarLembreteEnviado(lembreteId: string): Promise<void> {
  try {
    const result = await pool.query(
      'SELECT * FROM lembretes WHERE id = $1',
      [lembreteId]
    );

    if (result.rows.length === 0) {
      throw new Error('Lembrete não encontrado');
    }

    const lembrete = result.rows[0];
    const agora = new Date();

    let proximoEnvio: Date | null = null;
    let novaDataVencimento: Date | null = null;

    // Se for recorrente, calcular próxima data
    if (lembrete.recorrente && lembrete.tipo_recorrencia) {
      const dataVencimento = new Date(lembrete.data_vencimento);
      
      switch (lembrete.tipo_recorrencia) {
        case 'semanal':
          novaDataVencimento = new Date(dataVencimento);
          novaDataVencimento.setDate(novaDataVencimento.getDate() + 7);
          break;
        case 'mensal':
          novaDataVencimento = new Date(dataVencimento);
          novaDataVencimento.setMonth(novaDataVencimento.getMonth() + 1);
          break;
        case 'anual':
          novaDataVencimento = new Date(dataVencimento);
          novaDataVencimento.setFullYear(novaDataVencimento.getFullYear() + 1);
          break;
      }
      
      if (novaDataVencimento) {
        proximoEnvio = calcularProximoEnvio(novaDataVencimento, lembrete.dias_antecedencia);
      }
    }

    // Atualizar lembrete
    if (lembrete.recorrente && proximoEnvio && novaDataVencimento) {
      await pool.query(`
        UPDATE lembretes 
        SET ultimo_envio = $1, proximo_envio = $2, data_vencimento = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [agora, proximoEnvio, novaDataVencimento, lembreteId]);
    } else {
      // Para lembretes não recorrentes, apenas marcar como enviado e desativar
      await pool.query(`
        UPDATE lembretes 
        SET ultimo_envio = $1, ativo = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [agora, lembreteId]);
    }

    await registrarLog(lembrete.user_id, 'lembrete_enviado', {
      lembrete_id: lembreteId,
      titulo: lembrete.titulo
    });
  } catch (error: any) {
    logger.error('Erro ao marcar lembrete como enviado:', error.message);
    throw error;
  }
}

// Função para buscar lembretes próximos ao vencimento
export async function buscarLembretesProximoVencimento(userId: string, dias: number = 7): Promise<Lembrete[]> {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const dataLimite = new Date(hoje);
    dataLimite.setDate(hoje.getDate() + dias);

    const result = await pool.query(`
      SELECT * FROM lembretes 
      WHERE user_id = $1 
        AND ativo = true 
        AND data_vencimento >= $2 
        AND data_vencimento <= $3
      ORDER BY data_vencimento ASC
    `, [userId, hoje, dataLimite]);

    return result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      titulo: row.titulo,
      descricao: row.descricao,
      valor: row.valor,
      categoria: row.categoria,
      data_vencimento: new Date(row.data_vencimento),
      recorrente: row.recorrente,
      tipo_recorrencia: row.tipo_recorrencia,
      dias_antecedencia: row.dias_antecedencia,
      ativo: row.ativo,
      auto_criar_lancamento: row.auto_criar_lancamento,
      proximo_envio: new Date(row.proximo_envio),
      ultimo_envio: row.ultimo_envio ? new Date(row.ultimo_envio) : undefined,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    }));
  } catch (error: any) {
    logger.error('Erro ao buscar lembretes próximos ao vencimento:', error.message);
    throw error;
  }
}

// Função para formatar um lembrete para exibição
export function formatarLembrete(lembrete: Lembrete): string {
  const dataVencimento = lembrete.data_vencimento.toLocaleDateString('pt-BR');
  const valor = lembrete.valor ? ` - R$ ${lembrete.valor.toFixed(2)}` : '';
  const categoria = lembrete.categoria ? ` [${lembrete.categoria}]` : '';
  const recorrente = lembrete.recorrente ? ` 🔄 ${lembrete.tipo_recorrencia}` : '';
  const status = lembrete.ativo ? '✅' : '❌';
  
  return `${status} **${lembrete.titulo}**${valor}${categoria}\n📅 Vence em: ${dataVencimento}${recorrente}\n⏰ Lembrar ${lembrete.dias_antecedencia} dias antes`;
}

// Função para formatar lista de lembretes
export function formatarListaLembretes(lembretes: Lembrete[]): string {
  if (lembretes.length === 0) {
    return '📝 Nenhum lembrete encontrado.';
  }

  const header = `📝 **Seus Lembretes** (${lembretes.length})\n\n`;
  const lista = lembretes.map((lembrete, index) => {
    return `**${index + 1}.** ${formatarLembrete(lembrete)}`;
  }).join('\n\n');

  return header + lista;
}
