import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Detects when the same account is being used from multiple devices/browsers
 * within the last 6 hours and shows a friendly banner warning the operator.
 * Uses user_sessions table (browser+device+IP fingerprint).
 */
export default function MultiDeviceWarning() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const dismissKey = `multi_device_dismissed_${user.id}`;
    const dismissedAt = localStorage.getItem(dismissKey);
    // Re-show after 12h
    if (dismissedAt && Date.now() - Number(dismissedAt) < 12 * 60 * 60 * 1000) {
      setDismissed(true);
    }

    const check = async () => {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("user_sessions")
        .select("user_agent, ip_address")
        .eq("user_id", user.id)
        .gte("logged_in_at", sixHoursAgo);
      if (error || !data) return;
      const fingerprints = new Set(
        data.map((s: any) => {
          const ua = String(s.user_agent || "");
          const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
          let browser = "Outro";
          if (/Edg\//i.test(ua)) browser = "Edge";
          else if (/Chrome\//i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
          else if (/Firefox\//i.test(ua)) browser = "Firefox";
          else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
          return `${isMobile ? "Mobile" : "Desktop"}|${browser}|${s.ip_address || "?"}`;
        })
      );
      setCount(fingerprints.size);
    };
    check();
    const id = setInterval(check, 30 * 60 * 1000); // re-check every 30 min
    return () => clearInterval(id);
  }, [user]);

  const handleDismiss = () => {
    if (!user) return;
    localStorage.setItem(`multi_device_dismissed_${user.id}`, String(Date.now()));
    setDismissed(true);
  };

  if (!user || dismissed || count < 2) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800 px-4 py-2.5 flex items-start gap-3">
      <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 text-xs sm:text-sm text-amber-900 dark:text-amber-100 leading-snug">
        <strong>Atenção:</strong> sua conta está aberta em <strong>{count} dispositivos</strong> ao mesmo tempo.
        Isso pode causar erros como <em>"Falha ao enviar"</em>, quedas de sessão e travamentos.
        Saia dos aparelhos que não está usando agora.
      </div>
      <button
        onClick={handleDismiss}
        className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 shrink-0"
        title="Dispensar por 12h"
      >
        <X size={16} />
      </button>
    </div>
  );
}