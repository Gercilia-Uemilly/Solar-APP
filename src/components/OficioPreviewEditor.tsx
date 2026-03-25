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
  Type,
} from "lucide-react";

interface OficioPreviewEditorProps {
  content: string;
  onChange: (html: string) => void;
  fontFamily?: string;
  fontSize?: number;
  lineSpacing?: number;
}

const clampPt = (value: number) => Math.min(12, Math.max(8, Math.round(value)));

export default function OficioPreviewEditor({
  content,
  onChange,
  fontFamily = "Arial",
  fontSize = 11,
  lineSpacing = 1.5,
}: OficioPreviewEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isInternalChange = useRef(false);
  const baseFontSize = clampPt(fontSize);

  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content || "";
    }
  }, [content]);

  const exec = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    isInternalChange.current = true;
    onChange(editorRef.current?.innerHTML || "");
  }, [onChange]);

  const getSelectionRange = useCallback((): Range | null => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    const commonNode = range.commonAncestorContainer;
    if (!editor.contains(commonNode)) return null;
    return range;
  }, []);

  const getCurrentSelectionFontPt = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return baseFontSize;
    const anchorNode = selection.anchorNode;
    if (!anchorNode) return baseFontSize;
    const element = anchorNode.nodeType === Node.ELEMENT_NODE
      ? (anchorNode as HTMLElement)
      : anchorNode.parentElement;
    if (!element) return baseFontSize;
    const px = parseFloat(window.getComputedStyle(element).fontSize || "");
    if (Number.isNaN(px) || px <= 0) return baseFontSize;
    return clampPt(px * 0.75);
  }, [baseFontSize]);

  const applyFontSizeToSelection = useCallback((delta: number) => {
    const editor = editorRef.current;
    const range = getSelectionRange();
    if (!editor || !range || range.collapsed) {
      toast.warning("Selecione o texto para ajustar o tamanho da fonte");
      return;
    }

    const currentPt = getCurrentSelectionFontPt();
    const targetPt = clampPt(currentPt + delta);

    const span = document.createElement("span");
    span.style.fontSize = `${targetPt}pt`;

    const contentFragment = range.extractContents();
    span.appendChild(contentFragment);
    range.insertNode(span);

    const selection = window.getSelection();
    if (selection) {
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    editor.focus();
    isInternalChange.current = true;
    onChange(editor.innerHTML || "");
  }, [getCurrentSelectionFontPt, getSelectionRange, onChange]);

  const handleInput = useCallback(() => {
    isInternalChange.current = true;
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
      className="inline-flex items-center gap-0.5 p-1.5 rounded transition-colors text-muted-foreground hover:bg-muted"
    >
      {children}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 p-1.5 bg-muted/50 border border-border rounded-lg mb-2 sticky top-0 z-10">
        <ToolBtn onClick={() => exec("undo")} title="Desfazer (Ctrl+Z)">
          <Undo size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => exec("redo")} title="Refazer (Ctrl+Y)">
          <Redo size={14} />
        </ToolBtn>

        <div className="w-px h-4 bg-border mx-0.5" />

        <ToolBtn onClick={() => exec("bold")} title="Negrito (Ctrl+B)">
          <Bold size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => exec("italic")} title="Itálico (Ctrl+I)">
          <Italic size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => exec("underline")} title="Sublinhado (Ctrl+U)">
          <UnderlineIcon size={14} />
        </ToolBtn>

        <div className="w-px h-4 bg-border mx-0.5" />

        <ToolBtn onClick={() => exec("insertUnorderedList")} title="Lista com marcadores">
          <List size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => exec("insertOrderedList")} title="Lista numerada">
          <ListOrdered size={14} />
        </ToolBtn>

        <div className="w-px h-4 bg-border mx-0.5" />

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

        <div className="w-px h-4 bg-border mx-0.5" />
        <ToolBtn onClick={() => applyFontSizeToSelection(-1)} title="Diminuir tamanho da seleção">
          <Type size={14} />
          <span className="text-[11px] font-semibold leading-none">-</span>
        </ToolBtn>
        <ToolBtn onClick={() => applyFontSizeToSelection(1)} title="Aumentar tamanho da seleção">
          <Type size={14} />
          <span className="text-[11px] font-semibold leading-none">+</span>
        </ToolBtn>
        <span className="px-1 text-[11px] text-muted-foreground">seleção 8–12pt</span>

        <div className="w-px h-4 bg-border mx-0.5" />

        <ToolBtn onClick={() => exec("removeFormat")} title="Limpar formatação">
          <Eraser size={14} />
        </ToolBtn>

        <div className="w-px h-4 bg-border mx-0.5" />

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
          fontSize: `${baseFontSize}pt`,
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
          font-size: ${baseFontSize}pt;
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
