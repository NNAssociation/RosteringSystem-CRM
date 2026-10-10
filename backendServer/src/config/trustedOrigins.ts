export function trustedOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const configured = [env.PUBLIC_APP_URL, ...(env.ALLOWED_ORIGINS || "").split(",")];
  const origins = new Set<string>();
  for (const value of configured) {
    if (!value?.trim()) continue;
    const url = new URL(value.trim());
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("Trusted origins must be HTTP(S) URLs without credentials");
    }
    origins.add(url.origin);
  }
  if (env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }
  if (env.NODE_ENV === "production" && origins.size === 0) {
    throw new Error("Configure PUBLIC_APP_URL or ALLOWED_ORIGINS before starting in production");
  }
  return origins;
}

export function originAllowed(origin: string | undefined, origins: Set<string>): boolean {
  // Non-browser clients still pass through normal authentication and authorization.
  return origin === undefined || origins.has(origin);
}
