import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Upload, FileText, Loader2, File as FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractExternalOficioFileData } from "@/lib/externalOficioText";

const ACCEPTED = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_SIZE = 20 * 1024 * 1024;

function isValidType(file: File) {
  const t = file.type;
  const name = file.name.toLowerCase();
  return (
    t.includes("pdf") ||
    t.includes("word") ||
    t.includes("openxmlformats") ||
    name.endsWith(".pdf") ||
    name.endsWith(".docx")
  );
}

interface UploadOficioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (oficioId?: string) => void | Promise<void>;
}

export default function UploadOficioModal({
  open,
  onOpenChange,
  onSuccess,
}: UploadOficioModalProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setUploading(false);
  }, []);

  const handleFile = (f: File) => {
    if (f.size > MAX_SIZE) {
      toast.error("Arquivo muito grande. Máximo 20MB.");
      return;
    }
    if (!isValidType(f)) {
      toast.error("Apenas PDF ou Word (.docx)");
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file || !user) return;

    setUploading(true);
    const toastId = toast.loading("Processando arquivo...");

    try {
      const extracted = await extractExternalOficioFileData(file).catch(() => null);
      const extractedHtml = extracted?.html || "";
      if (!extractedHtml) {
        throw new Error("Não consegui converter este arquivo para texto editável. Envie um Word (.docx) ou PDF com texto selecionável.");
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      const userName = profile?.full_name || "";
      const now = new Date().toISOString();

      const { data: inserted, error: insertError } = await supabase.from("oficios").insert({
        author_id: user.id,
        numero: extracted?.numero || null,
        data_geracao: extracted?.dataGeracao || now.split("T")[0],
        assunto: extracted?.assunto || file.name.replace(/\.(pdf|docx)$/i, ""),
        destinatario: extracted?.destinatario || "",
        cargo_destinatario: extracted?.destinatario || null,
        status: "Rascunho",
        operador_nome: userName,
        versao: "sistema",
        conteudo: extractedHtml,
        last_edited_by: user.id,
        last_edited_by_name: userName || user.email || null,
        last_edited_at: now,
      } as any).select("id").single();

      if (insertError) throw insertError;
      const targetOficioId = inserted?.id;
      toast.success("Ofício criado e pronto para edição!", { id: toastId });

      onOpenChange(false);
      reset();
      await onSuccess(targetOficioId);
    } catch (e: any) {
      toast.error("Erro ao subir arquivo: " + (e?.message || "Tente novamente."), { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload size={18} /> Subir Ofício Externo
          </DialogTitle>
          <DialogDescription>
            Envie um PDF ou Word (.docx) para criar um novo ofício com todas as informações extraídas.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
          )}
        >
          {file ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <FileIcon size={20} className="text-primary" />
              <span className="font-medium">{file.name}</span>
              <span className="text-muted-foreground">({(file.size / 1024 / 1024).toFixed(1)}MB)</span>
            </div>
          ) : (
            <>
              <FileText size={32} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Arraste o arquivo ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                📄 Aceita: PDF ou Word (.docx) — Máximo: 20MB
              </p>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-1">
          O número, destinatário, assunto e conteúdo serão extraídos automaticamente do arquivo.
        </p>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin mr-1" /> Processando...
              </>
            ) : (
              <>
                <Upload size={14} className="mr-1" /> Criar Ofício
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
