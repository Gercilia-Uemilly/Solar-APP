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
  confortavel: "1.15",
  normal: "1",
  compacto: "0.85",
};

/** Convert hex (#RRGGBB) to HSL string "H S% L%" */
function hexToHsl(hex: string): string {
  let r = 0, g = 0, b = 0;
  const clean = hex.replace("#", "");
  if (clean.length === 6) {
    r = parseInt(clean.substring(0, 2), 16) / 255;
    g = parseInt(clean.substring(2, 4), 16) / 255;
    b = parseInt(clean.substring(4, 6), 16) / 255;
  }
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function aplicarPreferencias(prefs: Preferencias) {
  const root = document.documentElement;

  // Font size
  root.style.setProperty("--fonte-base", FONT_SIZES[prefs.tamanho_fonte] || "16px");

  // Density
  root.style.setProperty("--densidade-escala", DENSITY_SPACING[prefs.densidade] || "1");

  // Primary color → apply to CSS HSL variables
  if (prefs.cor_primaria) {
    const hsl = hexToHsl(prefs.cor_primaria);
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--ring", hsl);
    // Sidebar gets a darker version
    const parts = hsl.split(" ");
    const h = parts[0];
    const s = parts[1];
    const lVal = parseInt(parts[2]);
    const sidebarBg = `${h} ${s} ${Math.max(lVal - 16, 5)}%`;
    const sidebarAccent = `${h} ${s} ${Math.max(lVal - 10, 8)}%`;
    const sidebarBorder = `${h} ${s} ${Math.max(lVal - 20, 4)}%`;
    root.style.setProperty("--sidebar-background", sidebarBg);
    root.style.setProperty("--sidebar-accent", sidebarAccent);
    root.style.setProperty("--sidebar-border", sidebarBorder);
    root.style.setProperty("--sidebar-primary", hsl);
    root.style.setProperty("--sidebar-ring", hsl);
  }

  // Theme class
  const isDark = prefs.tema === "escuro" || prefs.tema === "alto-contraste";
  if (isDark) {
    root.classList.add("dark");
  } else if (prefs.tema === "claro") {
    root.classList.remove("dark");
  }

  // High contrast adjustments
  if (prefs.tema === "alto-contraste") {
    root.style.setProperty("--background", "0 0% 0%");
    root.style.setProperty("--foreground", "0 0% 100%");
    root.style.setProperty("--card", "0 0% 5%");
    root.style.setProperty("--card-foreground", "0 0% 100%");
    root.style.setProperty("--muted-foreground", "0 0% 75%");
    root.style.setProperty("--border", "0 0% 30%");
  } else {
    // Reset high-contrast overrides
    root.style.removeProperty("--background");
    root.style.removeProperty("--foreground");
    root.style.removeProperty("--card");
    root.style.removeProperty("--card-foreground");
    root.style.removeProperty("--muted-foreground");
    root.style.removeProperty("--border");
  }
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
