import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_WHATSAPP = "5534997116163";
const ADMIN_EMAIL = "c.sarling1994@gmail.com";

const AI_SYSTEM = `Você é o suporte técnico do Sistema Solar (gabinete do Vereador Fabão, Uberlândia-MG).
O operador abriu um chamado. Analise o problema descrito e tente resolver com instruções claras.

PROBLEMAS QUE VOCÊ SABE RESOLVER:
- Google Drive: reconectar em Configurações > Google Drive > Desconectar > Conectar
- Número duplicado: usar próximo número, conferir no Drive antes
- Ofício incompleto: ler até o final antes de exportar
- Imagens diferentes: pode variar, se aceitável seguir, se não avisar admin
- Número sumiu: usar próximo disponível
- Sistema vs Drive: vale o Drive, ajustar próximo número
- Exportação: verificar conexão, tentar novamente
- Login/acesso: limpar cache, tentar outro navegador
- Formatação: verificar se conteúdo está correto antes de exportar

Se o problema está na lista acima, dê a solução completa e responda com:
{"resolvido": true, "resposta": "sua resposta"}

Se NÃO conseguir resolver ou for algo fora do comum (travamento, bug grave, erro desconhecido), responda com:
{"resolvido": false, "resposta": "Não consegui resolver automaticamente. Vou encaminhar para o administrador."}

Responda SEMPRE em JSON válido. Seja direto e simpático.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, category, screenshot_url, user_name, user_email, user_id } = await req.json();

    if (!description || !user_id) {
      return new Response(JSON.stringify({ error: "Descrição e user_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    // Step 1: Ask AI to try to resolve
    const aiPrompt = `Categoria: ${category || "geral"}
Operador: ${user_name || "Desconhecido"}
Descrição do problema: ${description}
${screenshot_url ? "O operador anexou um print do problema." : ""}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: AI_SYSTEM },
          { role: "user", content: aiPrompt },
        ],
        max_tokens: 1024,
      }),
    });

    let aiResult = { resolvido: false, resposta: "Não foi possível processar. Encaminhando ao administrador." };

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const raw = aiData.choices?.[0]?.message?.content || "";
      try {
        // Try to parse JSON from response
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiResult = JSON.parse(jsonMatch[0]);
        }
      } catch {
        aiResult = { resolvido: false, resposta: raw || "Erro ao processar resposta da IA." };
      }
    }

    // Step 2: Save ticket to DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const ticketData: any = {
      user_id,
      user_name: user_name || null,
      user_email: user_email || null,
      category: category || "geral",
      description,
      screenshot_url: screenshot_url || null,
      ai_response: aiResult.resposta,
      status: aiResult.resolvido ? "resolvido" : "escalado",
      escalated_at: aiResult.resolvido ? null : new Date().toISOString(),
    };

    const { data: ticket, error: insertError } = await supabase
      .from("support_tickets")
      .insert(ticketData)
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
    }

    // Step 3: If not resolved, escalate to WhatsApp + Email
    if (!aiResult.resolvido) {
      const ticketId = ticket?.id || "N/A";
      const msgText = `🚨 *CHAMADO #${ticketId.slice(0, 8)}*\n\n👤 Operador: ${user_name || "?"}\n📧 Email: ${user_email || "?"}\n📂 Categoria: ${category || "geral"}\n\n📝 *Problema:*\n${description}\n\n🤖 *IA tentou resolver:*\n${aiResult.resposta}\n\n${screenshot_url ? "📎 Print anexado" : "Sem print"}`;

      // Send WhatsApp via Z-API
      try {
        const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
        const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
        const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");

        if (ZAPI_INSTANCE_ID && ZAPI_TOKEN) {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (ZAPI_CLIENT_TOKEN) {
            headers["Client-Token"] = ZAPI_CLIENT_TOKEN;
          }

          await fetch(
            `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                phone: ADMIN_WHATSAPP,
                message: msgText,
              }),
            }
          );
        }
      } catch (e) {
        console.error("WhatsApp escalation error:", e);
      }

      // Create notification in DB for admin
      try {
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        if (admins?.length) {
          const notifications = admins.map((a: any) => ({
            user_id: a.user_id,
            titulo: "🚨 Novo chamado de suporte",
            mensagem: `${user_name || "Operador"} abriu um chamado: ${description.slice(0, 100)}...`,
          }));
          await supabase.from("notificacoes").insert(notifications);
        }
      } catch (e) {
        console.error("Notification error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        resolvido: aiResult.resolvido,
        resposta: aiResult.resposta,
        ticket_id: ticket?.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("handle-support-ticket error:", e);
    return new Response(
      JSON.stringify({ error: "Erro ao processar chamado." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
