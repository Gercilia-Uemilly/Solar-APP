import { useCallback, useRef, useState } from "react";
import { Upload, X, FileText, Image as ImageIcon, File, Paperclip } from "lucide-react";

export interface AnexoFile {
  id: string;
  nome: string;
  tipo: string; // mime type
  tamanho: number;
  file?: File; // local file before upload
  url?: string; // storage URL after upload
}

interface FileDropzoneProps {
  anexos: AnexoFile[];
  onChange?: (anexos: AnexoFile[]) => void;
  onFileAdded?: (file: File) => void;
  /** Persistent mode: called for each file added (immediate upload) */
  onAddFile?: (file: File) => void;
  /** Persistent mode: called when a file is removed (immediate delete) */
  onRemoveFile?: (id: string) => void;
}

const ACCEPTED = ".jpg,.jpeg,.png,.webp,.pdf,.docx,.doc,.xlsx,.xls";

function inferMimeType(file: File): string {
  const explicit = (file.type || "").trim().toLowerCase();
  if (explicit) return explicit;

  const extension = (file.name.split(".").pop() || "").toLowerCase();
  if (["jpg", "jpeg"].includes(extension)) return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "bmp") return "image/bmp";
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "doc") return "application/msword";
  if (extension === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (extension === "xls") return "application/vnd.ms-excel";

  return "application/octet-stream";
}

function iconForType(tipo: string) {
  if (tipo.startsWith("image/")) return <ImageIcon size={16} className="text-blue-400" />;
  if (tipo.includes("pdf")) return <FileText size={16} className="text-orange-400" />;
  if (tipo.includes("word") || tipo.includes("docx") || tipo.includes("doc")) return <FileText size={16} className="text-blue-600" />;
  if (tipo.includes("sheet") || tipo.includes("xlsx") || tipo.includes("xls")) return <FileText size={16} className="text-green-500" />;
  return <File size={16} className="text-muted-foreground" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileCategory(tipo: string): string {
  if (tipo.startsWith("image/")) return "imagem";
  if (tipo.includes("pdf")) return "pdf";
  if (tipo.includes("word") || tipo.includes("docx") || tipo.includes("doc")) return "doc";
  return "outro";
}

export default function FileDropzone({ anexos, onChange, onFileAdded }: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const newAnexos: AnexoFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      // Deduplicate by name+size
      const isDupe = anexos.some(a => a.nome === f.name && a.tamanho === f.size);
      if (isDupe) continue;
      const normalizedType = inferMimeType(f);
      const anexo: AnexoFile = {
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        nome: f.name,
        tipo: normalizedType,
        tamanho: f.size,
        file: f,
      };
      newAnexos.push(anexo);
      onFileAdded?.(f);
    }
    if (newAnexos.length > 0) {
      onChange([...anexos, ...newAnexos]);
    }
  }, [anexos, onChange, onFileAdded]);

  const remove = (id: string) => onChange(anexos.filter((a) => a.id !== id));

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const imageAnexos = anexos.filter(a => a.tipo.startsWith("image/"));
  const docAnexos = anexos.filter(a => !a.tipo.startsWith("image/"));

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
        <Paperclip size={12} /> Anexar Arquivo
      </label>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
      >
        <Upload size={20} className="mx-auto mb-1.5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Arraste arquivos ou <span className="text-primary font-medium">clique para selecionar</span>
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">Imagens (JPG, PNG, WebP) · PDF · DOCX · XLSX</p>
        <input ref={inputRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {/* Image thumbnails */}
      {imageAnexos.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground">📷 Imagens ({imageAnexos.length})</span>
          <div className="grid grid-cols-4 gap-2">
            {imageAnexos.map((a) => {
              const src = a.url || (a.file ? URL.createObjectURL(a.file) : "");
              return (
                <div key={a.id} className="relative group rounded-lg overflow-hidden border border-border aspect-square bg-secondary">
                  <img src={src} alt={a.nome} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); remove(a.id); }}
                    className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                  >×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Document list */}
      {docAnexos.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground">📄 Documentos ({docAnexos.length})</span>
          {docAnexos.map((a) => (
            <div key={a.id} className="flex items-center gap-2 bg-card rounded-lg px-3 py-2 text-sm border border-border">
              {iconForType(a.tipo)}
              <span className="flex-1 truncate text-foreground text-xs">{a.nome}</span>
              <span className="text-[10px] text-muted-foreground">{formatSize(a.tamanho)}</span>
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

export { getFileCategory };
