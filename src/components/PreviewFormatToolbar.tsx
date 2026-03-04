import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignJustify } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export interface FormatOptions {
  fontSize: number;        // pt
  lineSpacing: number;     // multiplier (1, 1.5, 2)
  signatureHeight: number; // px for preview
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  textAlign: "left" | "center" | "justify";
}

export const defaultFormatOptions: FormatOptions = {
  fontSize: 11,
  lineSpacing: 1.15,
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
}

export default function PreviewFormatToolbar({ options, onChange }: Props) {
  const update = (partial: Partial<FormatOptions>) => onChange({ ...options, ...partial });

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border text-sm">
      {/* Bold / Italic / Underline */}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant={options.bold ? "default" : "outline"}
          className="h-8 w-8 p-0"
          onClick={() => update({ bold: !options.bold })}
          title="Negrito"
        >
          <Bold size={14} />
        </Button>
        <Button
          size="sm"
          variant={options.italic ? "default" : "outline"}
          className="h-8 w-8 p-0"
          onClick={() => update({ italic: !options.italic })}
          title="Itálico"
        >
          <Italic size={14} />
        </Button>
        <Button
          size="sm"
          variant={options.underline ? "default" : "outline"}
          className="h-8 w-8 p-0"
          onClick={() => update({ underline: !options.underline })}
          title="Sublinhado"
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

      <Separator orientation="vertical" className="h-6" />

      {/* Assinatura */}
      <div className="flex items-center gap-2 min-w-[180px]">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Assinatura:</Label>
        <Slider
          value={[options.signatureHeight]}
          min={60}
          max={300}
          step={10}
          onValueChange={([v]) => update({ signatureHeight: v })}
          className="w-[100px]"
        />
        <span className="text-xs text-muted-foreground w-8">{options.signatureHeight}</span>
      </div>
    </div>
  );
}
