import { useCallback, useRef, useState } from "react";
import { Upload, X, FileText, FileAudio, FileVideo, Image as ImageIcon, File } from "lucide-react";
import { DemandaAnexo } from "@/types";
import { Progress } from "@/components/ui/progress";

interface FileDropzoneProps {
  anexos: DemandaAnexo[];
  onChange: (anexos: DemandaAnexo[]) => void;
  onFileAdded?: (file: File) => void; // callback for PDF auto-analysis etc.
}

const ACCEPTED = ".jpg,.jpeg,.png,.mp3,.wav,.mp4,.pdf,.docx,.doc";

function iconForType(tipo: string) {
  if (tipo.startsWith("image/")) return <ImageIcon size={16} className="text-blue-400" />;
  if (tipo.startsWith("audio/")) return <FileAudio size={16} className="text-purple-400" />;
  if (tipo.startsWith("video/")) return <FileVideo size={16} className="text-red-400" />;
  if (tipo.includes("pdf")) return <FileText size={16} className="text-orange-400" />;
  return <File size={16} className="text-muted-foreground" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDropzone({ anexos, onChange, onFileAdded }: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const newAnexos: DemandaAnexo[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const anexo: DemandaAnexo = {
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        nome: f.name,
        tipo: f.type,
        tamanho: f.size,
        file: f,
      };
      newAnexos.push(anexo);
      onFileAdded?.(f);
    }
    onChange([...anexos, ...newAnexos]);
  }, [anexos, onChange, onFileAdded]);

  const remove = (id: string) => onChange(anexos.filter((a) => a.id !== id));

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
      >
        <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Arraste arquivos aqui ou <span className="text-primary font-medium">clique para selecionar</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">Imagens, áudios, vídeos e documentos</p>
        <input ref={inputRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {anexos.length > 0 && (
        <div className="space-y-1.5">
          {anexos.map((a) => (
            <div key={a.id} className="flex items-center gap-2 bg-card rounded-lg px-3 py-2 text-sm">
              {iconForType(a.tipo)}
              <span className="flex-1 truncate text-foreground">{a.nome}</span>
              <span className="text-xs text-muted-foreground">{formatSize(a.tamanho)}</span>
              <button type="button" onClick={() => remove(a.id)} className="text-muted-foreground hover:text-destructive">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
