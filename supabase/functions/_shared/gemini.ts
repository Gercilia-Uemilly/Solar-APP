// Shared AI helper — uses Lovable AI Gateway (OpenAI-compatible)
// Keeps the same interface so all edge functions work without changes.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

// Map short Gemini model names to gateway model IDs
function mapModel(m?: string): string {
  if (!m) return "google/gemini-3-flash-preview";
  if (m.startsWith("google/") || m.startsWith("openai/")) return m;
  // Map short names: "gemini-2.5-flash-lite" → "google/gemini-2.5-flash-lite"
  const modelMap: Record<string, string> = {
    "gemini-2.5-flash": "google/gemini-2.5-flash",
    "gemini-2.5-flash-lite": "google/gemini-2.5-flash-lite",
    "gemini-2.5-pro": "google/gemini-2.5-pro",
  };
  return modelMap[m] || `google/${m}`;
}

// Convert GeminiPart[] to OpenAI content array
function partsToContent(parts: GeminiPart[]): any {
  if (parts.length === 1 && parts[0].text && !parts[0].inlineData) {
    return parts[0].text;
  }
  return parts.map((p) => {
    if (p.inlineData) {
      return {
        type: "image_url" as const,
        image_url: {
          url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`,
        },
      };
    }
    return { type: "text" as const, text: p.text || "" };
  });
}

// Convert Gemini-style tools to OpenAI-style tools
function convertTools(tools?: any[]): any[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  const out: any[] = [];
  for (const t of tools) {
    if (t.functionDeclarations) {
      for (const fd of t.functionDeclarations) {
        out.push({
          type: "function",
          function: {
            name: fd.name,
            description: fd.description || "",
            parameters: fd.parameters || {},
          },
        });
      }
    } else {
      out.push(t);
    }
  }
  return out;
}

function convertToolConfig(toolConfig?: any, tools?: any[]): any {
  if (!toolConfig) return undefined;
  const fcc = toolConfig.functionCallingConfig;
  if (fcc?.mode === "ANY" && fcc.allowedFunctionNames?.length === 1) {
    return { type: "function", function: { name: fcc.allowedFunctionNames[0] } };
  }
  return undefined;
}

export async function callGemini(opts: GeminiRequest): Promise<GeminiResponse> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

  const openaiMessages: any[] = [];

  if (opts.systemInstruction) {
    openaiMessages.push({ role: "system", content: opts.systemInstruction });
  }

  for (const m of opts.messages) {
    openaiMessages.push({
      role: m.role === "model" ? "assistant" : "user",
      content: partsToContent(m.parts),
    });
  }

  const body: any = {
    model: mapModel(opts.model),
    messages: openaiMessages,
    temperature: 1,
    max_tokens: 8192,
  };

  const convertedTools = convertTools(opts.tools);
  if (convertedTools) {
    body.tools = convertedTools;
  }
  const toolChoice = convertToolConfig(opts.toolConfig, opts.tools);
  if (toolChoice) {
    body.tool_choice = toolChoice;
  }

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI Gateway error:", response.status, errText);

    if (response.status === 429) {
      throw Object.assign(new Error("Limite de requisições excedido. Tente novamente."), { status: 429 });
    }
    if (response.status === 402) {
      throw Object.assign(new Error("Créditos insuficientes no Lovable AI. Adicione créditos."), { status: 402 });
    }
    if (response.status === 403) {
      throw Object.assign(new Error("Chave da API inválida ou sem permissão."), { status: 403 });
    }
    throw Object.assign(new Error(`Erro AI Gateway: ${response.status}`), { status: response.status });
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const message = choice?.message;

  // Extract text
  const text = message?.content || "";

  // Extract tool calls — convert OpenAI format back to Gemini-style for compatibility
  let toolCalls: any[] | undefined;
  if (message?.tool_calls && message.tool_calls.length > 0) {
    toolCalls = message.tool_calls.map((tc: any) => ({
      functionCall: {
        name: tc.function?.name,
        args: typeof tc.function?.arguments === "string"
          ? JSON.parse(tc.function.arguments)
          : tc.function?.arguments,
      },
    }));
  }

  return { text, toolCalls, raw: data };
}

// Helper to convert system+user to Gemini format (unchanged interface)
export function toGeminiMessages(systemPrompt: string | null, userPrompt: string): { systemInstruction?: string; messages: GeminiMessage[] } {
  return {
    systemInstruction: systemPrompt || undefined,
    messages: [{ role: "user", parts: [{ text: userPrompt }] }],
  };
}

// Helper for multimodal requests (unchanged interface)
export function toGeminiMultimodal(parts: GeminiPart[], systemPrompt?: string): { systemInstruction?: string; messages: GeminiMessage[] } {
  return {
    systemInstruction: systemPrompt,
    messages: [{ role: "user", parts }],
  };
}
