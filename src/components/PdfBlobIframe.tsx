import { useEffect, useState } from "react";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PdfBlobIframeProps {
  url: string;
  title?: string;
}

/**
 * Renderiza um PDF baixando-o via fetch e usando blob: URL.
 * Isso contorna bloqueadores de anúncios (AdBlock/uBlock) que
 * frequentemente bloqueiam URLs com "supabase" → ERR_BLOCKED_BY_CLIENT.
 */
export default function PdfBlobIframe({ url, title }: PdfBlobIframeProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(null);
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      })
      .catch((e) => {
        if (!active) return;
        setError(e?.message || "Falha ao carregar arquivo");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [url]);

  if (loading) {
    return (
      <div
        className="w-full border border-border rounded bg-background flex items-center justify-center text-muted-foreground"
        style={{ height: "60vh" }}
      >
        <Loader2 size={20} className="mr-2 animate-spin" /> Carregando PDF…
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div
        className="w-full border border-dashed border-destructive/50 rounded bg-background flex flex-col items-center justify-center gap-2 text-destructive p-4 text-center"
        style={{ height: "30vh" }}
      >
        <AlertCircle size={24} />
        <p className="text-sm font-medium">Não foi possível carregar a prévia</p>
        <p className="text-xs text-muted-foreground max-w-md">
          {error || "Erro desconhecido"}. Provavelmente é um bloqueador de anúncios.
          Use o botão abaixo para abrir direto.
        </p>
        <Button size="sm" variant="outline" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} className="mr-1" /> Abrir direto
          </a>
        </Button>
      </div>
    );
  }

  return (
    <iframe
      src={blobUrl}
      title={title || "Arquivo externo"}
      className="w-full border border-border rounded bg-background"
      style={{ height: "60vh" }}
    />
  );
}
