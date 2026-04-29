import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Upload, FileText, Loader2, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractExternalOficioFileToHtml } from "@/lib/externalOficioText";

type Modo = "substituir" | "nova_versao" | "novo";

interface UploadOficioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oficios: Array<{ id: string; numero?: string | null; assunto: string; destinatario: string }>;
  /** Pre-select an ofício id (when triggered from row action) */
  preSelectedOficioId?: string | null;
  onSuccess: () => void;
}

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

export default function UploadOficioModal({
  open,
  onOpenChange,
  oficios,
  preSelectedOficioId,
  onSuccess,
}: UploadOficioModalProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [modo, setModo] = useState<Modo>(preSelectedOficioId ? "substituir" : "novo");
  const [oficioAlvoId, setOficioAlvoId] = useState<string>(preSelectedOficioId || "");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setModo(preSelectedOficioId ? "substituir" : "novo");
    setOficioAlvoId(preSelectedOficioId || "");
    setUploading(false);
  }, [preSelectedOficioId]);

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
    if ((modo === "substituir" || modo === "nova_versao") && !oficioAlvoId) {
      toast.error("Selecione o ofício alvo.");
      return;
    }

    setUploading(true);
    const toastId = toast.loading("Processando arquivo...");

    try {
      const extractedHtml = await extractExternalOficioFileToHtml(file).catch(() => "");
      if ((modo === "substituir" || modo === "novo") && !extractedHtml) {
        throw new Error("Não consegui converter este arquivo para texto editável. Envie um Word (.docx) ou PDF com texto selecionável para substituir o ofício.");
      }

      const ext = file.name.split(".").pop() || "pdf";
      let publicUrl = "";
      if (modo === "nova_versao") {
        const caminho = `${user.id}/oficios-externos/${Date.now()}.${ext}`;

        const { error: storageError } = await supabase.storage
          .from("midias")
          .upload(caminho, file, { contentType: file.type, upsert: false });

        if (storageError) throw storageError;

        const { data: urlData } = supabase.storage.from("midias").getPublicUrl(caminho);
        publicUrl = urlData.publicUrl;
      }

      // Fetch profile name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      const userName = profile?.full_name || "";
      const now = new Date().toISOString();

      if (modo === "substituir" && oficioAlvoId) {
        await supabase
          .from("oficios")
          .update({
            conteudo: extractedHtml,
            arquivo_externo_url: null,
            arquivo_externo_nome: null,
            arquivo_externo_tipo: null,
            arquivo_externo_at: null,
            arquivo_externo_por: null,
            versao: "sistema",
            last_edited_by: user.id,
            last_edited_by_name: userName || user.email || null,
            last_edited_at: now,
          } as any)
          .eq("id", oficioAlvoId);

        toast.success("Ofício substituído e pronto para edição!", { id: toastId });
      } else if (modo === "nova_versao" && oficioAlvoId) {
        await supabase.from("versoes_oficio" as any).insert({
          oficio_id: oficioAlvoId,
          arquivo_url: publicUrl,
          arquivo_nome: file.name,
          arquivo_tipo: ext,
          criado_por: user.id,
          criado_por_nome: userName,
          descricao: "Versão editada externamente",
        });

        // Mark ofício as having mixed versions
        const { data: oficio } = await supabase
          .from("oficios")
          .select("versao")
          .eq("id", oficioAlvoId)
          .single();

        if (oficio && (oficio as any).versao !== "externo") {
          await supabase
            .from("oficios")
            .update({ versao: "misto" } as any)
            .eq("id", oficioAlvoId);
        }

        toast.success("Nova versão adicionada!", { id: toastId });
      } else {
        // Create new ofício with external file
        const { error: insertError } = await supabase.from("oficios").insert({
          author_id: user.id,
          assunto: file.name.replace(/\.(pdf|docx)$/i, ""),
          destinatario: "",
          status: "Rascunho",
          operador_nome: userName,
          versao: "sistema",
          conteudo: extractedHtml,
          last_edited_by: user.id,
          last_edited_by_name: userName || user.email || null,
          last_edited_at: now,
        } as any);

        if (insertError) throw insertError;
        toast.success("Ofício criado e pronto para edição!", { id: toastId });
      }

      onSuccess();
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error("Erro ao subir arquivo: " + (e?.message || "Tente novamente."), { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const oficioLabel = (o: { numero?: string | null; assunto: string; destinatario: string }) => {
    const num = o.numero ? `${o.numero} – ` : "";
    return `${num}${o.assunto || o.destinatario}`.slice(0, 60);
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
            Envie um PDF ou Word (.docx) editado externamente.
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

        {/* Drop zone */}
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
              <File size={20} className="text-primary" />
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

        {/* Mode selection */}
        <div className="space-y-3 mt-2">
          <p className="text-sm font-medium text-foreground">O que fazer com este arquivo?</p>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="modo"
              checked={modo === "substituir"}
              onChange={() => setModo("substituir")}
              className="mt-1 accent-primary"
            />
            <div>
              <span className="text-sm font-medium">Substituir ofício existente</span>
              <p className="text-xs text-muted-foreground">O arquivo externo substitui o conteúdo original</p>
            </div>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="modo"
              checked={modo === "nova_versao"}
              onChange={() => setModo("nova_versao")}
              className="mt-1 accent-primary"
            />
            <div>
              <span className="text-sm font-medium">Acrescentar como nova versão</span>
              <p className="text-xs text-muted-foreground">Mantém o original + adiciona esta versão</p>
            </div>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="modo"
              checked={modo === "novo"}
              onChange={() => setModo("novo")}
              className="mt-1 accent-primary"
            />
            <div>
              <span className="text-sm font-medium">Criar novo ofício com este arquivo</span>
              <p className="text-xs text-muted-foreground">Registra um novo ofício no sistema</p>
            </div>
          </label>

          {(modo === "substituir" || modo === "nova_versao") && (
            <Select value={oficioAlvoId} onValueChange={setOficioAlvoId}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Selecionar ofício..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {oficios.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {oficioLabel(o)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin mr-1" /> Enviando...
              </>
            ) : (
              <>
                <Upload size={14} className="mr-1" /> Subir
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
