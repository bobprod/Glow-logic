import { API_BASE } from "../lib/config";

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMProvider =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "opencode"
  | "gemini"
  | "deepseek"
  | "qwen"
  | "nvidia"
  | "huggingface";

export async function chatWithLLM(
  provider: LLMProvider,
  messages: LLMMessage[],
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  }
) {
  const res = await fetch(`${API_BASE}/api/llm/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      messages,
      ...options,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function testLLMKey(provider: LLMProvider) {
  return chatWithLLM(provider, [
    { role: "user", content: "Réponds uniquement 'OK'" },
  ]);
}
