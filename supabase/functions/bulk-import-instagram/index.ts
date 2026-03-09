const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Auth check with anon key
    const supabaseAuth = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if admin
    const { data: isAdminResult } = await supabaseAuth.rpc("is_admin", { _user_id: user.id });
    if (!isAdminResult) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for bulk insert
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { links } = await req.json();
    
    if (!links || !Array.isArray(links) || links.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum link fornecido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean and validate links
    const validLinks = links
      .map((l: string) => l.trim().replace(/\\/g, ""))
      .filter((l: string) => l && l.includes("instagram.com"));

    if (validLinks.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum link válido do Instagram" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing links to avoid duplicates
    const { data: existingBase } = await supabase
      .from("base_conhecimento")
      .select("link")
      .not("link", "is", null);

    const existingLinks = new Set((existingBase || []).map((e: any) => e.link));

    // Filter out existing
    const newLinks = validLinks.filter((l: string) => !existingLinks.has(l));

    if (newLinks.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        inserted: 0,
        skipped: validLinks.length,
        message: "Todos os links já existem na base" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch insert
    const BATCH_SIZE = 500;
    let inserted = 0;
    
    for (let i = 0; i < newLinks.length; i += BATCH_SIZE) {
      const batch = newLinks.slice(i, i + BATCH_SIZE).map((link: string) => ({
        titulo: "Instagram @fabaovereador",
        link,
        fonte: "Instagram",
        categoria: "Redes Sociais",
        descricao: link.includes("/reel/") ? "Reel do Instagram" : "Post do Instagram",
      }));

      const { error: insertError, data: insertData } = await supabase
        .from("base_conhecimento")
        .insert(batch)
        .select("id");

      if (insertError) {
        console.error("Batch insert error:", insertError);
      } else {
        inserted += insertData?.length || 0;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: validLinks.length,
      inserted,
      skipped: validLinks.length - newLinks.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Bulk import error:", err);
    return new Response(JSON.stringify({ 
      error: err instanceof Error ? err.message : "Erro interno" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
