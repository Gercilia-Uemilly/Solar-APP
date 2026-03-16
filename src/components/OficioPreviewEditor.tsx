import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TiptapImage from "@tiptap/extension-image";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Bold, Italic, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo, Redo, Eraser,
  ImagePlus,
} from "lucide-react";

interface OficioPreviewEditorProps {
  content: string;
  onChange: (html: string) => void;
}

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
      TiptapImage.configure({
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
      className={`p-1.5 rounded transition-colors ${disabled ? "opacity-30 cursor-not-allowed" : active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
    >
      {children}
    </button>
  );

  return (
    <div>
      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-1 p-2 bg-muted border border-border rounded-t-lg sticky top-0 z-10"
        onMouseDown={(e) => e.preventDefault()}
      >
        {/* Undo/Redo */}
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Desfazer (Ctrl+Z)">
          <Undo size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Refazer (Ctrl+Y)">
          <Redo size={15} />
        </ToolBtn>

        <div className="w-px h-5 bg-border mx-1" />

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

        <div className="w-px h-5 bg-border mx-1" />

        {/* Lists */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista com marcadores">
          <List size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Lista numerada">
          <ListOrdered size={15} />
        </ToolBtn>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Clear formatting */}
        <ToolBtn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Limpar formatação">
          <Eraser size={15} />
        </ToolBtn>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Insert Image */}
        <ToolBtn onClick={() => imageInputRef.current?.click()} title="Inserir imagem">
          <ImagePlus size={15} />
        </ToolBtn>
      </div>

      {/* Hidden image input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageInsert}
      />

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
        .oficio-editor-body img {
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
