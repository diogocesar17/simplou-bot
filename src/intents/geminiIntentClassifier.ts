import type { ParsedIntent, IntentType, IntentStatus } from './intentTypes';
import { normalizarMensagem } from './intentParser';
import * as geminiService from '../services/geminiService';

function isValidIntent(intent: any): intent is IntentType {
  return intent === 'INVOICE_SUMMARY' || intent === 'INVOICE_DETAIL' || intent === 'CARD_PAYMENT_FORECAST' || intent === 'CREATE_EXPENSE' || intent === 'UNKNOWN';
}

function clampConfidence(value: any): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizeStatus(value: any): IntentStatus | undefined {
  const v = normalizarMensagem(String(value || ''));
  if (v === 'open' || v === 'aberta' || v === 'aberto') return 'OPEN';
  if (v === 'closed' || v === 'fechada' || v === 'fechado') return 'CLOSED';
  return undefined;
}

export async function classifyIntentWithGemini(message: string): Promise<ParsedIntent> {
  const originalMessage = String(message || '');

  const unknown = (): ParsedIntent => ({
    intent: 'UNKNOWN',
    confidence: 0,
    originalMessage,
    source: 'GEMINI',
  });

  try {
    const prompt =
      'Você é um classificador de intenções para um chatbot financeiro de motoristas e entregadores.\n' +
      'Retorne APENAS JSON válido.\n' +
      'Não explique nada.\n\n' +
      'Intenções:\n' +
      '- CREATE_EXPENSE: usuário está lançando gasto/receita\n' +
      '- UNKNOWN: não entendeu\n\n' +
      'Extraia:\n' +
      'confidence de 0 a 1.\n\n' +
      'Exemplos:\n' +
      '"gastei 50 no mercado" =>\n' +
      '{"intent":"CREATE_EXPENSE","confidence":0.95}\n\n' +
      '"recebi 280 no uber" =>\n' +
      '{"intent":"CREATE_EXPENSE","confidence":0.95}\n\n' +
      '"abasteci 150 de gasolina" =>\n' +
      '{"intent":"CREATE_EXPENSE","confidence":0.95}\n\n' +
      '"oi tudo bem" =>\n' +
      '{"intent":"UNKNOWN","confidence":0.9}\n\n' +
      'Mensagem:\n' +
      `"${originalMessage.replace(/"/g, '\\"')}"\n`;

    const raw = await geminiService.gerarJSONComGemini(prompt);

    const intent: IntentType = isValidIntent(raw?.intent) ? raw.intent : 'UNKNOWN';
    const confidence = clampConfidence(raw?.confidence);
    const month = raw?.month !== undefined ? Number(raw.month) : undefined;
    const year = raw?.year !== undefined ? Number(raw.year) : undefined;
    const cardName = raw?.cardName ? String(raw.cardName) : undefined;
    const status = normalizeStatus(raw?.status);

    return {
      intent,
      confidence,
      month: Number.isFinite(month as any) ? month : undefined,
      year: Number.isFinite(year as any) ? year : undefined,
      cardName: cardName || undefined,
      status,
      originalMessage,
      source: 'GEMINI',
    };
  } catch {
    return unknown();
  }
}

