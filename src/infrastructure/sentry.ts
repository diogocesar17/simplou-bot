import * as Sentry from '@sentry/node';

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, environment: process.env.NODE_ENV ?? 'production' });
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err, { extra: context });
  }
}
