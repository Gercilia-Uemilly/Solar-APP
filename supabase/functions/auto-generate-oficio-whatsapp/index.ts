// Auto-generate the official ofício text for records inserted by the
// WhatsApp/n8n bot. Triggered by a Postgres trigger on `oficios` whenever
// origem='whatsapp_bot' AND ia_pendente=true. Reuses the same logic as
// the manual "Gerar Texto com IA" button by invoking the generate-oficio
// edge function with the same payload, then writes the result back.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Internal-only endpoint: require shared secret (used by DB trigger via pg_net)
    const expected = Deno.env.get("INTERNAL_WEBHOOK_SECRET") || "";
    const provided = req.headers.get("x-internal-secret") || "";
    if (!expected || provided !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const oficioId: string | undefined = body?.oficio_id || body?.record?.id;
    if (!oficioId) {
      return new Response(JSON.stringify({ error: "oficio_id ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Carrega o ofício
    const { data: oficio, error: loadErr } = await admin
      .from("oficios")
      .select("*")
      .eq("id", oficioId)
      .maybeSingle();
    if (loadErr) throw loadErr;
    if (!oficio) {
      return new Response(JSON.stringify({ error: "ofício não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Segurança: só processa o que veio do bot e ainda não foi gerado pela IA.
    // (Não dependemos mais de ia_pendente: o n8n às vezes envia false e
    //  os ofícios ficavam com o template cru.)
    const origemNormalizada = (oficio.origem || "").toLowerCase();
    const origensAceitas = ["whatsapp_bot", "whatsapp"];
    const elegivel =
      origensAceitas.includes(origemNormalizada) &&
      oficio.ia_pendente === true &&
      oficio.ia_gerada !== true;
    if (!elegivel) {
      return new Response(JSON.stringify({
        skipped: true,
        reason: "não elegível para geração automática",
        origem: oficio.origem,
        ia_pendente: oficio.ia_pendente,
        ia_gerada: oficio.ia_gerada,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const descricaoBruta = (oficio.conteudo || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (descricaoBruta.length < 10) {
      return new Response(JSON.stringify({ error: "descrição muito curta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reaproveita EXATAMENTE a mesma lógica do botão "Gerar Texto com IA".
    // Sempre passa "Solicitação" como tipo para que a detecção automática de
    // secretaria pelo conteúdo da descrição seja usada (evita mapeamentos
    // errados vindos do n8n, ex.: tapa-buraco -> "Obras").
    const payload = {
      assunto: oficio.assunto || "",
      destinatario: oficio.destinatario || "",
      descricao: descricaoBruta,
      tipo: "Solicitação",
      solicitante: oficio.solicitante || "",
      bairro: oficio.bairro || "",
      prioridade: oficio.urgencia === "urgente" ? "Urgente" : "Normal",
      local: oficio.endereco_completo || oficio.local_demanda || "",
    };

    const genResp = await fetch(`${SUPABASE_URL}/functions/v1/generate-oficio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
      },
      body: JSON.stringify(payload),
    });

    if (!genResp.ok) {
      const errText = await genResp.text();
      console.error("generate-oficio falhou:", genResp.status, errText);
      // Não apaga o ofício — apenas mantém ia_pendente=true para o operador clicar manualmente
      return new Response(JSON.stringify({ error: "Falha ao gerar texto", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await genResp.json();
    let oficioText: string = data.oficio || data.text || "";

    // Defesa em profundidade: se vier um JSON serializado dentro de oficio, extrai o HTML.
    if (typeof oficioText === "string" && oficioText.trim().startsWith("{") && oficioText.includes('"oficio"')) {
      try {
        const reparsed = JSON.parse(oficioText);
        if (reparsed?.oficio) oficioText = reparsed.oficio;
      } catch {
        const m = oficioText.match(/"oficio"\s*:\s*"((?:\\.|[^"\\])*)"/);
        if (m) oficioText = m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
      }
    }
    // Limpa qualquer cauda de JSON que tenha vazado.
    if (typeof oficioText === "string") {
      oficioText = oficioText
        .replace(/^\s*\{\s*"oficio"\s*:\s*"/, "")
        .replace(/"\s*,\s*"assunto_sugerido"[\s\S]*$/, "")
        .replace(/,?\s*"assunto_sugerido"[\s\S]*$/, "")
        .replace(/,?\s*"secretaria_identificada"[\s\S]*$/, "")
        .replace(/,?\s*"tipo_demanda"[\s\S]*$/, "")
        .replace(/,?\s*"urgencia"[\s\S]*$/, "")
        .replace(/,?\s*"sugestoes_melhoria"[\s\S]*$/, "")
        .replace(/\}\s*$/, "")
        .replace(/["}\s,]+$/g, "")
        .trim();
    }

    if (!oficioText) {
      return new Response(JSON.stringify({ error: "Resposta vazia da IA" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reserva número se ainda não houver
    let numeroReservado: string | null = null;
    const numeroAtual = (oficio.numero || "").trim();
    const semNumero = !numeroAtual || /n[º°o]?\s*_+/i.test(numeroAtual) || numeroAtual.toLowerCase() === "ofício gvf n° ___";
    if (semNumero) {
      const ano = oficio.ano || new Date().getFullYear();
      const { data: numData, error: numErr } = await admin.rpc("reservar_proximo_numero", {
        p_ano: ano,
        p_user_id: oficio.author_id || "00000000-0000-0000-0000-000000000000",
        p_user_nome: oficio.operador_nome || "WhatsApp Bot",
      });
      if (!numErr && numData) {
        numeroReservado = `Ofício GVF n° ${numData}/${ano}`;
      } else {
        console.warn("Falha ao reservar número:", numErr?.message);
      }
    }

    const updatePayload: Record<string, any> = {
      conteudo: oficioText,
      ia_pendente: false,
      ia_gerada: true,
      // Ofícios do Agente Jr (origem: "whatsapp") ficam com status "concluido"
      // para o n8n detectar e enviar de volta ao WhatsApp originador.
      // Demais (whatsapp_bot / tapa-buraco) seguem como "Finalizado".
      status: origemNormalizada === "whatsapp" ? "concluido" : "Finalizado",
      resposta_cidadao: oficio.resposta_cidadao || data.resposta_cidadao || null,
      updated_at: new Date().toISOString(),
    };
    if (numeroReservado) updatePayload.numero = numeroReservado;
    if (data.assunto_sugerido && !oficio.assunto) updatePayload.assunto = data.assunto_sugerido;
    if (data.secretaria_identificada && !oficio.secretaria_identificada) {
      updatePayload.secretaria_identificada = data.secretaria_identificada;
    }
    // Sempre sobrescreve secretaria detectada pela IA (descrição é a fonte da verdade
    // para ofícios vindos do bot — o n8n pode ter mandado a secretaria errada).
    if (data.secretaria_identificada) {
      updatePayload.secretaria_identificada = data.secretaria_identificada;
    }

    const { error: updErr } = await admin
      .from("oficios")
      .update(updatePayload)
      .eq("id", oficioId);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ success: true, oficio_id: oficioId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("auto-generate-oficio-whatsapp erro:", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});