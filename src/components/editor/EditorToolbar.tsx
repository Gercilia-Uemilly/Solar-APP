import { type Editor } from "@tiptap/react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered, Undo, Redo, Eraser,
  ImagePlus, Link as LinkIcon, Highlighter, Mic, MicOff, Type,
} from "lucide-react";

interface EditorToolbarProps {
  editor: Editor;
}

const FONT_FAMILIES = [
  { label: "Arial", value: "Arial" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Calibri", value: "Calibri" },
  { label: "Georgia", value: "Georgia" },
  { label: "Courier New", value: "Courier New" },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24];

const COLORS = [
  "#000000", "#333333", "#666666", "#1a56db", "#047857",
  "#dc2626", "#9333ea", "#ca8a04", "#0891b2", "#be185d",
];

export default function EditorToolbar({ editor }: EditorToolbarProps) {
  const [isDictating, setIsDictating] = useState(false);
  const recognitionRef = useRef<any>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const ToolBtn = ({ onClick, active, children, title }: {
    onClick: () => void; active?: boolean; children: React.ReactNode; title: string;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`inline-flex items-center gap-0.5 p-1.5 rounded transition-colors ${
        active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );

  const Sep = () => <div className="w-px h-4 bg-border mx-0.5" />;

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
      editor.chain().focus().setImage({ src: reader.result as string }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [editor]);

  const handleLink = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL do link:", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const toggleDictation = useCallback(() => {
    if (isDictating && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsDictating(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Seu navegador não suporta ditado por voz.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results as SpeechRecognitionResultList)
        .slice(e.resultIndex)
        .map((r: any) => r[0].transcript)
        .join("");
      if (transcript) {
        editor.chain().focus().insertContent(transcript).run();
      }
    };
    recognition.onerror = () => { setIsDictating(false); };
    recognition.onend = () => { setIsDictating(false); };
    recognition.start();
    recognitionRef.current = recognition;
    setIsDictating(true);
    toast.success("🎤 Ditado ativo — fale agora.");
  }, [isDictating, editor]);

  const currentFontFamily = editor.getAttributes("textStyle").fontFamily || "Arial";
  const currentFontSizeRaw = editor.getAttributes("textStyle").fontSize;
  const currentFontSize = currentFontSizeRaw ? parseInt(currentFontSizeRaw) : 10;

  return (
    <div className="space-y-1">
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageInsert} />

      {/* Line 1: History, Font, Styles */}
      <div className="flex flex-wrap items-center gap-1 p-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-t-lg">
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Desfazer (Ctrl+Z)"><Undo size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Refazer (Ctrl+Y)"><Redo size={14} /></ToolBtn>

        <Sep />

        {/* Font Family */}
        <select
          value={currentFontFamily}
          onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
          className="h-7 text-xs border border-border rounded bg-background px-1 text-foreground"
          title="Fonte"
        >
          {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        {/* Font Size */}
        <select
          value={currentFontSize}
          onChange={(e) => {
            const { from, to } = editor.state.selection;
            if (from === to) {
              toast.info("Selecione o texto primeiro para alterar o tamanho.");
              return;
            }
            editor.chain().focus().setFontSize(`${e.target.value}pt`).run();
          }}
          className="h-7 text-xs border border-border rounded bg-background px-1 w-16 text-foreground"
          title="Tamanho da fonte"
        >
          {FONT_SIZES.map(n => <option key={n} value={n}>{n}pt</option>)}
        </select>

        <Sep />

        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Negrito (Ctrl+B)"><Bold size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Itálico (Ctrl+I)"><Italic size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Sublinhado (Ctrl+U)"><UnderlineIcon size={14} /></ToolBtn>

        <Sep />

        {/* Text Color */}
        <div className="relative group">
          <ToolBtn onClick={() => {}} title="Cor do texto">
            <Type size={14} />
            <div className="w-3 h-1 rounded-full" style={{ background: editor.getAttributes("textStyle").color || "#000" }} />
          </ToolBtn>
          <div className="absolute top-full left-0 z-50 hidden group-hover:grid grid-cols-5 gap-1 p-2 bg-popover border border-border rounded-lg shadow-lg">
            {COLORS.map(c => (
              <button
                key={c}
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(c).run(); }}
                className="w-5 h-5 rounded-full border border-border hover:scale-125 transition-transform"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Highlight */}
        <ToolBtn onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()} active={editor.isActive("highlight")} title="Realce">
          <Highlighter size={14} />
        </ToolBtn>
      </div>

      {/* Line 2: Alignment, Lists, Insert */}
      <div className="flex flex-wrap items-center gap-1 p-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-b-lg">
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Alinhar à esquerda"><AlignLeft size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Centralizar"><AlignCenter size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Alinhar à direita"><AlignRight size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="Justificar"><AlignJustify size={14} /></ToolBtn>

        <Sep />

        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista com marcadores"><List size={14} /></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Lista numerada"><ListOrdered size={14} /></ToolBtn>

        <Sep />

        <ToolBtn onClick={() => imageInputRef.current?.click()} title="Inserir imagem"><ImagePlus size={14} /></ToolBtn>
        <ToolBtn onClick={handleLink} active={editor.isActive("link")} title="Inserir/editar link"><LinkIcon size={14} /></ToolBtn>

        <Sep />

        <ToolBtn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Limpar formatação"><Eraser size={14} /></ToolBtn>

        <Sep />

        <ToolBtn onClick={toggleDictation} active={isDictating} title={isDictating ? "Parar ditado" : "Ditar texto (pt-BR)"}>
          {isDictating ? <MicOff size={14} className="text-destructive" /> : <Mic size={14} />}
          <span className="text-[10px] ml-0.5">{isDictating ? "Parar" : "Ditar"}</span>
        </ToolBtn>
      </div>
    </div>
  );
}
