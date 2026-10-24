import { config } from './config.js';
import * as Sentry from '@sentry/node';
if (process.env.SENTRY_DSN)
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: config.APP_ENV,
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.user;
      for (const crumb of event.breadcrumbs || [])
        if (crumb.data?.url) crumb.data.url = String(crumb.data.url).split('?')[0];
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.data;
        if (event.request.url) event.request.url = event.request.url.split('?')[0];
      }
      return event;
    },
  });
export function reportError(error: unknown) {
  if (process.env.SENTRY_DSN)
    Sentry.captureException(
      error instanceof Error ? new Error(error.message) : new Error('Unexpected server error'),
    );
}
