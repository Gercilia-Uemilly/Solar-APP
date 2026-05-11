import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { DuplicateMatch } from "@/lib/duplicateDetection";
import { cleanNumero } from "@/lib/oficioUtils";

interface Props {
  duplicates: DuplicateMatch[];
  onOpenOficio?: (oficioId: string) => void;
}

export default function DuplicateBadge({ duplicates, onOpenOficio }: Props) {
  const [open, setOpen] = useState(false);
  if (!duplicates || duplicates.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title={`${duplicates.length} possível(is) duplicata(s)`}
        className="ml-1.5 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 transition-colors"
      >
        <AlertTriangle size={10} />
        {duplicates.length} duplicata{duplicates.length > 1 ? "s" : ""}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-orange-500" />
              Possíveis ofícios duplicados
            </DialogTitle>
            <DialogDescription>
              Foram encontrados {duplicates.length} ofício(s) com sinais de duplicação. Confira
              antes de prosseguir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {duplicates.map(({ oficio, reasons, score }) => (
              <button
                key={oficio.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenOficio?.(oficio.id);
                }}
                className="w-full text-left p-3 rounded border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-sm">
                    Ofício nº {oficio.numero ? cleanNumero(oficio.numero) : "—"}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/30">
                    {Math.round(score * 100)}% match
                  </span>
                </div>
                <div className="text-xs text-foreground/80 line-clamp-1">
                  {oficio.assunto || "(sem assunto)"}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {oficio.destinatario || oficio.secretaria_identificada || "—"}
                  {oficio.bairro ? ` • ${oficio.bairro}` : ""}
                  {oficio.solicitante ? ` • ${oficio.solicitante}` : ""}
                </div>
                <ul className="mt-1.5 flex flex-wrap gap-1">
                  {reasons.map((r, i) => (
                    <li
                      key={i}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground/80 border border-border"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}