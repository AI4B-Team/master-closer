/**
 * Shared-secret check for the project's own scheduled endpoints.
 *
 * The database scheduler (pg_cron + pg_net) sends `x-cron-key: CRON_INVOKE_KEY`.
 * Legacy callers that were configured with a feature-specific secret keep
 * working, so nothing external breaks when the built-in scheduler takes over.
 */
function sameSecret(provided: string, expected: string) {
  let diff = provided.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/**
 * Returns null when the caller is authorized, otherwise the Response to send.
 * `legacyEnvNames` are additional env vars whose value is also accepted.
 */
export function checkCronAuth(request: Request, legacyEnvNames: string[] = [], headerName = "x-cron-key") {
  const accepted = [process.env["CRON_INVOKE_KEY"], ...legacyEnvNames.map((n) => process.env[n])].filter(
    (v): v is string => !!v && v.length > 0,
  );
  if (accepted.length === 0) return new Response("Scheduler not configured", { status: 503 });

  const provided = request.headers.get(headerName) ?? request.headers.get("x-cron-key") ?? "";
  if (!accepted.some((expected) => sameSecret(provided, expected))) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
