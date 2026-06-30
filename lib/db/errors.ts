// Drizzle wraps the driver error, so the Postgres SQLSTATE lives on the cause chain.
export function isRlsDenial(err: unknown): boolean {
  let cursor: unknown = err;
  for (let i = 0; cursor && typeof cursor === "object" && i < 5; i++) {
    if ((cursor as { code?: string }).code === "42501") return true;
    cursor = (cursor as { cause?: unknown }).cause;
  }
  return false;
}
