export type IntentType =
  | 'INVOICE_SUMMARY'
  | 'INVOICE_DETAIL'
  | 'CARD_PAYMENT_FORECAST'
  | 'CREATE_EXPENSE'
  | 'UNKNOWN';

export type IntentStatus = 'OPEN' | 'CLOSED';

export interface ParsedIntent {
  intent: IntentType;
  confidence: number;
  cardName?: string;
  month?: number;
  year?: number;
  status?: IntentStatus;
  originalMessage: string;
  source: 'LOCAL' | 'GEMINI' | 'LEGACY';
}

