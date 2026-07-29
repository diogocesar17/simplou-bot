// Domain types — simplou-bot
// Source of truth for all TypeScript types used across the application.
// DB column names kept verbatim; no implicit `any`.

// ---------------------------------------------------------------------------
// Primitive unions
// ---------------------------------------------------------------------------

export type TipoLancamento = 'receita' | 'gasto';

export type FormaPagamento =
  | 'pix'
  | 'dinheiro'
  | 'credito'
  | 'debito'
  | 'boleto'
  | 'transferencia'
  | 'NÃO INFORMADO';

// 'semanal' e 'anual' são usados por lembretesService, mas NÃO pelo fluxo de lançamento (lancamento.ts).
// Decisão de produto (beta): o fluxo de registro de lançamento recorrente suporta apenas 'mensal'.
// Intenções semanal/anual em mensagens de texto são detectadas em messageParser.ts e bloqueadas
// com aviso ao usuário em lancamento.ts. Não remover os valores do tipo — lembretesService os usa.
export type TipoRecorrencia = 'semanal' | 'mensal' | 'anual';

export type StatusFaturaLancamento = 'pendente' | 'pago';

export type FaturaStatus = 'OPEN' | 'CLOSED';

export type PlanoUsuario = 'gratuito' | 'premium';

export type StatusUsuario = 'ativo' | 'inativo';

export type IntentType =
  | 'INVOICE_SUMMARY'
  | 'INVOICE_DETAIL'
  | 'CARD_PAYMENT_FORECAST'
  | 'CREATE_EXPENSE'
  | 'UNKNOWN';

export type IntentSource = 'LOCAL' | 'GEMINI' | 'LEGACY';

export type ConfiancaIA = 'alta' | 'media' | 'baixa';

export type Categoria =
  | 'Alimentação'
  | 'Transporte'
  | 'Saúde'
  | 'Educação'
  | 'Moradia'
  | 'Lazer'
  | 'Vestuário'
  | 'Serviços'
  | 'Casa'
  | 'Trabalho'
  | 'Renda'
  | 'Outros';

// ---------------------------------------------------------------------------
// DB entities (rows returned from PostgreSQL)
// ---------------------------------------------------------------------------

export interface Lancamento {
  id: string;
  user_id: string;
  data: string;                        // DATE as ISO string YYYY-MM-DD
  tipo: TipoLancamento;
  descricao: string | null;
  valor: number;
  categoria: string | null;
  pagamento: string | null;
  criado_em: Date;
  atualizado_em: Date;

  // Parcelamento
  parcelamento_id: string | null;
  parcela_atual: number | null;
  total_parcelas: number | null;

  // Recorrência
  recorrente: boolean;
  recorrente_fim: string | null;       // DATE as ISO string
  recorrente_id: string | null;

  // Cartão de crédito
  cartao_nome: string | null;
  data_lancamento: string | null;      // DATE as ISO string
  data_contabilizacao: string | null;  // DATE as ISO string
  mes_fatura: number | null;
  ano_fatura: number | null;
  dia_vencimento: number | null;
  status_fatura: StatusFaturaLancamento | null;

  // Boleto
  data_vencimento: string | null;      // DATE as ISO string
}

export interface CartaoConfig {
  id: string;
  user_id: string;
  nome_cartao: string;
  dia_vencimento: number;
  dia_fechamento: number | null;
  criado_em: Date;
}

export interface Lembrete {
  id: string;
  user_id: string;
  titulo: string;
  descricao: string | null;
  valor: number | null;
  categoria: string | null;
  data_vencimento: Date;
  recorrente: boolean;
  tipo_recorrencia: TipoRecorrencia | null;
  dias_antecedencia: number;
  ativo: boolean;
  auto_criar_lancamento: boolean;
  proximo_envio: Date | null;
  ultimo_envio: Date | null;
  criado_em: Date;
  atualizado_em: Date;
}

export interface Usuario {
  id: string;
  user_id: string;
  nome: string | null;
  telefone: string | null;
  plano: PlanoUsuario;
  status: StatusUsuario | null;
  data_cadastro: Date | null;
  data_ultimo_acesso: Date | null;
  data_expiracao_premium: Date | null;
  is_admin: boolean;
  criado_por: string | null;
  observacoes: string | null;
  criado_em: Date | null;
  atualizado_em: Date | null;
}

export interface ConfigSistema {
  id: string;
  chave: string;
  valor: string;
  descricao: string | null;
  criado_em: Date | null;
  atualizado_em: Date | null;
}

export interface LogAuditoria {
  id: string;
  user_id: string;
  acao: string;
  detalhes: string | null;  // JSON string
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Service DTOs
// ---------------------------------------------------------------------------

export interface DadosLancamento {
  data: string;                         // YYYY-MM-DD
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  categoria: string;
  pagamento: string;
  parcelamento_id?: string | null;
  parcela_atual?: number | null;
  total_parcelas?: number | null;
  recorrente?: boolean | null;
  recorrente_fim?: string | null;       // YYYY-MM-DD
  recorrente_id?: string | null;
  cartao_nome?: string | null;
  data_lancamento?: string | null;      // YYYY-MM-DD
  data_contabilizacao?: string | null;  // YYYY-MM-DD
  mes_fatura?: number | null;
  ano_fatura?: number | null;
  dia_vencimento?: number | null;
  status_fatura?: StatusFaturaLancamento | null;
  data_vencimento?: string | null;      // YYYY-MM-DD
}

export interface AnaliseTransacao {
  tipo: TipoLancamento;
  valor: number;
  categoria: string;
  formaPagamento: string;
  descricao: string;
  confianca: ConfiancaIA;
}

export interface ParsedIntent {
  intent: IntentType;
  confidence: number;                   // 0.0 – 1.0
  cardName?: string;
  month?: number;
  year?: number;
  status?: FaturaStatus;
  originalMessage: string;
  source: IntentSource;
}

// ---------------------------------------------------------------------------
// Redis state
// ---------------------------------------------------------------------------

export interface EstadoRedis {
  etapa: string;
  dadosParciais: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Billing cycle
// ---------------------------------------------------------------------------

export interface ReferenciaFatura {
  mes: number;   // 1-12
  ano: number;
  status: FaturaStatus;
  dataVencimento: Date;
}
