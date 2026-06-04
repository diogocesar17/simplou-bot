import * as Sentry from '@sentry/node';

// Free plan cap: 5 000 events/month — we stop at 4 800 to leave headroom
const MONTHLY_CAP = 4_800;
let eventCount = 0;
let countMonth = new Date().getMonth();

function isActive(): boolean {
  return !!process.env.SENTRY_DSN && process.env.NODE_ENV === 'production';
}

function withinQuota(): boolean {
  const month = new Date().getMonth();
  if (month !== countMonth) {
    eventCount = 0;
    countMonth = month;
  }
  if (eventCount >= MONTHLY_CAP) return false;
  eventCount++;
  return true;
}

// Masks phone numbers, monetary values and WhatsApp IDs from strings
function mask(text: string): string {
  return text
    .replace(/\d{10,15}@s\.whatsapp\.net/g, '[PHONE]')
    .replace(/\b55\d{10,11}\b/g, '[PHONE]')
    .replace(/R\$\s*[\d.,]+/gi, '[VALUE]')
    .replace(/€\s*[\d.,]+/gi, '[VALUE]')
    .replace(/£\s*[\d.,]+/gi, '[VALUE]')
    .replace(/US\$\s*[\d.,]+/gi, '[VALUE]');
}

function sanitizeError(err: unknown): unknown {
  if (!(err instanceof Error)) return err;
  const clean = new Error(mask(err.message));
  clean.name = err.name;
  clean.stack = err.stack ? mask(err.stack) : err.stack;
  return clean;
}

function sanitizeContext(ctx: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(ctx).map(([k, v]) => [k, typeof v === 'string' ? mask(v) : v])
  );
}

export function initSentry(): void {
  if (!isActive()) return;
  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: 'production',
      tracesSampleRate: 0,      // desativa performance monitoring (economiza cota)
      beforeSend(event) {
        if (!withinQuota()) return null; // descarta quando cota esgotada
        // Segunda camada: scrub nos campos de texto do evento
        if (event.exception?.values) {
          for (const ex of event.exception.values) {
            if (ex.value) ex.value = mask(ex.value);
          }
        }
        return event;
      },
    });
  } catch {
    // falha do Sentry nunca deve derrubar o bot
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!isActive()) return;
  try {
    Sentry.captureException(sanitizeError(err), context ? { extra: sanitizeContext(context) } : undefined);
  } catch {
    // falha do Sentry nunca deve derrubar o bot
  }
}

export async function testeSentry(): Promise<{ ok: boolean; motivo?: string }> {
  if (!process.env.SENTRY_DSN) return { ok: false, motivo: 'SENTRY_DSN não configurado' };
  if (process.env.NODE_ENV !== 'production') return { ok: false, motivo: 'NODE_ENV não é production (atual: ' + (process.env.NODE_ENV ?? 'undefined') + ')' };
  try {
    const err = new Error('[TESTE] Verificação manual do Sentry — pode ignorar');
    err.name = 'SentryManualTest';
    Sentry.captureException(err);
    await Sentry.flush(3000);
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}
