import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Undo,
  Redo,
  Eraser,
  ImagePlus,
} from "lucide-react";

interface OficioPreviewEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export default function OficioPreviewEditor({ content, onChange }: OficioPreviewEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content || "";
    }
  }, [content]);

  const exec = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    onChange(editorRef.current?.innerHTML || "");
  }, [onChange]);

  const handleInput = useCallback(() => {
    onChange(editorRef.current?.innerHTML || "");
  }, [onChange]);

  const handleImageInsert = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      exec("insertImage", reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [exec]);

  const ToolBtn = ({ onClick, children, title }: {
    onClick: () => void;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className="p-1.5 rounded transition-colors text-muted-foreground hover:bg-muted"
    >
      {children}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 p-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg mb-2 sticky top-0 z-10">
        <ToolBtn onClick={() => exec("undo")} title="Desfazer (Ctrl+Z)">
          <Undo size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => exec("redo")} title="Refazer (Ctrl+Y)">
          <Redo size={14} />
        </ToolBtn>

        <div className="w-px h-4 bg-blue-200 dark:bg-blue-700 mx-0.5" />

        <ToolBtn onClick={() => exec("bold")} title="Negrito (Ctrl+B)">
          <Bold size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => exec("italic")} title="Itálico (Ctrl+I)">
          <Italic size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => exec("underline")} title="Sublinhado (Ctrl+U)">
          <UnderlineIcon size={14} />
        </ToolBtn>

        <div className="w-px h-4 bg-blue-200 dark:bg-blue-700 mx-0.5" />

        <ToolBtn onClick={() => exec("insertUnorderedList")} title="Lista com marcadores">
          <List size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => exec("insertOrderedList")} title="Lista numerada">
          <ListOrdered size={14} />
        </ToolBtn>

        <div className="w-px h-4 bg-blue-200 dark:bg-blue-700 mx-0.5" />

        <ToolBtn onClick={() => exec("justifyLeft")} title="Alinhar à esquerda">
          <AlignLeft size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => exec("justifyCenter")} title="Centralizar">
          <AlignCenter size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => exec("justifyRight")} title="Alinhar à direita">
          <AlignRight size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => exec("justifyFull")} title="Justificar">
          <AlignJustify size={14} />
        </ToolBtn>

        <div className="w-px h-4 bg-blue-200 dark:bg-blue-700 mx-0.5" />

        <ToolBtn onClick={() => exec("removeFormat")} title="Limpar formatação">
          <Eraser size={14} />
        </ToolBtn>

        <div className="w-px h-4 bg-blue-200 dark:bg-blue-700 mx-0.5" />

        <ToolBtn onClick={() => imageInputRef.current?.click()} title="Inserir imagem">
          <ImagePlus size={14} />
        </ToolBtn>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageInsert}
      />

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        style={{
          minHeight: "60px",
          outline: "none",
          textAlign: "justify",
          fontSize: "11pt",
          lineHeight: "1.5",
          fontFamily: "Arial, sans-serif",
          color: "#000",
        }}
      />

      <style>{`
        [contenteditable="true"] p {
          text-indent: 1.25cm;
          margin-bottom: 0;
          margin-top: 0;
          line-height: 1.5;
          font-size: 11pt;
        }
        [contenteditable="true"] ul,
        [contenteditable="true"] ol {
          padding-left: 2cm;
          margin-bottom: 10px;
        }
        [contenteditable="true"] img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 8px auto;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
