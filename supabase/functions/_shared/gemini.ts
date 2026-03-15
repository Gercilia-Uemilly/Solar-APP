// Shared Gemini API helper for all edge functions

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GeminiMessage {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiRequest {
  model?: string;
  systemInstruction?: string;
  messages: GeminiMessage[];
  tools?: any[];
  toolConfig?: any;
}

interface GeminiResponse {
  text: string;
  toolCalls?: any[];
  raw: any;
}

export async function callGemini(opts: GeminiRequest): Promise<GeminiResponse> {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY não configurada");

  const model = opts.model || "gemini-2.5-flash";
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;

  const body: any = {
    contents: opts.messages.map(m => ({
      role: m.role,
      parts: m.parts,
    })),
    generationConfig: {
      temperature: 1,
      maxOutputTokens: 8192,
    },
  };

  if (opts.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: opts.systemInstruction }],
    };
  }

  if (opts.tools) {
    body.tools = opts.tools;
  }
  if (opts.toolConfig) {
    body.toolConfig = opts.toolConfig;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini API error:", response.status, errText);
    
    if (response.status === 429) {
      throw Object.assign(new Error("Limite de requisições excedido. Tente novamente."), { status: 429 });
    }
    if (response.status === 403) {
      throw Object.assign(new Error("Chave da API inválida ou sem permissão."), { status: 403 });
    }
    throw Object.assign(new Error(`Erro Gemini: ${response.status}`), { status: response.status });
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
  const toolCallParts = parts.filter((p: any) => p.functionCall);

  return {
    text: textParts.join(""),
    toolCalls: toolCallParts.length > 0 ? toolCallParts : undefined,
    raw: data,
  };
}

// Helper to convert OpenAI-style system+user to Gemini format
export function toGeminiMessages(systemPrompt: string | null, userPrompt: string): { systemInstruction?: string; messages: GeminiMessage[] } {
  return {
    systemInstruction: systemPrompt || undefined,
    messages: [{ role: "user", parts: [{ text: userPrompt }] }],
  };
}

// Helper for multimodal (image/audio) requests
export function toGeminiMultimodal(parts: GeminiPart[], systemPrompt?: string): { systemInstruction?: string; messages: GeminiMessage[] } {
  return {
    systemInstruction: systemPrompt,
    messages: [{ role: "user", parts }],
  };
}
