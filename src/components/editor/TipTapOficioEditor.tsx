import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import TipTapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import FontSize from "./FontSizeExtension";
import EditorToolbar from "./EditorToolbar";
import { useEffect, useRef } from "react";

interface TipTapOficioEditorProps {
  content: string;
  onChange: (html: string) => void;
  fontFamily?: string;
  fontSize?: number;
  lineSpacing?: number;
}

export default function TipTapOficioEditor({
  content,
  onChange,
  fontFamily = "Arial",
  fontSize = 10,
  lineSpacing = 1.5,
}: TipTapOficioEditorProps) {
  const isInternalChange = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: { depth: 100 } }),
      Underline,
      TextStyle,
      Color,
      FontFamily.configure({ types: ["textStyle"] }),
      FontSize,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
        defaultAlignment: "justify",
      }),
      Highlight.configure({ multicolor: true }),
      TipTapImage.configure({
        allowBase64: true,
        inline: false,
        HTMLAttributes: { style: "max-width:100%; height:auto; display:block; margin:8px auto; border-radius:4px;" },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
      Typography,
      CharacterCount,
    ],
    content,
    editable: true,
    onUpdate: ({ editor: ed }) => {
      isInternalChange.current = true;
      onChange(ed.getHTML());
    },
  });

  // Sync external content changes (but not internal ones)
  useEffect(() => {
    if (!editor) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (editor.isFocused) return;
    const currentHtml = editor.getHTML();
    if (currentHtml !== content) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div>
      <EditorToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="tiptap-oficio-editor"
        style={{
          minHeight: "60px",
          fontSize: `${fontSize}pt`,
          lineHeight: String(lineSpacing),
          fontFamily: `${fontFamily}, Arial, sans-serif`,
          color: "#000",
        }}
      />
      <style>{`
        .tiptap-oficio-editor .tiptap {
          outline: none;
          min-height: 60px;
        }
        .tiptap-oficio-editor .tiptap p {
          text-indent: 1.25cm;
          margin-bottom: 0;
          margin-top: 0;
          line-height: ${lineSpacing};
          font-size: ${fontSize}pt;
        }
        .tiptap-oficio-editor .tiptap ul,
        .tiptap-oficio-editor .tiptap ol {
          padding-left: 2cm;
          margin-bottom: 10px;
        }
        .tiptap-oficio-editor .tiptap img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 8px auto;
          border-radius: 4px;
        }
        .tiptap-oficio-editor .tiptap a {
          color: hsl(var(--primary));
          text-decoration: underline;
        }
        .tiptap-oficio-editor .tiptap mark {
          border-radius: 2px;
          padding: 0 2px;
        }
      `}</style>
    </div>
  );
}
