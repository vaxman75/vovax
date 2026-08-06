import * as Sentry from '@sentry/node';

export function captureError(err, tags = {}) {
  Sentry.withScope(scope => {
    for (const [k, v] of Object.entries(tags)) scope.setTag(k, String(v));
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
  });
}

export function sentryErrorHandler(app) {
  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }
}
