import * as Sentry from '@sentry/node';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('Sentry: SENTRY_DSN not set — real-time error alerting disabled');
    return;
  }
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    environment: process.env.NODE_ENV ?? 'production',
  });
  console.log('Sentry: initialized — real-time alerts active');
}

export function captureError(err, tags = {}) {
  if (!process.env.SENTRY_DSN) return;
  Sentry.withScope(scope => {
    for (const [k, v] of Object.entries(tags)) scope.setTag(k, String(v));
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
  });
}

export function sentryErrorHandler(app) {
  if (!process.env.SENTRY_DSN) return;
  Sentry.setupExpressErrorHandler(app);
}
