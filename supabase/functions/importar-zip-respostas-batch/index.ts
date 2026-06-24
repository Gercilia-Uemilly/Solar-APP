import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import JSZip from "npm:jszip@3.10.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const map: Record<string, string> = {};
    for (const o of ofs ?? []) {
      const m = String(o.numero || "").match(/(\d+)\/2026/);
      if (m && !map[m[1]]) map[m[1]] = o.id as string;
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
      const oficioId = map[numero];
      if (!oficioId) { notFound.push({ filename: name, numero }); continue; }
      try {
        const blob = await entry.async("uint8array");
        const storagePath = `${oficioId}/${ts + i}-zip.pdf`;
        i++;
        const up = await admin.storage.from("respostas-oficios").upload(storagePath, blob, {
          contentType: "application/pdf", upsert: false,
        });
        if (up.error) { errors.push({ filename: name, error: up.error.message }); continue; }

        // sha256
        const hashBuf = await crypto.subtle.digest("SHA-256", blob);
        const sha256 = Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,"0")).join("");

        const pub = admin.storage.from("respostas-oficios").getPublicUrl(storagePath);
        const { error: insErr } = await admin.from("oficio_respostas").insert({
          oficio_id: oficioId,
          arquivo_url: pub.data.publicUrl,
          arquivo_path: storagePath,
          arquivo_nome: name,
          tamanho_bytes: blob.byteLength,
          mime_type: "application/pdf",
          sha256,
          tipo_origem: "import_excel",
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