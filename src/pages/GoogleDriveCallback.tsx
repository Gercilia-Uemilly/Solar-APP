import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function GoogleDriveCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Conectando ao Google Drive...");

  useEffect(() => {
    const exchangeCode = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      if (error) {
        setStatus("error");
        setMessage(`Erro na autorização: ${error}`);
        setTimeout(() => navigate("/configuracoes"), 3000);
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setMessage("Parâmetros inválidos.");
        setTimeout(() => navigate("/configuracoes"), 3000);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setStatus("error");
          setMessage("Sessão expirada. Faça login novamente.");
          setTimeout(() => navigate("/login"), 3000);
          return;
        }

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const resp = await fetch(
          `https://${projectId}.supabase.co/functions/v1/google-user-oauth`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "exchange_code", code, state }),
          }
        );

        const result = await resp.json();

        if (!resp.ok) {
          throw new Error(result.error || "Erro ao trocar código OAuth");
        }

        setStatus("success");
        setMessage(`Conectado como ${result.email || "sua conta Google"}!`);
        setTimeout(() => navigate("/configuracoes?drive=conectado"), 2000);
      } catch (e: any) {
        console.error("OAuth callback error:", e);
        setStatus("error");
        setMessage(e.message || "Erro desconhecido");
        setTimeout(() => navigate("/configuracoes"), 4000);
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="bg-card rounded-xl border border-border p-8 max-w-md text-center space-y-4">
        {status === "loading" && (
          <Loader2 size={40} className="animate-spin text-primary mx-auto" />
        )}
        {status === "success" && (
          <CheckCircle2 size={40} className="text-green-500 mx-auto" />
        )}
        {status === "error" && (
          <XCircle size={40} className="text-destructive mx-auto" />
        )}
        <h2 className="text-lg font-semibold text-foreground">
          {status === "loading" && "Conectando..."}
          {status === "success" && "Conectado!"}
          {status === "error" && "Erro"}
        </h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
