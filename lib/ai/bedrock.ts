import "server-only";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

// Cheap default: Gemma 27B on Bedrock (same model the resume-tailor scanner uses). Override with BEDROCK_MODEL.
const DEFAULT_MODEL = "google.gemma-3-27b-it";

let client: BedrockRuntimeClient | null = null;
function getClient(): BedrockRuntimeClient {
  if (client) return client;
  client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    },
  });
  return client;
}

// Pull the assistant text out of whichever body shape the model returned (Anthropic, OpenAI-style, or Vertex-style).
function textFrom(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const b = body as {
    content?: Array<{ text?: string }>;
    choices?: Array<{ message?: { content?: string }; text?: string }>;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (Array.isArray(b.content)) return b.content.map((c) => c.text ?? "").join("");
  if (Array.isArray(b.choices)) return b.choices[0]?.message?.content ?? b.choices[0]?.text ?? "";
  if (Array.isArray(b.candidates)) return b.candidates[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return "";
}

export interface CompleteOptions {
  maxTokens?: number;
  temperature?: number;
}

// Single prompt -> text. Uses the raw Bedrock InvokeModel API so the model is swappable via BEDROCK_MODEL.
export async function complete(prompt: string, options: CompleteOptions = {}): Promise<string> {
  const modelId = process.env.BEDROCK_MODEL || DEFAULT_MODEL;
  const isAnthropic = modelId.includes("anthropic");

  const payload: Record<string, unknown> = {
    messages: [{ role: "user", content: prompt }],
    max_tokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0.3,
  };
  // Anthropic models on Bedrock need the version marker; others use the plain OpenAI-style body.
  if (isAnthropic) payload.anthropic_version = "bedrock-2023-05-31";

  const command = new InvokeModelCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await getClient().send(command);
  const body: unknown = JSON.parse(new TextDecoder().decode(response.body));
  return textFrom(body).trim();
}
