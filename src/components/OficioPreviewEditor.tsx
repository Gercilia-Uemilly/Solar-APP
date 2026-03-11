import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { useEffect, useCallback, useRef } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo, Redo, Eraser, Type, Highlighter, Link as LinkIcon,
} from "lucide-react";

interface OficioPreviewEditorProps {
  content: string;
  onChange: (html: string) => void;
}

const FONT_SIZES = ["9", "10", "11", "12", "14", "16", "18", "20", "24"];
const FONT_FAMILIES = ["Arial", "Times New Roman", "Calibri", "Verdana", "Georgia"];

const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontSize?.replace(/pt|px/, "") || null,
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}pt` };
        },
      },
      fontFamily: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontFamily?.replace(/['"]/g, "") || null,
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.fontFamily) return {};
          return { style: `font-family: ${attributes.fontFamily}` };
        },
      },
    };
  },
});

export default function OficioPreviewEditor({ content, onChange }: OficioPreviewEditorProps) {
  const initialContent = useRef(content);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Underline,
      FontSize,
      Color,
      TextAlign.configure({
        types: ["paragraph"],
        defaultAlignment: "justify",
      }),
      Highlight.configure({ multicolor: true }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          style: 'max-width: 100%; height: auto; display: block; margin: 8px auto;',
        },
      }),
    ],
    content: initialContent.current,
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "oficio-editor-body",
        style: [
          "font-family: Arial, Helvetica, sans-serif",
          "font-size: 11pt",
          "line-height: 1.5",
          "color: #000",
          "text-align: justify",
          "outline: none",
          "min-height: 100px",
        ].join(";"),
      },
    },
  });

  const handleImageInsert = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      editor.chain().focus().setImage({ src: reader.result as string, alt: file.name }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [editor]);

  const setFontSize = useCallback((size: string) => {
    if (!editor) return;
    editor.chain().focus().setMark("textStyle", { fontSize: size }).run();
  }, [editor]);

  const setFontFamily = useCallback((family: string) => {
    if (!editor) return;
    editor.chain().focus().setMark("textStyle", { fontFamily: family }).run();
  }, [editor]);

  if (!editor) return null;

  const ToolBtn = ({ onClick, active, children, title, disabled }: {
    onClick: () => void; active?: boolean; children: React.ReactNode; title: string; disabled?: boolean;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        editor.chain().focus().run();
        onClick();
      }}
      title={title}
      className={`p-1.5 rounded transition-colors ${disabled ? "opacity-30 cursor-not-allowed" : active ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-200"}`}
    >
      {children}
    </button>
  );

  return (
    <div>
      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-1 p-2 bg-gray-100 border border-gray-300 rounded-t-lg sticky top-0 z-10"
        onMouseDown={(e) => e.preventDefault()}
      >
        {/* Undo/Redo FIRST */}
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Desfazer (Ctrl+Z)">
          <Undo size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Refazer (Ctrl+Y)">
          <Redo size={15} />
        </ToolBtn>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Font Family */}
        <select
          className="text-xs bg-white border border-gray-300 rounded px-1 py-1 h-7"
          onChange={(e) => {
            setFontFamily(e.target.value);
            setTimeout(() => editor.chain().focus().run(), 0);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          defaultValue="Arial"
        >
          {FONT_FAMILIES.map(f => (
            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
          ))}
        </select>

        {/* Font Size */}
        <select
          className="text-xs bg-white border border-gray-300 rounded px-1 py-1 h-7 w-14"
          onChange={(e) => {
            setFontSize(e.target.value);
            setTimeout(() => editor.chain().focus().run(), 0);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          defaultValue="11"
        >
          {FONT_SIZES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Bold/Italic/Underline */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Negrito (Ctrl+B)">
          <Bold size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Itálico (Ctrl+I)">
          <Italic size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Sublinhado (Ctrl+U)">
          <UnderlineIcon size={15} />
        </ToolBtn>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Text Color */}
        <div className="relative" title="Cor do texto">
          <input
            type="color"
            className="w-7 h-7 rounded border border-gray-300 cursor-pointer p-0"
            defaultValue="#000000"
            onMouseDown={(e) => e.stopPropagation()}
            onInput={(e) => {
              editor.chain().focus().setColor((e.target as HTMLInputElement).value).run();
            }}
          />
        </div>

        {/* Highlight */}
        <ToolBtn onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} active={editor.isActive("highlight")} title="Realce">
          <Highlighter size={15} />
        </ToolBtn>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Alignment */}
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Alinhar à esquerda">
          <AlignLeft size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Centralizar">
          <AlignCenter size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Alinhar à direita">
          <AlignRight size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="Justificar">
          <AlignJustify size={15} />
        </ToolBtn>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Lists */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista com marcadores">
          <List size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Lista numerada">
          <ListOrdered size={15} />
        </ToolBtn>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Clear formatting */}
        <ToolBtn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Limpar formatação">
          <Eraser size={15} />
        </ToolBtn>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      <style>{`
        .oficio-editor-body p {
          text-indent: 1.25cm;
          margin-bottom: 10px;
          font-size: 11pt;
          line-height: 1.5;
        }
        .oficio-editor-body ul,
        .oficio-editor-body ol {
          padding-left: 2cm;
          margin-bottom: 10px;
        }
        .oficio-editor-body .ProseMirror {
          outline: none;
          min-height: 100px;
          padding: 8px;
        }
        .oficio-editor-body .ProseMirror:focus {
          outline: none;
        }
        .oficio-editor-body mark {
          background-color: #fef08a;
          padding: 0 2px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}