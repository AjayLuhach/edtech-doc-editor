// Read a request body as text with a hard byte budget, returning null once it exceeds the limit.
// Unlike a Content-Length check this also bounds chunked / header-less bodies, so it cannot be bypassed.
export async function readBoundedText(request: Request, maxBytes: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let total = 0;
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}
