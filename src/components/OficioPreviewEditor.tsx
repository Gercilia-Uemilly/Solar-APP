import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import { useEffect, useCallback, useRef } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo, Redo, Eraser, Type,
} from "lucide-react";

interface OficioPreviewEditorProps {
  content: string;
  onChange: (html: string) => void;
}

const FONT_SIZES = ["10", "11", "12", "14", "16", "18", "20"];

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
    };
  },
});

export default function OficioPreviewEditor({ content, onChange }: OficioPreviewEditorProps) {
  const isExternalUpdate = useRef(false);

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
    ],
    content,
    onUpdate: ({ editor }) => {
      if (!isExternalUpdate.current) {
        onChange(editor.getHTML());
      }
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

  // Sync external content only when editor is NOT focused (avoids resetting user edits like alignment)
  useEffect(() => {
    if (editor && !editor.isFocused && content !== editor.getHTML()) {
      isExternalUpdate.current = true;
      editor.commands.setContent(content);
      isExternalUpdate.current = false;
    }
  }, [content, editor]);

  const setFontSize = useCallback((size: string) => {
    if (!editor) return;
    editor.chain().focus().setMark("textStyle", { fontSize: size }).run();
  }, [editor]);

  if (!editor) return null;

  const ToolBtn = ({ onClick, active, children, title }: {
    onClick: () => void; active?: boolean; children: React.ReactNode; title: string;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Ensure editor keeps focus
        editor.chain().focus().run();
        onClick();
      }}
      title={title}
      className={`p-1.5 rounded transition-colors ${active ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-200"}`}
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

        {/* Font Size */}
        <div className="flex items-center gap-1">
          <Type size={13} className="text-gray-500" />
          <select
            className="text-xs bg-white border border-gray-300 rounded px-1 py-1 h-7"
            onChange={(e) => {
              setFontSize(e.target.value);
              // Refocus editor after select change
              setTimeout(() => editor.chain().focus().run(), 0);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            defaultValue="11"
          >
            {FONT_SIZES.map(s => (
              <option key={s} value={s}>{s}pt</option>
            ))}
          </select>
        </div>

        {/* Text Color */}
        <input
          type="color"
          className="w-7 h-7 rounded border border-gray-300 cursor-pointer p-0"
          defaultValue="#000000"
          title="Cor do texto"
          onMouseDown={(e) => e.stopPropagation()}
          onInput={(e) => {
            editor.chain().focus().setColor((e.target as HTMLInputElement).value).run();
          }}
        />

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

        {/* Undo/Redo */}
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Desfazer (Ctrl+Z)">
          <Undo size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Refazer (Ctrl+Y)">
          <Redo size={15} />
        </ToolBtn>
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
      `}</style>
    </div>
  );
}
