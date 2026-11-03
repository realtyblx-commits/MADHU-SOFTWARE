/**
 * Redacts API keys / JWTs / secrets from anything that hits the console.
 * Used by error-capture (server) and imported early on the client.
 */

const SECRET_PATTERNS: RegExp[] = [
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, // JWTs
  /sb_secret_[A-Za-z0-9_-]+/g,
  /sb_publishable_[A-Za-z0-9_-]+/g,
  /supabase_service_role_key["'\s:=]+[^\s"',}]+/gi,
  /service_role["'\s:=]+[^\s"',}]+/gi,
  /apikey["'\s:=]+[^\s"',}]+/gi,
  /authorization["'\s:=]+bearer\s+[^\s"',}]+/gi,
  /Bearer\s+eyJ[a-zA-Z0-9._-]+/g,
];

const ENV_KEY_NAMES =
  /(?:VITE_)?SUPABASE_(?:SERVICE_ROLE_KEY|SECRET_KEY|ANON_KEY|PUBLISHABLE_KEY)|SUPABASE_ACCESS_TOKEN/gi;

export function redactSecrets(input: unknown): string {
  let text: string;
  try {
    text = typeof input === "string" ? input : JSON.stringify(input) ?? String(input);
  } catch {
    text = String(input);
  }

  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }
  out = out.replace(ENV_KEY_NAMES, "[REDACTED_ENV]");
  return out;
}

export function sanitizeLogArg(arg: unknown): unknown {
  if (arg == null) return arg;
  if (typeof arg === "string") return redactSecrets(arg);
  if (arg instanceof Error) {
    const safe = new Error(redactSecrets(arg.message));
    safe.name = arg.name;
    if (arg.stack) safe.stack = redactSecrets(arg.stack);
    return safe;
  }
  if (typeof arg === "object") {
    try {
      return JSON.parse(redactSecrets(JSON.stringify(arg)));
    } catch {
      return redactSecrets(arg);
    }
  }
  return arg;
}

let patched = false;

/** Patch console.* once so keys never appear in browser or server logs. */
export function installSafeConsole(): void {
  if (patched || typeof console === "undefined") return;
  patched = true;

  const methods = ["log", "info", "warn", "error", "debug"] as const;
  for (const method of methods) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      original(...args.map(sanitizeLogArg));
    };
  }
}
