import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import DOMPurify from "dompurify";
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
  Type,
} from "lucide-react";

interface OficioPreviewEditorProps {
  content: string;
  onChange: (html: string) => void;
  fontFamily?: string;
  fontSize?: number;
  lineSpacing?: number;
  onIncreaseFontSize?: () => void;
  onDecreaseFontSize?: () => void;
}

export default function OficioPreviewEditor({
  content,
  onChange,
  fontFamily = "Arial",
  fontSize = 10,
  lineSpacing = 1.5,
  onIncreaseFontSize,
  onDecreaseFontSize,
}: OficioPreviewEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isInternalChange = useRef(false);
  const insertingImageRef = useRef(false);

  useEffect(() => {
    if (!editorRef.current) return;
    // Skip overwrite if the change originated from user input inside the editor
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    // Never overwrite while the editor is focused — this prevents cursor jumps
    if (document.activeElement === editorRef.current) return;
    const sanitized = DOMPurify.sanitize(content || "", {
      ALLOWED_TAGS: ["p","strong","b","em","i","u","ul","ol","li","h1","h2","h3","h4","br","div","span","img","font","a","table","thead","tbody","tr","td","th"],
      ALLOWED_ATTR: ["src","alt","style","class","href","target","rel","align","size","color","face","width","height"],
    });
    if (editorRef.current.innerHTML !== sanitized) {
      editorRef.current.innerHTML = sanitized;
    }
  }, [content]);

  const exec = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    isInternalChange.current = true;
    onChange(editorRef.current?.innerHTML || "");
  }, [onChange]);

  const handleInput = useCallback(() => {
    isInternalChange.current = true;
    onChange(editorRef.current?.innerHTML || "");
  }, [onChange]);

  const handleImageInsert = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (insertingImageRef.current) {
      e.target.value = "";
      return;
    }
    insertingImageRef.current = true;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB.");
      e.target.value = "";
      insertingImageRef.current = false;
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      // Check if image already exists
      const currentHtml = editorRef.current?.innerHTML || "";
      if (base64 && currentHtml.includes(base64.substring(0, 80))) {
        toast.info("Imagem já inserida.");
        insertingImageRef.current = false;
        return;
      }
      exec("insertImage", base64);
      insertingImageRef.current = false;
    };
    reader.onerror = () => { insertingImageRef.current = false; };
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
      className="inline-flex items-center gap-0.5 p-1.5 rounded transition-colors text-muted-foreground hover:bg-muted"
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

        {onDecreaseFontSize && onIncreaseFontSize && (
          <>
            <div className="w-px h-4 bg-blue-200 dark:bg-blue-700 mx-0.5" />
    <ToolBtn onClick={() => {
              const sel = window.getSelection();
              if (!sel || sel.isCollapsed) {
                // No selection — apply globally via parent callback
                onDecreaseFontSize?.();
                return;
              }
              // Apply to selection only via execCommand
              const currentSize = fontSize > 10 ? fontSize - 1 : fontSize;
              document.execCommand("fontSize", false, "1");
              // Override the font size via inline style on the generated font tag
              const fontEls = editorRef.current?.querySelectorAll('font[size="1"]');
              fontEls?.forEach(el => {
                (el as HTMLElement).removeAttribute("size");
                (el as HTMLElement).style.fontSize = `${currentSize}pt`;
              });
              isInternalChange.current = true;
              onChange(editorRef.current?.innerHTML || "");
            }} title="Diminuir tamanho da fonte (selecione texto primeiro)">
              <Type size={14} />
              <span className="text-[11px] font-semibold leading-none">-</span>
            </ToolBtn>
            <ToolBtn onClick={() => {
              const sel = window.getSelection();
              if (!sel || sel.isCollapsed) {
                onIncreaseFontSize?.();
                return;
              }
              const newSize = Math.min(fontSize + 1, 12);
              document.execCommand("fontSize", false, "7");
              const fontEls = editorRef.current?.querySelectorAll('font[size="7"]');
              fontEls?.forEach(el => {
                (el as HTMLElement).removeAttribute("size");
                (el as HTMLElement).style.fontSize = `${newSize}pt`;
              });
              isInternalChange.current = true;
              onChange(editorRef.current?.innerHTML || "");
            }} title="Aumentar tamanho da fonte (selecione texto primeiro, máx 12pt)">
              <Type size={14} />
              <span className="text-[11px] font-semibold leading-none">+</span>
            </ToolBtn>
            <span className="px-1 text-[11px] text-muted-foreground">{fontSize}pt</span>
          </>
        )}

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
          fontSize: `${fontSize}pt`,
          lineHeight: String(lineSpacing),
          fontFamily: `${fontFamily}, Arial, sans-serif`,
          color: "#000",
        }}
      />

      <style>{`
        [contenteditable="true"] p {
          text-indent: 1.25cm;
          margin-bottom: 0;
          margin-top: 0;
          line-height: ${lineSpacing};
          font-size: ${fontSize}pt;
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
