// Shared by the session layer and proxy.ts; no server-only imports so the proxy can read it.
export const SESSION_COOKIE = "edtech_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
