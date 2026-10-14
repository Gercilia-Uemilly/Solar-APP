// PDF do ofício para o bot de WhatsApp (n8n): devolve o ofício FINAL (número oficial, timbrado e assinatura),
// montado igual à exportação da tela do Solar, para o bot mandar ao cidadão.
// Entrada: POST { oficio_id } com o header x-bot-secret (segredo BOT_SECRET). Só leitura no banco.
// Se o Solar ainda não terminou de gerar o ofício (IA pendente), responde { pronto: false } e o bot tenta de novo depois.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOficioDocx, docxToPdfConvertApi } from "../_shared/oficioDocx.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bot-secret",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const botSecret = Deno.env.get("BOT_SECRET");
  if (!botSecret || req.headers.get("x-bot-secret") !== botSecret) return json({ error: "Não autorizado" }, 401);

  let oficioId = "";
  try { oficioId = String((await req.json())?.oficio_id || "").trim(); } catch { /* corpo invalido */ }
  if (!/^[0-9a-f-]{36}$/i.test(oficioId)) return json({ error: "oficio_id inválido" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: o, error } = await admin.from("oficios").select("*").eq("id", oficioId).maybeSingle();
  if (error) return json({ error: "Erro ao ler o ofício: " + error.message }, 500);
  if (!o) return json({ error: "Ofício não encontrado" }, 404);

  // deno-lint-ignore no-explicit-any
  const of = o as any;
  const numeroOk = !!of.numero && !/n[º°o]?\s*_+/i.test(String(of.numero));
  if (!of.conteudo || of.ia_pendente === true || !numeroOk) {
    return json({ pronto: false, status: of.status || null, motivo: !of.conteudo ? "sem_conteudo" : of.ia_pendente ? "ia_pendente" : "sem_numero" });
  }

  try {
    const docx = await buildOficioDocx({
      numero: of.numero || "",
      destinatario: String(of.destinatario || "").replace(/^DESTINAT[AÁ]RIO:\s*/i, "").trim(),
      assunto: String(of.assunto || "").replace(/^(?:assunto\s*:\s*)+/i, "").trim(),
      conteudo: of.conteudo || "",
      bairro: of.bairro || "",
      cargoDestinatario: String(of.cargo_destinatario || "").replace(/^DESTINAT[AÁ]RIO:\s*/i, "").trim(),
      dataGeracao: of.data_geracao || undefined,
      secretaria: of.secretaria_identificada || undefined,
      vocativo: of.vocativo || undefined,
      fechamento: of.fechamento_text || undefined,
    });
    const numeroArquivo = String(of.numero).replace(/^(Ofício GVF n°\s*)+/i, "").replace(/\//g, "-").replace(/[^0-9a-zA-Z\-]/g, "") || "oficio";
    const filename = `Oficio-GVF-${numeroArquivo}.pdf`;
    const pdf = await docxToPdfConvertApi(docx, filename.replace(/\.pdf$/, ".docx"));
    let bin = "";
    for (let i = 0; i < pdf.length; i += 8192) bin += String.fromCharCode(...pdf.subarray(i, i + 8192));
    return json({ pronto: true, numero: of.numero, assunto: of.assunto || "", filename, pdf_base64: btoa(bin) });
  } catch (e) {
    console.error("[oficio-pdf-bot]", e);
    return json({ error: "Falha ao gerar o PDF: " + String((e as Error)?.message || e).slice(0, 300) }, 500);
  }
});
