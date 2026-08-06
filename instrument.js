import 'dotenv/config';
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0,
    environment: process.env.NODE_ENV ?? 'production',
  });
  console.log('Sentry: initialized — real-time alerts active');
} else {
  console.log('Sentry: SENTRY_DSN not set — error alerting disabled');
}
