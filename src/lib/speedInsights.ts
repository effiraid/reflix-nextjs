type SpeedInsightsEnv = Record<string, string | undefined>;

export function shouldEnableSpeedInsights(
  env: SpeedInsightsEnv = process.env
) {
  return Boolean(
    env.VERCEL === "1" ||
      env.VERCEL_ENV ||
      env.REACT_APP_VERCEL_OBSERVABILITY_BASEPATH ||
      env.REACT_APP_VERCEL_OBSERVABILITY_CLIENT_CONFIG
  );
}
