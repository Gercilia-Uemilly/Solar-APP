import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export interface RespostaPreviewFile {
  blob: Blob;
  name: string;
  mime: string;
}

export default function RespostaArquivoPreview({ file }: { file: RespostaPreviewFile }) {
  const [pages, setPages] = useState<string[]>([]);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const urlsToRevoke: string[] = [];

    const renderFile = async () => {
      setLoading(true);
      setError(null);
      setPages([]);
      setObjectUrl(null);

      const isPdf = file.mime.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        const url = URL.createObjectURL(file.blob);
        urlsToRevoke.push(url);
        if (!cancelled) {
          setObjectUrl(url);
          setLoading(false);
        }
        return;
      }

      try {
        const data = new Uint8Array(await file.blob.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        const renderedPages: string[] = [];
        const maxWidth = 980;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const viewportBase = page.getViewport({ scale: 1 });
          const scale = Math.min(1.7, maxWidth / viewportBase.width);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          renderedPages.push(canvas.toDataURL("image/png"));
          canvas.width = 0;
          canvas.height = 0;
        }

        if (!cancelled) setPages(renderedPages);
      } catch {
        if (!cancelled) setError("Não foi possível gerar a pré-visualização deste PDF.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    renderFile();
    return () => {
      cancelled = true;
      urlsToRevoke.forEach(URL.revokeObjectURL);
    };
  }, [file]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  if (error) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{error}</div>;
  }

  if (objectUrl) {
    return <img src={objectUrl} alt={file.name} className="max-h-full max-w-full object-contain mx-auto rounded border" />;
  }

  return (
    <div className="h-full overflow-y-auto rounded border bg-muted/40 p-3">
      <div className="mx-auto flex max-w-[980px] flex-col gap-4">
        {pages.map((src, index) => (
          <img key={index} src={src} alt={`${file.name} página ${index + 1}`} className="w-full rounded border bg-background shadow-sm" />
        ))}
      </div>
    </div>
  );
}