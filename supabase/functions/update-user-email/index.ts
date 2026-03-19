import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) throw new Error("Não autenticado");

    const { data: isAdmin } = await supabaseAdmin.rpc("is_admin", { _user_id: caller.id });
    if (!isAdmin) throw new Error("Sem permissão");

    const { userId, newEmail } = await req.json();
    if (!userId || !newEmail) throw new Error("userId e newEmail são obrigatórios");

    // Update email in auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: newEmail, email_confirm: true });
    if (authError) throw authError;

    // Update email in profiles table
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ email: newEmail })
      .eq("id", userId);
    if (profileError) throw profileError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
