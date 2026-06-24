import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IncomingRow {
  numero_oficio?: string | null;
  assunto?: string | null;
  destinatario?: string | null;
  secretaria?: string | null;
  data_oficio?: string | null;
  data_resposta?: string | null;
  orgao_respondente?: string | null;
  conteudo_resposta?: string | null;
  arquivo_url?: string | null;
  arquivo_nome?: string | null;
  bairro?: string | null;
}

function norm(s: any) {
  return (s || "").toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}

function similarity(a: string, b: string) {
  a = norm(a); b = norm(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aw = new Set(a.split(" "));
  const bw = new Set(b.split(" "));
  let inter = 0;
  aw.forEach(w => { if (bw.has(w)) inter++; });
  return inter / Math.max(aw.size, bw.size);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userSb.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const adminSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { rows, dry_run = false }: { rows: IncomingRow[]; dry_run?: boolean } = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("rows vazio");

    // Carregar todos os ofícios (otimização: poderia paginar; OK para volumes modestos)
    const { data: oficios } = await adminSb.from("oficios")
      .select("id, numero, assunto, destinatario, secretaria_destino, bairro, data_oficio")
      .limit(5000);

    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    const results: any[] = [];

    for (const row of rows) {
      // 1) Match exato por número
      let oficio = null as any;
      let metodo = "numero_exato";
      let confianca = 0;

      const numLimpo = (row.numero_oficio || "").toString().replace(/\D/g, "");
      if (numLimpo) {
        oficio = oficios?.find(o => (o.numero || "").replace(/\D/g, "") === numLimpo);
        if (oficio) confianca = 1;
      }

      // 2) Match heurístico (assunto + destinatário)
      if (!oficio) {
        metodo = "heuristico";
        let best: any = null; let bestScore = 0;
        for (const o of oficios || []) {
          const sAss = similarity(o.assunto || "", row.assunto || "");
          const sDest = similarity(`${o.destinatario || ""} ${o.secretaria_destino || ""}`, `${row.destinatario || ""} ${row.secretaria || ""}`);
          const sBairro = row.bairro ? similarity(o.bairro || "", row.bairro) : 0;
          const score = sAss * 0.6 + sDest * 0.3 + sBairro * 0.1;
          if (score > bestScore) { bestScore = score; best = o; }
        }
        if (best && bestScore >= 0.55) { oficio = best; confianca = bestScore; }
      }

      // 3) Match semântico via IA (apenas se ainda incerto)
      if (!oficio && LOVABLE_KEY) {
        metodo = "ia_semantica";
        // Pré-filtrar top 15 candidatos por similaridade textual
        const ranked = (oficios || []).map(o => ({
          o,
          s: similarity(`${o.assunto} ${o.destinatario} ${o.secretaria_destino}`, `${row.assunto} ${row.destinatario} ${row.secretaria}`),
        })).sort((a, b) => b.s - a.s).slice(0, 15);

        try {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_KEY}` },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "Você associa respostas históricas a ofícios. Receba uma resposta e candidatos. Retorne JSON {\"oficio_id\":\"id ou null\",\"confianca\":0..1,\"motivo\":\"breve\"}. Só associe se tiver alta certeza (>=0.7)." },
                { role: "user", content: JSON.stringify({
                    resposta: { assunto: row.assunto, destinatario: row.destinatario, secretaria: row.secretaria, bairro: row.bairro, data_oficio: row.data_oficio, conteudo: (row.conteudo_resposta || "").slice(0, 1500) },
                    candidatos: ranked.map(r => ({ id: r.o.id, numero: r.o.numero, assunto: r.o.assunto, destinatario: r.o.destinatario, secretaria: r.o.secretaria_destino, bairro: r.o.bairro, data: r.o.data_oficio })),
                  })
                },
              ],
              response_format: { type: "json_object" },
            }),
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
            if (parsed.oficio_id && parsed.confianca >= 0.7) {
              oficio = (oficios || []).find(o => o.id === parsed.oficio_id);
              confianca = parsed.confianca;
            }
          }
        } catch (e) { console.warn("IA match:", (e as any)?.message); }
      }

      const entry: any = {
        input: { numero: row.numero_oficio, assunto: row.assunto, destinatario: row.destinatario },
        oficio_id: oficio?.id || null,
        oficio_numero: oficio?.numero || null,
        metodo, confianca,
        match_status: oficio ? (confianca >= 0.85 ? "confirmado" : "pendente_revisao") : "sem_match",
      };

      if (!dry_run && oficio) {
        const { error } = await adminSb.from("oficio_respostas").insert({
          oficio_id: oficio.id,
          arquivo_url: row.arquivo_url || "historico://excel",
          arquivo_path: null,
          arquivo_nome: row.arquivo_nome || `Resposta histórica (${row.data_resposta || "s/data"})`,
          mime_type: row.arquivo_url ? null : "text/plain",
          tipo_origem: "import_excel",
          data_resposta: row.data_resposta || null,
          orgao_respondente: row.orgao_respondente || row.secretaria || null,
          conteudo_extraido: row.conteudo_resposta || null,
          resumo_ia: row.conteudo_resposta ? row.conteudo_resposta.slice(0, 280) : null,
          match_confianca: confianca,
          match_metodo: metodo,
          match_status: entry.match_status,
          uploaded_by: userId,
          uploaded_by_nome: "Importação Excel",
        });
        if (error) entry.erro = error.message;
      }

      results.push(entry);
    }

    const stats = {
      total: results.length,
      confirmados: results.filter(r => r.match_status === "confirmado").length,
      revisao: results.filter(r => r.match_status === "pendente_revisao").length,
      sem_match: results.filter(r => r.match_status === "sem_match").length,
    };

    return new Response(JSON.stringify({ ok: true, stats, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("importar-respostas-excel:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});