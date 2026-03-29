type ObservabilityEnv = Record<string, string | undefined>;

function readTrimmed(
  env: ObservabilityEnv,
  key: keyof ObservabilityEnv
): string | undefined {
  const value = env[key];
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function shouldEnableWebAnalytics(
  env: ObservabilityEnv = process.env
) {
  return Boolean(env.VERCEL === "1" || env.VERCEL_ENV);
}

export function shouldEnableSpeedInsights(
  env: ObservabilityEnv = process.env
) {
  return Boolean(
    env.VERCEL === "1" ||
      env.VERCEL_ENV ||
      env.REACT_APP_VERCEL_OBSERVABILITY_BASEPATH ||
      env.REACT_APP_VERCEL_OBSERVABILITY_CLIENT_CONFIG
  );
}

export function getSentryDsn(env: ObservabilityEnv = process.env) {
  return readTrimmed(env, "NEXT_PUBLIC_SENTRY_DSN") ?? "";
}

export function isSentryConfigured(env: ObservabilityEnv = process.env) {
  return getSentryDsn(env).length > 0;
}

export function getSentryEnvironment(env: ObservabilityEnv = process.env) {
  return (
    readTrimmed(env, "SENTRY_ENVIRONMENT") ??
    readTrimmed(env, "VERCEL_ENV") ??
    readTrimmed(env, "NODE_ENV") ??
    "development"
  );
}

export function getSentryTracesSampleRate(
  env: ObservabilityEnv = process.env
) {
  const raw =
    readTrimmed(env, "NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE") ??
    readTrimmed(env, "SENTRY_TRACES_SAMPLE_RATE");
  const parsed = raw ? Number(raw) : Number.NaN;

  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
    return parsed;
  }

  return env.NODE_ENV === "development" ? 1 : 0;
}

export function getClientSentryConfig() {
  const dsn = getSentryDsn();
  return {
    dsn,
    enabled: isSentryConfigured(),
    tracesSampleRate: getSentryTracesSampleRate(),
  };
}
