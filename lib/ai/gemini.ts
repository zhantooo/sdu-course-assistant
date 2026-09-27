/**
 * Thin Google Gemini client for the course assistant.
 *
 * Keys come from GEMINI_API_KEY_* in the environment (kept in .env.local, never
 * committed). Several keys are rotated so a rate-limited or dead key falls
 * through to the next one. Server-only — the key never reaches the browser.
 */
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export function geminiKeys(): string[] {
  return Object.entries(process.env)
    .filter(([name, value]) => /^GEMINI_API_KEY(_\d+)?$/.test(name) && !!value)
    .map(([, value]) => value as string);
}

export function isGeminiConfigured(): boolean {
  return geminiKeys().length > 0;
}

function model(): string {
  return process.env.GEMINI_MODEL || "gemini-3.6-flash";
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

/**
 * Generates a reply. `system` grounds the assistant in the student's data;
 * `history` is the running conversation. Throws only if every key fails.
 */
export async function generateReply(system: string, history: ChatTurn[]): Promise<string> {
  const keys = geminiKeys();
  if (keys.length === 0) throw new Error("No Gemini API key configured.");

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: history.map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.text }],
    })),
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1200,
      // Gemini 3.x "thinks" by default and would spend the whole budget on hidden
      // reasoning, returning empty text. Disable it for direct, fast answers.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  let lastError = "";
  for (const key of keys) {
    try {
      const response = await fetch(`${ENDPOINT}/${model()}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as GeminiResponse;
      if (!response.ok) {
        lastError = data.error?.message ?? `HTTP ${response.status}`;
        continue; // try the next key
      }
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
      if (text.trim()) return text.trim();
      lastError = "Empty response from Gemini.";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError || "Gemini request failed.");
}
