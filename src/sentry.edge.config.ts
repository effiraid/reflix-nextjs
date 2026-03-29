import * as Sentry from "@sentry/nextjs";
import {
  getSentryDsn,
  getSentryEnvironment,
  getSentryTracesSampleRate,
  isSentryConfigured,
} from "@/lib/observability";

if (isSentryConfigured()) {
  Sentry.init({
    dsn: getSentryDsn(),
    environment: getSentryEnvironment(),
    tracesSampleRate: getSentryTracesSampleRate(),
  });
}
