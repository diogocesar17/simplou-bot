import type { ParsedIntent, IntentStatus, IntentType } from './intentTypes';

function removerAcentos(texto: string): string {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizarMensagem(message: string): string {
  const lower = removerAcentos(String(message || '')).toLowerCase();
  const semPontuacao = lower.replace(/[!?.,;:()[\]{}"']/g, ' ');
  const normalizado = semPontuacao
    .replace(/\s+/g, ' ')
    .replace(/\s*([\/\-])\s*/g, '$1')
    .trim();
  return normalizado;
}

const MES_POR_PALAVRA: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

function anoAtual(): number {
  return new Date().getFullYear();
}

function extrairStatus(normalized: string): IntentStatus | undefined {
  if (/\bfechad[ao]s?\b/.test(normalized) || /\bfechou\b/.test(normalized) || /\ba pagar\b/.test(normalized)) return 'CLOSED';
  if (/\babert[ao]s?\b/.test(normalized) || /\bem aberto\b/.test(normalized) || /\batual\b/.test(normalized)) return 'OPEN';
  return undefined;
}

function tokenize(original: string): string[] {
  return String(original || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function extrairMesAno(tokensNorm: string[]): { month?: number; year?: number; consumed: Set<number> } {
  let month: number | undefined;
  let year: number | undefined;
  const consumed = new Set<number>();

  for (let i = 0; i < tokensNorm.length; i++) {
    const t = tokensNorm[i];
    const mmYyyy = t.match(/^(\d{1,2})[\/\-](\d{2,4})$/);
    if (mmYyyy && month === undefined) {
      const mm = parseInt(mmYyyy[1], 10);
      let yy = parseInt(mmYyyy[2], 10);
      if (yy < 100) yy += 2000;
      if (mm >= 1 && mm <= 12) {
        month = mm;
        year = yy;
        consumed.add(i);
      }
      continue;
    }

    const mes = MES_POR_PALAVRA[t];
    if (mes && month === undefined) {
      month = mes;
      consumed.add(i);
      const prox = tokensNorm[i + 1];
      if (prox && /^\d{2,4}$/.test(prox)) {
        let yy = parseInt(prox, 10);
        if (yy < 100) yy += 2000;
        year = yy;
        consumed.add(i + 1);
      }
      continue;
    }

    if (month !== undefined && year === undefined && /^\d{4}$/.test(t)) {
      year = parseInt(t, 10);
      consumed.add(i);
      continue;
    }
  }

  if (month !== undefined && year === undefined) year = anoAtual();
  return { month, year, consumed };
}

function isLikelyLancamento(normalized: string): boolean {
  if (!normalized) return false;
  const temNumero = /\d/.test(normalized);
  if (!temNumero) return false;

  const verbos = /(gastei|paguei|recebi|ganhei|lancei|lancar|lançar|lança|lanca|entrada|saida|saída|debitei|debitou|pix|transferi|transferencia|transferência)/;
  if (verbos.test(normalized)) return true;

  if (/^(r\$)?\s*\d+([.,]\d{1,2})?\b/.test(normalized)) return true;
  return false;
}

function removeStopwords(tokens: string[]): string[] {
  const stop = new Set(['da', 'do', 'de', 'no', 'na', 'dos', 'das', 'em', 'meu', 'minha', 'minhas', 'meus', 'o', 'a', 'os', 'as', 'um', 'uma']);
  return tokens.filter(t => !stop.has(t));
}

function extrairCardName(originalTokens: string[], tokensNorm: string[], consumed: Set<number>): string | undefined {
  const comandos = new Set([
    'fatura',
    'detalhar',
    'compras',
    'ver',
    'mostrar',
    'lancamentos',
    'lançamentos',
    'cartao',
    'cartão',
    'valor',
    'quanto',
    'qual',
    'proximas',
    'próximas',
    'pagar',
    'fechada',
    'fechado',
    'aberta',
    'aberto',
    'fechou',
    'resumo',
    'total',
  ]);

  const kept: string[] = [];
  for (let i = 0; i < tokensNorm.length; i++) {
    if (consumed.has(i)) continue;
    const t = tokensNorm[i];
    if (!t) continue;
    if (comandos.has(t)) continue;
    kept.push(originalTokens[i]);
  }

  const cleaned = removeStopwords(kept.map(t => normalizarMensagem(t))).join(' ').trim();
  return cleaned || undefined;
}

function build(intent: IntentType, confidence: number, originalMessage: string, source: ParsedIntent['source'], extra?: Partial<ParsedIntent>): ParsedIntent {
  const base: ParsedIntent = {
    intent,
    confidence,
    originalMessage,
    source,
  };
  return { ...base, ...(extra || {}) };
}

export function parseIntentLocal(message: string): ParsedIntent {
  const originalMessage = String(message || '');
  const normalized = normalizarMensagem(originalMessage);

  if (!normalized) return build('UNKNOWN', 0, originalMessage, 'LOCAL');

  if (isLikelyLancamento(normalized)) {
    return build('CREATE_EXPENSE', 0.95, originalMessage, 'LOCAL');
  }

  // Intents de cartão/fatura/parcelamento estão congeladas no beta — retornar UNKNOWN
  // para que o messageDispatcher trate com mensagem "em breve" via rota explícita.
  return build('UNKNOWN', 0.1, originalMessage, 'LOCAL');
}
