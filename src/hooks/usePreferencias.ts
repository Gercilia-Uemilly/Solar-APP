import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Preferencias {
  tema: string;
  cor_primaria: string;
  cor_secundaria: string;
  tamanho_fonte: string;
  sidebar_compacta: boolean;
  densidade: string;
}

const DEFAULTS: Preferencias = {
  tema: "escuro",
  cor_primaria: "#1B3A6B",
  cor_secundaria: "#22c55e",
  tamanho_fonte: "medio",
  sidebar_compacta: false,
  densidade: "normal",
};

const FONT_SIZES: Record<string, string> = {
  pequeno: "14px",
  medio: "16px",
  grande: "18px",
  extragrande: "20px",
};

const DENSITY_SPACING: Record<string, string> = {
  confortavel: "1.1",
  normal: "1",
  compacto: "0.85",
};

export function aplicarPreferencias(prefs: Preferencias) {
  const root = document.documentElement;
  root.style.setProperty("--fonte-base", FONT_SIZES[prefs.tamanho_fonte] || "16px");
  root.style.setProperty("--densidade-escala", DENSITY_SPACING[prefs.densidade] || "1");
}

export function usePreferencias() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Preferencias>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (supabase.from("preferencias_usuario" as any) as any)
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }: any) => {
        if (data) {
          const p: Preferencias = {
            tema: data.tema || DEFAULTS.tema,
            cor_primaria: data.cor_primaria || DEFAULTS.cor_primaria,
            cor_secundaria: data.cor_secundaria || DEFAULTS.cor_secundaria,
            tamanho_fonte: data.tamanho_fonte || DEFAULTS.tamanho_fonte,
            sidebar_compacta: data.sidebar_compacta ?? DEFAULTS.sidebar_compacta,
            densidade: data.densidade || DEFAULTS.densidade,
          };
          setPrefs(p);
          aplicarPreferencias(p);
        } else {
          aplicarPreferencias(DEFAULTS);
        }
        setLoading(false);
      });
  }, [user]);

  const salvar = useCallback(
    async (novas: Preferencias) => {
      if (!user) return;
      setPrefs(novas);
      aplicarPreferencias(novas);

      const payload = {
        user_id: user.id,
        tema: novas.tema,
        cor_primaria: novas.cor_primaria,
        cor_secundaria: novas.cor_secundaria,
        tamanho_fonte: novas.tamanho_fonte,
        sidebar_compacta: novas.sidebar_compacta,
        densidade: novas.densidade,
        updated_at: new Date().toISOString(),
      };

      await (supabase.from("preferencias_usuario" as any) as any).upsert(payload, {
        onConflict: "user_id",
      });
    },
    [user]
  );

  return { prefs, loading, salvar };
}
