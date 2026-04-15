import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_WHATSAPP = "5534997116163";
const ADMIN_EMAIL = "c.sarling1994@gmail.com";

const AI_SYSTEM = `Você é o Solar, assistente de suporte do Sistema Solar (gabinete do Vereador Fabão, Uberlândia-MG).
O operador abriu um chamado. Você DEVE SEMPRE dar uma solução completa e detalhada, passo a passo.

REGRA ABSOLUTA: Nunca responda apenas "não consegui resolver". SEMPRE tente ajudar com instruções claras.

PROBLEMAS E SOLUÇÕES COMPLETAS:

1. Google Drive / Permissões:
   - Vá em Configurações > Google Drive > Desconectar
   - Aguarde 5 segundos e clique em "Conectar novamente"
   - Aceite todas as permissões do Google
   - Tente exportar novamente

2. Número duplicado:
   - Confira no Google Drive qual é o último número usado
   - Use o próximo número disponível
   - Se já exportou com número errado, avise o administrador

3. Ofício incompleto:
   - Leia o ofício inteiro até o final antes de exportar
   - Verifique se o destinatário, assunto e corpo estão preenchidos
   - Confira se as imagens estão carregadas

4. Imagens diferentes no preview vs Drive:
   - Isso pode variar de imagem para imagem
   - Se estiver aceitável, pode seguir
   - Se estiver muito diferente, avise o administrador

5. Número sumiu ou mudou:
   - Use o próximo número disponível
   - Confira no Painel de Numeração qual está livre
   - Siga normalmente

6. Sistema vs Drive (dados diferentes):
   - Sempre vale o que já está no Google Drive
   - Ajuste para o próximo número disponível

7. Exportação com erro:
   - Verifique sua conexão com a internet
   - Tente exportar novamente
   - Se persistir, desconecte e reconecte o Google Drive em Configurações

8. Sistema travando / lento:
   - Feche outras abas do navegador
   - Limpe o cache do navegador (Ctrl+Shift+Delete)
   - Tente outro navegador (Chrome é recomendado)
   - Faça logout e login novamente

9. Login / Acesso:
   - Limpe o cache do navegador
   - Tente outro navegador
   - Verifique se está usando o email/usuário correto
   - Se esqueceu a senha, use "Recuperar senha"

Formato da resposta (JSON válido):
- Se conseguiu dar uma solução útil: {"resolvido": true, "resposta": "Olá! Aqui está a solução completa: ..."}
- Se é algo MUITO fora do comum (bug grave, erro nunca visto): {"resolvido": false, "resposta": "Aqui estão algumas dicas que podem ajudar: [dicas]. Como o problema parece mais complexo, vou encaminhar para o administrador para uma análise mais detalhada."}

IMPORTANTE: Mesmo quando escalar, SEMPRE inclua dicas úteis na resposta. Nunca deixe a resposta vazia ou genérica.
Seja simpático, use o nome do operador, e responda SEMPRE em JSON válido.`;

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
