import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import JSZip from "npm:jszip@3.10.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function extractPdfText(buf: ArrayBuffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join("\n") : text || "").slice(0, 12000);
  } catch {
    return "";
  }
}

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeOriginalOficioPdf(conteudo: string, numeroOficio: string | null | undefined) {
  const text = normalizeText(conteudo);
  if (!text) return false;

  const match = String(numeroOficio || "").match(/(\d{1,5})\s*\/\s*(20\d{2})/) || String(numeroOficio || "").match(/(\d{1,5}).*?(20\d{2})/);
  const sameNumber = match ? text.includes(`${match[1]}/${match[2]}`) || (text.includes(match[1]) && text.includes(match[2])) : false;
  if (!sameNumber) return false;

  const markers = [
    text.includes("oficio gvf"),
    text.includes("destinatario:"),
    text.includes("assunto:"),
    text.includes("vereador que a este subscreve") || text.includes("este gabinete") || text.includes("exercicio de suas atribuicoes parlamentares"),
    text.includes("uberlandia"),
  ].filter(Boolean).length;

  return markers >= 3;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { zip_bucket, zip_path, uploaded_by, uploaded_by_nome, offset = 0, limit = 20 } = await req.json();
    if (!zip_bucket || !zip_path) {
      return new Response(JSON.stringify({ error: "zip_bucket/zip_path required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // download zip
    const dl = await admin.storage.from(zip_bucket).download(zip_path);
    if (dl.error || !dl.data) throw new Error(`download zip: ${dl.error?.message}`);
    const ab = await dl.data.arrayBuffer();
    const zip = await JSZip.loadAsync(ab);

    // map oficios numero->id (2026)
    const { data: ofs, error: ofErr } = await admin
      .from("oficios")
      .select("id, numero, ano")
      .eq("ano", 2026)
      .is("deleted_at", null);
    if (ofErr) throw ofErr;
    const map: Record<string, { id: string; numero: string | null }> = {};
    for (const o of ofs ?? []) {
      const m = String(o.numero || "").match(/(\d+)\/2026/);
      if (m && !map[m[1]]) map[m[1]] = { id: o.id as string, numero: o.numero as string | null };
    }

    const imported: any[] = [];
    const notFound: any[] = [];
    const errors: any[] = [];
    const ts = Date.now();
    let i = 0;

    const allEntries: { name: string; entry: any }[] = [];
    zip.forEach((_p, e) => {
      if (e.dir) return;
      const name = e.name.split("/").pop() || e.name;
      if (!name.toLowerCase().endsWith(".pdf")) return;
      allEntries.push({ name, entry: e });
    });
    allEntries.sort((a, b) => a.name.localeCompare(b.name));
    const entries = allEntries.slice(offset, offset + limit);

    for (const { name, entry } of entries) {
      const m = name.match(/^(\d+)[.\-_ ]2026/);
      const numero = m?.[1];
      if (!numero) { notFound.push({ filename: name, reason: "sem_numero" }); continue; }
      const oficio = map[numero];
      const oficioId = oficio?.id;
      if (!oficioId) { notFound.push({ filename: name, numero }); continue; }
      try {
        const blob = await entry.async("uint8array");
        const pdfBuffer = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength);
        const conteudoExtraido = await extractPdfText(pdfBuffer);
        if (looksLikeOriginalOficioPdf(conteudoExtraido, oficio.numero)) {
          errors.push({ filename: name, numero, error: "arquivo_eh_o_proprio_oficio" });
          continue;
        }

        const storagePath = `${oficioId}/${ts + i}-zip.pdf`;
        i++;
        const up = await admin.storage.from("respostas-oficios").upload(storagePath, blob, {
          contentType: "application/pdf", upsert: false,
        });
        if (up.error) { errors.push({ filename: name, error: up.error.message }); continue; }

        // sha256
        const hashBuf = await crypto.subtle.digest("SHA-256", blob);
        const sha256 = Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,"0")).join("");

        const { error: insErr } = await admin.from("oficio_respostas").insert({
          oficio_id: oficioId,
          arquivo_url: `storage://respostas-oficios/${storagePath}`,
          arquivo_path: storagePath,
          arquivo_nome: name,
          tamanho_bytes: blob.byteLength,
          mime_type: "application/pdf",
          sha256,
          tipo_origem: "import_excel",
          conteudo_extraido: conteudoExtraido || null,
          match_status: "confirmado",
          match_metodo: conteudoExtraido ? "numero_exato_conteudo_validado" : "numero_exato_sem_texto",
          match_confianca: 1,
          uploaded_by: uploaded_by ?? null,
          uploaded_by_nome: uploaded_by_nome ?? "Importação ZIP",
        });
        if (insErr) {
          if ((insErr as any).code === "23505") {
            await admin.storage.from("respostas-oficios").remove([storagePath]);
            errors.push({ filename: name, error: "duplicado" });
          } else {
            await admin.storage.from("respostas-oficios").remove([storagePath]);
            errors.push({ filename: name, error: insErr.message });
          }
          continue;
        }
        imported.push({ filename: name, numero, oficio_id: oficioId });
      } catch (e: any) {
        errors.push({ filename: name, error: e?.message || "falha" });
      }
    }

    return new Response(JSON.stringify({
      total_in_zip: allEntries.length,
      processed: entries.length,
      offset, limit,
      next_offset: offset + entries.length < allEntries.length ? offset + entries.length : null,
      imported: imported.length,
      not_found: notFound.length,
      errors: errors.length,
      details: { imported, notFound, errors },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});