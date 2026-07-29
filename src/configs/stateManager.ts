import Redis from 'ioredis';
import type { EstadoRedis } from '../types/domain';
import { logger } from '../infrastructure/logger';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const PREFIXO = 'estado:';
const TTL_PADRAO = 600;

// ---------------------------------------------------------------------------
// Known wizard states — all etapa strings used across modules.
// Wildcard suffixes (edicao_cartao_*, edicao_lancamento_*) not enumerable here.
// ---------------------------------------------------------------------------
export const ETAPAS = {
  // Lançamento
  AGUARDANDO_CONFIRMACAO_IA: 'aguardando_confirmacao_ia',
  AGUARDANDO_FORMA_PAGAMENTO: 'aguardando_forma_pagamento',
  AGUARDANDO_DATA_VENCIMENTO: 'aguardando_data_vencimento',
  AGUARDANDO_ESCOLHA_CARTAO: 'aguardando_escolha_cartao',

  // Cartões
  AGUARDANDO_NOME_CARTAO: 'aguardando_nome_cartao',
  AGUARDANDO_VENCIMENTO_CARTAO: 'aguardando_vencimento_cartao',
  AGUARDANDO_FECHAMENTO_CARTAO: 'aguardando_fechamento_cartao',

  // Lembretes — wizard criação
  AGUARDANDO_TITULO_LEMBRETE: 'aguardando_titulo_lembrete',
  AGUARDANDO_DATA_VENCIMENTO_LEMBRETE: 'aguardando_data_vencimento_lembrete',
  AGUARDANDO_VALOR_LEMBRETE: 'aguardando_valor_lembrete',
  AGUARDANDO_CATEGORIA_LEMBRETE: 'aguardando_categoria_lembrete',
  AGUARDANDO_DESCRICAO_LEMBRETE: 'aguardando_descricao_lembrete',
  AGUARDANDO_RECORRENCIA_LEMBRETE: 'aguardando_recorrencia_lembrete',
  AGUARDANDO_DIAS_ANTECEDENCIA_LEMBRETE: 'aguardando_dias_antecedencia_lembrete',

  // Lembretes — meuslembretes
  SELECAO_LEMBRETE: 'selecao_lembrete',
  ACAO_LEMBRETE: 'acao_lembrete',
  CONFIRMANDO_EXCLUSAO_LEMBRETE: 'confirmando_exclusao_lembrete',

  // Lançamento — edição/exclusão
  ESCOLHA_PARCELADO_EDICAO: 'escolha_parcelado_edicao',
  ESCOLHA_RECORRENTE_EDICAO: 'escolha_recorrente_edicao',
  CONFIRMACAO_EXCLUSAO_LANCAMENTO: 'confirmacao_exclusao_lancamento',
  ESCOLHA_EXCLUSAO_PARCELADO: 'escolha_exclusao_parcelado',
  ESCOLHA_EXCLUSAO_RECORRENTE: 'escolha_exclusao_recorrente',
  TIPO_EDICAO: 'tipo_edicao',
  TIPO_EXCLUSAO: 'tipo_exclusao',

  // IA
  PERGUNTA_INTELIGENTE: 'pergunta_inteligente',

  // Beta / acesso
  AGUARDANDO_CODIGO_CONVITE: 'aguardando_codigo_convite',
} as const;

// ---------------------------------------------------------------------------
// State functions
// ---------------------------------------------------------------------------

export async function definirEstado<T extends Record<string, unknown>>(
  userId: string,
  etapa: string,
  dadosParciais: T = {} as T,
  ttlSegundos: number = TTL_PADRAO,
): Promise<void> {
  const valor: EstadoRedis = { etapa, dadosParciais };
  await redis.set(`${PREFIXO}${userId}`, JSON.stringify(valor), 'EX', ttlSegundos);
  logger.debug({ userId, etapa, ttl: ttlSegundos }, '[STATE] definirEstado');
}

export async function obterEstado<T extends Record<string, unknown>>(
  userId: string,
): Promise<(Omit<EstadoRedis, 'dadosParciais'> & { dadosParciais: T }) | null> {
  const valor = await redis.get(`${PREFIXO}${userId}`);
  return valor ? (JSON.parse(valor) as Omit<EstadoRedis, 'dadosParciais'> & { dadosParciais: T }) : null;
}

export async function limparEstado(userId: string): Promise<void> {
  await redis.del(`${PREFIXO}${userId}`);
  logger.debug({ userId }, '[STATE] limparEstado');
}
