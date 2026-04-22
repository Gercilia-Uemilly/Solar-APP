import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// 8 horas de inatividade real (jornada de trabalho completa).
// Antes eram 30 min, o que estava deslogando os operadores no meio do uso.
const TIMEOUT_MS = 8 * 60 * 60 * 1000;

/**
 * Auto-logout após inatividade prolongada.
 * Considera atividade: clique, tecla, scroll, toque e movimento de mouse.
 */
export function useSessionTimeout(enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled) return;

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
        toast.warning("Sessão encerrada por inatividade prolongada.");
        navigate("/auth");
      }, TIMEOUT_MS);
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"] as const;
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, navigate]);
}
