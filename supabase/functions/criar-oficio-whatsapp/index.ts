// Endpoint interno para o n8n / Agente WhatsApp criar ofícios sem depender
// de anon key com policy aberta. Protegido pelo INTERNAL_WEBHOOK_SECRET.
// Faz INSERT com service_role (bypass RLS) e retorna o id criado.
// O trigger existente em `oficios` dispara auto-generate-oficio-whatsapp
// automaticamente quando origem='whatsapp'/'whatsapp_bot' e ia_pendente=true.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buscarContatoPorOrigemCodigo,
  buscarContatoPorTelefone,
  normalizePhoneBR,
} from "../_shared/zapReqContatos.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ORIGENS_PLANILHA = ["Zap", "Requerimento", "Conecta Jovem", "Empregador", "Agenda", "Relações Políticas", "DI"];

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function matchesProfilePhone(profile: Record<string, unknown>, phone: string): boolean {
  if (!phone) return false;
  return [profile.celular, profile.telefone1, profile.telefone2, profile.telefone3]
    .some((raw) => normalizePhoneBR(asText(raw)) === phone);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const expected = Deno.env.get("INTERNAL_WEBHOOK_SECRET") || "";
    const provided = req.headers.get("x-internal-secret") || "";
    console.log("[criar-oficio-whatsapp] auth diagnostic", {
      has_secret_env: !!expected,
      env_len: expected.length,
      header_len: provided.length,
    });
    if (!expected || provided !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Body inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Campos aceitos vindos do n8n (todos opcionais salvo conteudo/assunto).
    const {
      assunto,
      destinatario,
      cargo_destinatario,
      secretaria_identificada,
      tipo_demanda,
      solicitante,
      contato_solicitante,
      local_demanda,
      endereco,
      endereco_completo,
      local,
      bairro,
      conteudo,
      linha_telefonica,
      telefone_recebimento,
      codigo_z,
      codigo,
      origem_demanda,
      operador_nome,
      origem, // 'whatsapp' | 'whatsapp_bot'
    } = body as Record<string, unknown>;

    const conteudoTexto = asText(conteudo);
    if (!conteudoTexto) {
      return new Response(JSON.stringify({ error: "conteudo obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const origemInformada = asText(origem);
    const origemParaPlanilha = ORIGENS_PLANILHA.includes(origemInformada)
      ? origemInformada
      : asText(origem_demanda);
    const codigoPlanilha = asText(codigo_z) || asText(codigo);
    const contatoPlanilha =
      buscarContatoPorTelefone(asText(linha_telefonica)) ||
      buscarContatoPorTelefone(asText(telefone_recebimento)) ||
      buscarContatoPorOrigemCodigo(origemParaPlanilha, codigoPlanilha);

    const telefoneLinha = normalizePhoneBR(asText(linha_telefonica));
    const telefoneRecebido = normalizePhoneBR(asText(telefone_recebimento));
    const telefonePlanilha = contatoPlanilha ? normalizePhoneBR(contatoPlanilha.telefone) : "";
    const telefoneOperador = telefoneRecebido || telefoneLinha || telefonePlanilha;

    let profileAutor: Record<string, unknown> | null = null;
    if (telefoneOperador) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, full_name, celular, telefone1, telefone2, telefone3");
      profileAutor = (profiles || []).find((p: Record<string, unknown>) => matchesProfilePhone(p, telefoneOperador)) || null;
    }

    const operadorResolvido = contatoPlanilha?.nome || asText(operador_nome) || asText(profileAutor?.full_name) || "Agente JR";
    const origemAutomacao = origemInformada === "whatsapp_bot" ? "whatsapp_bot" : "whatsapp";
    const localResolvido = asText(local_demanda) || asText(endereco) || asText(endereco_completo) || asText(local);

    const insertPayload: Record<string, unknown> = {
      assunto: asText(assunto) || "Demanda via WhatsApp",
      destinatario: asText(destinatario) || asText(secretaria_identificada) || null,
      cargo_destinatario: asText(cargo_destinatario) || null,
      secretaria_identificada: asText(secretaria_identificada) || null,
      tipo_demanda: asText(tipo_demanda) || null,
      solicitante: asText(solicitante) || null,
      contato_solicitante: asText(contato_solicitante) || null,
      local_demanda: localResolvido || null,
      endereco_completo: asText(endereco_completo) || asText(endereco) || localResolvido || null,
      bairro: asText(bairro) || null,
      conteudo: conteudoTexto,
      linha_telefonica: telefoneLinha || telefoneOperador || null,
      telefone_recebimento: telefoneOperador || null,
      codigo_z: contatoPlanilha?.codigo || codigoPlanilha || null,
      origem: origemAutomacao,
      operador_nome: operadorResolvido,
      author_id: profileAutor?.id || null,
      status: "Rascunho",
      ia_pendente: true,
      ia_gerada: false,
    };

    const { data, error } = await admin
      .from("oficios")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      console.error("[criar-oficio-whatsapp] insert error", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let geracaoAutomatica: Record<string, unknown> = { ok: false, skipped: "nao_executada" };
    try {
      const autoResp = await fetch(`${SUPABASE_URL}/functions/v1/auto-generate-oficio-whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE}`,
          apikey: SERVICE_ROLE,
          "x-internal-secret": expected,
        },
        body: JSON.stringify({ oficio_id: data.id }),
      });
      const autoText = await autoResp.text().catch(() => "");
      try {
        geracaoAutomatica = JSON.parse(autoText || "{}");
      } catch {
        geracaoAutomatica = { raw: autoText.slice(0, 500) };
      }
      geracaoAutomatica.ok = autoResp.ok;
      geracaoAutomatica.status = autoResp.status;
    } catch (autoError) {
      console.error("[criar-oficio-whatsapp] auto generation error", autoError);
      geracaoAutomatica = { ok: false, error: (autoError as Error).message };
    }

    return new Response(
      JSON.stringify({ ok: true, oficio_id: data.id, geracao_automatica: geracaoAutomatica }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[criar-oficio-whatsapp] fatal", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});