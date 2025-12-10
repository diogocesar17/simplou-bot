// Tipos globais para o projeto (sem variáveis de estado globais)

// Interfaces para WhatsApp/Baileys
export interface WhatsAppSocket {
  sendMessage: (userId: string, message: any) => Promise<any>;
  ev: {
    on: (event: string, callback: (data: any) => void) => void;
  };
}

// Interfaces para usuários
export interface Usuario {
  user_id: string;
  nome: string;
  premium: boolean;
  data_expiracao_premium?: string;
  ativo: boolean;
  data_criacao: string;
  [key: string]: any;
}

// Interfaces para lançamentos
export interface Lancamento {
  id: string;
  user_id: string;
  valor: number;
  descricao: string;
  tipo: 'receita' | 'despesa';
  categoria: string;
  forma_pagamento: string;
  data: string;
  data_vencimento?: string;
  parcelado: boolean;
  parcelas?: number;
  parcela_atual?: number;
  recorrente: boolean;
  recorrencia_meses?: number;
  recorrencia_atual?: number;
  [key: string]: any;
}

// Interfaces para cartões
export interface Cartao {
  id: string;
  user_id: string;
  nome_cartao: string;
  dia_vencimento: number;
  dia_fechamento: number;
  limite?: number;
  ativo: boolean;
  [key: string]: any;
}

// Interfaces para alertas
export interface AlertaVencimento {
  cartoes: Cartao[];
  boletos: Lancamento[];
  temAlertas: boolean;
}

export interface EstadoUsuario {
  etapa: string;
  dados: any;
  timestamp: number;
}

export {}; 
