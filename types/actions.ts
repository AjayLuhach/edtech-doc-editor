// Discriminated result for server actions — thrown errors get masked in production, codes don't.
export type ActionError = "unauthorized" | "forbidden" | "not-found" | "invalid" | "server";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: ActionError; message?: string };
