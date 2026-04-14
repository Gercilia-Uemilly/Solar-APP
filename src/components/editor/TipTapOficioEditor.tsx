import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
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
import { useEffect, useRef, useCallback } from "react";

interface TipTapOficioEditorProps {
  content: string;
  onChange: (html: string) => void;
  fontFamily?: string;
  fontSize?: number;
  lineSpacing?: number;
  showToolbar?: boolean;
}

export default function TipTapOficioEditor({
  content,
  onChange,
  fontFamily = "Arial",
  fontSize = 10,
  lineSpacing = 1.5,
  showToolbar = true,
}: TipTapOficioEditorProps) {
  // Track whether a change originated from user typing inside the editor
  const userEditingRef = useRef(false);
  // The last HTML we sent to onChange — prevents echo loops
  const lastEmittedRef = useRef("");
  // The last HTML we received via props — prevents unnecessary setContent
  const lastPropContentRef = useRef("");
  // Whether initial content has been loaded
  const initializedRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
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
      const newHtml = ed.getHTML();
      // Only emit if content actually changed from what we last emitted
      if (newHtml === lastEmittedRef.current) return;
      lastEmittedRef.current = newHtml;
      // Mark that this change came from user editing
      userEditingRef.current = true;
      onChange(newHtml);
      // Reset flag after a tick to allow external updates
      requestAnimationFrame(() => {
        userEditingRef.current = false;
      });
    },
  });

  // Initialize lastPropContentRef and lastEmittedRef on first render
  useEffect(() => {
    if (editor && content && !initializedRef.current) {
      initializedRef.current = true;
      lastPropContentRef.current = content;
      lastEmittedRef.current = content;
    }
  }, [editor, content]);

  // Sync external content changes into the editor
  // ONLY when the change did NOT originate from user editing
  useEffect(() => {
    if (!editor) return;
    // If this update was triggered by the editor's own onChange, skip it
    if (userEditingRef.current) return;
    // If editor is focused, user is actively typing — don't disrupt
    if (editor.isFocused) return;
    // If the prop content is the same as what we last set, skip
    if (content === lastPropContentRef.current) return;
    // If the prop content matches what the editor already has, skip
    if (content === editor.getHTML()) {
      lastPropContentRef.current = content;
      return;
    }

    lastPropContentRef.current = content;
    lastEmittedRef.current = content;
    editor.commands.setContent(content || "<p></p>", false);
  }, [content, editor]);

  // Reset on unmount
  useEffect(() => {
    return () => {
      initializedRef.current = false;
      userEditingRef.current = false;
    };
  }, []);

  if (!editor) return null;

  return (
    <div>
      {showToolbar ? <EditorToolbar editor={editor} /> : null}
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
