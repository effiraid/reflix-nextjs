import * as Sentry from "@sentry/nextjs";
import { getClientSentryConfig } from "@/lib/observability";

const sentry = getClientSentryConfig();

if (sentry.enabled) {
  Sentry.init({
    dsn: sentry.dsn,
    tracesSampleRate: sentry.tracesSampleRate,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
