// Auto-generate the official ofício text for records inserted by the
// WhatsApp/n8n bot. Triggered by a Postgres trigger on `oficios` whenever
// origem='whatsapp_bot' AND ia_pendente=true. Reuses the same logic as
// the manual "Gerar Texto com IA" button by invoking the generate-oficio
// edge function with the same payload, then writes the result back.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buscarContatoPorTelefone, normalizePhoneBR as normalizePhonePlanilha } from "../_shared/zapReqContatos.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORIGENS_AUTOMATICAS = ["whatsapp_bot", "whatsapp", "whatsapp_equipe", "whatsapp ia"];

function normalizePhoneBR(raw: string | null | undefined): string {
  if (!raw) return "";
  let d = String(raw).replace(/\D/g, "");
  if (!d) return "";
  if (d.length >= 10 && d.length <= 11 && !d.startsWith("55")) d = "55" + d;
  return d.length >= 12 ? d : "";
}

function resolveZapiSendUrl(instance?: string | null, token?: string | null) {
  const inst = (instance || "").trim();
  const tok = (token || "").trim();
  if (!inst || !tok) return "";
  if (/^https?:\/\//i.test(inst)) {
    try {
      const u = new URL(inst);
      const m = u.pathname.match(/\/instances\/([^/]+)\/token\/([^/]+)/i);
      if (m) return `${u.protocol}//${u.host}/instances/${m[1]}/token/${m[2]}/send-text`;
    } catch { /* */ }
  }
  return `https://api.z-api.io/instances/${inst}/token/${tok}/send-text`;
}

function htmlToPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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
    const origensAceitas = ORIGENS_AUTOMATICAS;
    // Aceita qualquer origem que comece com "whatsapp" e ainda não tenha sido
    // finalizada pela IA. Não dependemos mais de ia_pendente porque o n8n
    // frequentemente envia false e os ofícios ficavam com template cru.
    const elegivel =
      (origensAceitas.includes(origemNormalizada) || origemNormalizada.startsWith("whatsapp")) &&
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
    const contatoPlanilha =
      buscarContatoPorTelefone(oficio.linha_telefonica) ||
      buscarContatoPorTelefone(oficio.telefone_recebimento);
    const telefonePlanilha = contatoPlanilha ? normalizePhonePlanilha(contatoPlanilha.telefone) : "";
    const operadorResolvido = contatoPlanilha?.nome || oficio.operador_nome || "Agente JR";

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
        p_user_nome: operadorResolvido,
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
      // Status reconhecido pelo Solar como finalizado e que marca a numeração como usada.
      status: "Protocolado",
      resposta_cidadao: oficio.resposta_cidadao || data.resposta_cidadao || null,
      operador_nome: operadorResolvido,
      updated_at: new Date().toISOString(),
    };
    if (numeroReservado) updatePayload.numero = numeroReservado;
    if (telefonePlanilha && !oficio.telefone_recebimento) updatePayload.telefone_recebimento = telefonePlanilha;
    if (contatoPlanilha?.codigo && !oficio.codigo_z) updatePayload.codigo_z = contatoPlanilha.codigo;
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

    // Devolver o ofício finalizado via WhatsApp para a linha do operador que originou a demanda.
    let whatsappEnvio: any = { skipped: true };
    try {
      if (origensAceitas.includes(origemNormalizada)) {
        const destino =
          normalizePhoneBR(oficio.linha_telefonica) ||
          normalizePhoneBR(oficio.telefone_recebimento) ||
          telefonePlanilha;
        const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
        const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
        const ZAPI_CLIENT_TOKEN = (Deno.env.get("ZAPI_CLIENT_TOKEN") || "").trim();
        const zapiUrl = resolveZapiSendUrl(ZAPI_INSTANCE_ID, ZAPI_TOKEN);
        if (destino && zapiUrl) {
          const numeroFinal = numeroReservado || oficio.numero || "(s/nº)";
          const corpo = htmlToPlainText(oficioText);
          const header = `✅ *Ofício finalizado*\n${numeroFinal}\nAssunto: ${updatePayload.assunto || oficio.assunto || "-"}\n\n`;
          // WhatsApp trunca mensagens muito grandes; envie em blocos de ~3500 chars
          const partes: string[] = [];
          const full = header + corpo;
          const CHUNK = 3500;
          for (let i = 0; i < full.length; i += CHUNK) partes.push(full.slice(i, i + CHUNK));
          const headers: any = { "Content-Type": "application/json" };
          if (ZAPI_CLIENT_TOKEN) headers["Client-Token"] = ZAPI_CLIENT_TOKEN;
          const respostas: any[] = [];
          for (const p of partes) {
            const r = await fetch(zapiUrl, {
              method: "POST",
              headers,
              body: JSON.stringify({ phone: destino, message: p }),
            });
            const t = await r.text().catch(() => "");
            respostas.push({ status: r.status, body: t.slice(0, 200) });
          }
          whatsappEnvio = { destino, partes: partes.length, respostas };
        } else {
          whatsappEnvio = { skipped: true, motivo: !destino ? "sem_telefone_operador" : "zapi_nao_configurada" };
        }
      }
    } catch (sendErr: any) {
      console.error("Falha ao enviar WhatsApp de devolução:", sendErr?.message || sendErr);
      whatsappEnvio = { error: sendErr?.message || String(sendErr) };
    }

    return new Response(JSON.stringify({ success: true, oficio_id: oficioId, whatsapp: whatsappEnvio }), {
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