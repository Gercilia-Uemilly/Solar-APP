import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignJustify, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useCallback } from "react";

export interface FormatOptions {
  fontSize: number;
  lineSpacing: number;
  signatureHeight: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  textAlign: "left" | "center" | "justify";
}

export const defaultFormatOptions: FormatOptions = {
  fontSize: 10,
  lineSpacing: 1.5,
  signatureHeight: 140,
  fontFamily: "Arial",
  bold: false,
  italic: false,
  underline: false,
  textAlign: "justify",
};

interface Props {
  options: FormatOptions;
  onChange: (opts: FormatOptions) => void;
  onUndo?: () => void;
  hasChanges?: boolean;
}

export default function PreviewFormatToolbar({ options, onChange, onUndo, hasChanges }: Props) {
  const update = (partial: Partial<FormatOptions>) => onChange({ ...options, ...partial });

  const applyCommand = useCallback((command: string) => {
    document.execCommand(command, false);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border text-sm">
      {/* Bold / Italic / Underline — applies to selected text */}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          onMouseDown={e => { e.preventDefault(); applyCommand("bold"); }}
          title="Negrito (selecione o texto)"
        >
          <Bold size={14} />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          onMouseDown={e => { e.preventDefault(); applyCommand("italic"); }}
          title="Itálico (selecione o texto)"
        >
          <Italic size={14} />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          onMouseDown={e => { e.preventDefault(); applyCommand("underline"); }}
          title="Sublinhado (selecione o texto)"
        >
          <Underline size={14} />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Alinhamento */}
      <div className="flex items-center gap-1">
        <Button size="sm" variant={options.textAlign === "left" ? "default" : "outline"} className="h-8 w-8 p-0" onClick={() => update({ textAlign: "left" })} title="Alinhar à esquerda">
          <AlignLeft size={14} />
        </Button>
        <Button size="sm" variant={options.textAlign === "center" ? "default" : "outline"} className="h-8 w-8 p-0" onClick={() => update({ textAlign: "center" })} title="Centralizar">
          <AlignCenter size={14} />
        </Button>
        <Button size="sm" variant={options.textAlign === "justify" ? "default" : "outline"} className="h-8 w-8 p-0" onClick={() => update({ textAlign: "justify" })} title="Justificar">
          <AlignJustify size={14} />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Fonte */}
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Fonte:</Label>
        <Select value={options.fontFamily} onValueChange={(v) => update({ fontFamily: v })}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Arial">Arial</SelectItem>
            <SelectItem value="Times New Roman">Times New Roman</SelectItem>
            <SelectItem value="Calibri">Calibri</SelectItem>
            <SelectItem value="Georgia">Georgia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tamanho da fonte */}
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Tam:</Label>
        <Select value={String(options.fontSize)} onValueChange={(v) => update({ fontSize: Number(v) })}>
          <SelectTrigger className="h-8 w-[65px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 11, 12, 13, 14, 16, 18].map((s) => (
              <SelectItem key={s} value={String(s)}>{s}pt</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Espaçamento */}
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Espaço:</Label>
        <Select value={String(options.lineSpacing)} onValueChange={(v) => update({ lineSpacing: Number(v) })}>
          <SelectTrigger className="h-8 w-[65px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1.0</SelectItem>
            <SelectItem value="1.15">1.15</SelectItem>
            <SelectItem value="1.5">1.5</SelectItem>
            <SelectItem value="2">2.0</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assinatura slider removido — tamanho fixo 6cm x proporcional */}

      {/* Desfazer alteração */}
      {hasChanges && onUndo && (
        <>
          <Separator orientation="vertical" className="h-6" />
          <Button
            size="sm"
            variant="destructive"
            className="h-8 gap-1 text-xs"
            onClick={onUndo}
            title="Desfazer todas as edições"
          >
            <Undo2 size={13} /> Desfazer
          </Button>
        </>
      )}
    </div>
  );
}
