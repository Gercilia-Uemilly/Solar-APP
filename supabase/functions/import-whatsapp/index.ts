import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BlobReader, ZipReader, TextWriter } from "https://deno.land/x/zipjs@v2.7.32/index.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Não autenticado");

    // Verify admin role - only admins can import into knowledge base
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem importar conversas." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) throw new Error("Nenhum arquivo enviado");

    const conversations: { titulo: string; descricao: string }[] = [];

    if (file.name.endsWith(".zip")) {
      // Process ZIP file
      const blob = new Blob([await file.arrayBuffer()]);
      const zipReader = new ZipReader(new BlobReader(blob));
      const entries = await zipReader.getEntries();

      for (const entry of entries) {
        if (entry.directory) continue;
        const name = entry.filename || "";
        
        // Only process .txt files (WhatsApp exports are .txt)
        if (!name.endsWith(".txt")) continue;

        try {
          const writer = new TextWriter();
          const text = await entry.getData!(writer);
          
          if (text && text.length > 50) {
            // Extract conversation chunks (split large conversations into manageable pieces)
            const chunks = splitConversation(text, name);
            conversations.push(...chunks);
          }
        } catch (e) {
          console.error(`Error reading ${name}:`, e);
        }
      }
      await zipReader.close();
    } else if (file.name.endsWith(".txt")) {
      // Process single .txt file
      const text = await file.text();
      if (text && text.length > 50) {
        const chunks = splitConversation(text, file.name);
        conversations.push(...chunks);
      }
    } else {
      throw new Error("Formato não suportado. Envie um arquivo .zip ou .txt com conversas exportadas do WhatsApp.");
    }

    if (conversations.length === 0) {
      throw new Error("Nenhuma conversa encontrada no arquivo.");
    }

    // Insert conversations into base_conhecimento
    const inserts = conversations.map(c => ({
      titulo: c.titulo,
      descricao: c.descricao,
      categoria: "WhatsApp",
      fonte: "WhatsApp Export",
      palavras_chave: ["whatsapp", "conversa", "atendimento"],
    }));

    const { error: insertError } = await supabase
      .from("base_conhecimento")
      .insert(inserts);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: conversations.length,
        message: `${conversations.length} trecho(s) de conversa importado(s) com sucesso!`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("import-whatsapp error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Erro desconhecido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function splitConversation(text: string, filename: string): { titulo: string; descricao: string }[] {
  const cleanName = filename.replace(/\.txt$/, "").replace(/^.*[\\/]/, "");
  
  // WhatsApp export format: "DD/MM/YYYY HH:MM - Name: Message"
  const lines = text.split("\n").filter(l => l.trim().length > 0);
  
  // If file is small enough, store as single entry
  if (text.length <= 3000) {
    return [{
      titulo: `Conversa WhatsApp: ${cleanName}`,
      descricao: text.substring(0, 3000),
    }];
  }

  // Split into chunks of ~2500 chars for larger conversations
  const chunks: { titulo: string; descricao: string }[] = [];
  let currentChunk = "";
  let chunkIndex = 1;

  for (const line of lines) {
    if (currentChunk.length + line.length > 2500 && currentChunk.length > 500) {
      chunks.push({
        titulo: `Conversa WhatsApp: ${cleanName} (parte ${chunkIndex})`,
        descricao: currentChunk.trim(),
      });
      chunkIndex++;
      currentChunk = "";
    }
    currentChunk += line + "\n";
  }

  if (currentChunk.trim().length > 50) {
    chunks.push({
      titulo: `Conversa WhatsApp: ${cleanName} (parte ${chunkIndex})`,
      descricao: currentChunk.trim(),
    });
  }

  return chunks;
}
