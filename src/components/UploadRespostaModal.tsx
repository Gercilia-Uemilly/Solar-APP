import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { uploadRespostaArquivo } from "@/hooks/useRespostas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  oficioId: string | null;
  oficioNumero?: string | null;
  onUploaded?: () => void;
}

type FileState = { file: File; status: "queued" | "uploading" | "done" | "error"; error?: string };

export default function UploadRespostaModal({ open, onOpenChange, oficioId, oficioNumero, onUploaded }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [files, setFiles] = useState<FileState[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (arr.length !== list.length) {
      toast({ title: "Apenas PDFs são aceitos", variant: "destructive" });
    }
    setFiles(prev => [...prev, ...arr.map(f => ({ file: f, status: "queued" as const }))]);
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (!oficioId || !user) return;
    setUploading(true);
    const userName = user.user_metadata?.full_name || user.email || "Operador";
    let okCount = 0;
    const next = [...files];
    for (let i = 0; i < next.length; i++) {
      if (next[i].status === "done") continue;
      next[i] = { ...next[i], status: "uploading" };
      setFiles([...next]);
      try {
        await uploadRespostaArquivo(oficioId, next[i].file, user.id, userName);
        next[i] = { ...next[i], status: "done" };
        okCount++;
      } catch (e: any) {
        next[i] = { ...next[i], status: "error", error: e?.message || "Falha" };
      }
      setFiles([...next]);
    }
    setUploading(false);
    if (okCount > 0) {
      toast({ title: `${okCount} resposta(s) anexada(s)`, description: "O operador será notificado." });
      onUploaded?.();
      setTimeout(() => { onOpenChange(false); setFiles([]); }, 800);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!uploading) { onOpenChange(v); if (!v) setFiles([]); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Subir Resposta {oficioNumero ? `· ${oficioNumero}` : ""}</DialogTitle>
          <DialogDescription>
            Anexe um ou mais PDFs com a resposta do órgão. O ofício será marcado como Respondido e o operador receberá notificação no WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-accent/30 transition-colors"
        >
          <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Arraste PDFs aqui ou clique para selecionar</p>
          <p className="text-xs text-muted-foreground mt-1">Pode anexar vários arquivos · até 20MB cada</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-2 border rounded">
                <FileText size={16} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{f.file.name}</p>
                  <p className="text-xs text-muted-foreground">{(f.file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                {f.status === "uploading" && <Loader2 size={16} className="animate-spin" />}
                {f.status === "done" && <CheckCircle2 size={16} className="text-green-600" />}
                {f.status === "error" && <span title={f.error}><AlertCircle size={16} className="text-destructive" /></span>}
                {f.status === "queued" && !uploading && (
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>Cancelar</Button>
          <Button onClick={handleUpload} disabled={uploading || files.length === 0 || !oficioId}>
            {uploading ? <><Loader2 className="animate-spin mr-2" size={14} /> Enviando...</> : `Enviar ${files.length || ""}`.trim()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}