import { config } from "../config.js";

export interface ChatInput {
  role: "system" | "user" | "assistant";
  content: string;
}

function enabled(model: string) {
  return Boolean(config.ai.baseUrl && model);
}

async function request(path: string, body: unknown) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= config.ai.maxRetries; attempt += 1) {
    try {
      const response = await fetch(`${config.ai.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.ai.baseUrl.includes("openrouter.ai") ? {
            "HTTP-Referer": config.origin,
            "X-Title": "Personal Knowledge Base",
          } : {}),
          ...(config.ai.apiKey ? { Authorization: `Bearer ${config.ai.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.ai.timeoutMs),
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(`AI 服务请求失败 (${response.status}): ${JSON.stringify(payload)}`);
      }
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < config.ai.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function isChatConfigured() {
  return enabled(config.ai.chatModel);
}

export function isEmbeddingConfigured() {
  return enabled(config.ai.embeddingModel);
}

export async function chatCompletion(messages: ChatInput[]) {
  if (!isChatConfigured()) return null;
  const payload = await request("/chat/completions", {
    model: config.ai.chatModel,
    messages,
    temperature: 0.2,
  });
  const choices = payload.choices as Array<{ message?: { content?: string }}> | undefined;
  return choices?.[0]?.message?.content?.trim() ?? "";
}

export async function embedTexts(input: string[]) {
  if (!isEmbeddingConfigured()) return null;
  const payload = await request("/embeddings", {
    model: config.ai.embeddingModel,
    input,
  });
  const rawData = (payload.data ?? payload.embeddings) as Array<{ embedding?: number[]; index?: number } | number[]> | undefined;
  const data = rawData?.map((item, index) => Array.isArray(item) ? { embedding: item, index } : item);
  if (!data?.length || data.some((item) => !item.embedding)) {
    throw new Error("Embedding 服务返回了无效结果");
  }
  return [...data]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((item) => item.embedding as number[]);
}

export function configuredModelName() {
  return config.ai.chatModel || null;
}
