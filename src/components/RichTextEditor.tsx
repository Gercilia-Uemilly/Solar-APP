import { Textarea } from "@/components/ui/textarea";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = "Descreva a demanda...",
}: RichTextEditorProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <Textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[220px] border-0 rounded-none bg-transparent focus-visible:ring-0 resize-y"
      />
    </div>
  );
}
