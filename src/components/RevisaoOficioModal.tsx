import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Lightbulb, Wand2 } from "lucide-react";

export interface RevisaoErro {
  campo: string;
  gravidade: "erro" | "aviso" | "sugestao";
  descricao: string;
  correcao: string;
}

export interface RevisaoResult {
  aprovado: boolean;
  pontuacao: number;
  erros: RevisaoErro[];
  resumo: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resultado: RevisaoResult | null;
  loading: boolean;
  onCorrigirCampo?: (campo: string, correcao: string) => void;
  onCorrigirTudo?: () => void;
  onExportarMesmoAssim?: () => void;
}

const CAMPO_LABELS: Record<string, string> = {
  assunto: "Assunto",
  destinatario: "Destinatário",
  vocativo: "Vocativo",
  texto: "Texto",
  endereco: "Endereço",
  numero: "Número",
  conclusao: "Conclusão",
  gramatica: "Gramática",
};

const CAMPOS_CHECK = ["numero", "destinatario", "assunto", "vocativo", "endereco", "texto", "conclusao", "gramatica"];

export default function RevisaoOficioModal({
  open,
  onOpenChange,
  resultado,
  loading,
  onCorrigirCampo,
  onCorrigirTudo,
  onExportarMesmoAssim,
}: Props) {
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());

  const getGravIcon = (g: string) => {
    if (g === "erro") return <XCircle size={14} className="text-destructive shrink-0" />;
    if (g === "aviso") return <AlertTriangle size={14} className="text-amber-500 shrink-0" />;
    return <Lightbulb size={14} className="text-blue-500 shrink-0" />;
  };

  const getGravLabel = (g: string) => {
    if (g === "erro") return "ERRO";
    if (g === "aviso") return "ATENÇÃO";
    return "SUGESTÃO";
  };

  const getGravBg = (g: string) => {
    if (g === "erro") return "bg-destructive/10 border-destructive/30";
    if (g === "aviso") return "bg-amber-500/10 border-amber-500/30";
    return "bg-blue-500/10 border-blue-500/30";
  };

  const camposComErro = new Set(resultado?.erros?.map(e => e.campo) || []);
  const temErrosGraves = resultado?.erros?.some(e => e.gravidade === "erro") || false;

  const handleApplyFix = (erro: RevisaoErro, index: number) => {
    onCorrigirCampo?.(erro.campo, erro.correcao);
    setAppliedFixes(prev => new Set(prev).add(`${erro.campo}-${index}`));
  };

  const handleApplyAll = () => {
    onCorrigirTudo?.();
    const allKeys = resultado?.erros?.map((e, i) => `${e.campo}-${i}`) || [];
    setAppliedFixes(new Set(allKeys));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setAppliedFixes(new Set()); onOpenChange(v); }}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            🔍 Revisão do Ofício
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Análise automática antes da exportação
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="animate-spin text-primary" size={32} />
            <p className="text-sm text-muted-foreground">Revisando ofício...</p>
          </div>
        )}

        {!loading && resultado && (
          <div className="space-y-4">
            {/* Score */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Pontuação</span>
                <span className={`font-bold ${resultado.pontuacao >= 80 ? "text-green-600" : resultado.pontuacao >= 50 ? "text-amber-500" : "text-destructive"}`}>
                  {resultado.pontuacao}/100
                </span>
              </div>
              <Progress value={resultado.pontuacao} className="h-2" />
            </div>

            {/* Checklist */}
            <div className="space-y-1.5">
              {CAMPOS_CHECK.map(campo => {
                const hasError = camposComErro.has(campo);
                const erros = resultado.erros?.filter(e => e.campo === campo) || [];
                const worstGrav = erros.find(e => e.gravidade === "erro") ? "erro" : erros.find(e => e.gravidade === "aviso") ? "aviso" : "sugestao";
                return (
                  <div key={campo} className="flex items-center gap-2 text-sm">
                    {hasError ? (
                      worstGrav === "erro" ? <XCircle size={14} className="text-destructive" /> :
                      worstGrav === "aviso" ? <AlertTriangle size={14} className="text-amber-500" /> :
                      <Lightbulb size={14} className="text-blue-500" />
                    ) : (
                      <CheckCircle2 size={14} className="text-green-600" />
                    )}
                    <span className="text-muted-foreground">{CAMPO_LABELS[campo] || campo}</span>
                    <span className="flex-1 border-b border-dotted border-muted-foreground/30 mx-1" />
                    <span className={`text-xs font-medium ${hasError ? (worstGrav === "erro" ? "text-destructive" : worstGrav === "aviso" ? "text-amber-500" : "text-blue-500") : "text-green-600"}`}>
                      {hasError ? (worstGrav === "erro" ? "ERRO" : worstGrav === "aviso" ? "ATENÇÃO" : "SUGESTÃO") : "OK"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Resumo */}
            <p className="text-sm text-muted-foreground italic">{resultado.resumo}</p>

            {/* Errors detail */}
            {resultado.erros && resultado.erros.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Problemas encontrados:</h4>
                {resultado.erros.map((erro, i) => {
                  const isFixed = appliedFixes.has(`${erro.campo}-${i}`);
                  return (
                    <div key={i} className={`p-3 rounded-lg border ${isFixed ? "bg-green-500/10 border-green-500/30 opacity-60" : getGravBg(erro.gravidade)}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {isFixed ? <CheckCircle2 size={14} className="text-green-600 shrink-0" /> : getGravIcon(erro.gravidade)}
                        <span className="text-xs font-bold">
                          {isFixed ? "CORRIGIDO" : getGravLabel(erro.gravidade)} — {CAMPO_LABELS[erro.campo] || erro.campo}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">{erro.descricao}</p>
                      {erro.correcao && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground">✏️ {erro.gravidade === "sugestao" ? "Sugestão:" : "Corrigir para:"}</p>
                          <p className="text-sm font-medium text-foreground mt-0.5">"{erro.correcao}"</p>
                          {!isFixed && onCorrigirCampo && (
                            <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => handleApplyFix(erro, i)}>
                              <CheckCircle2 size={12} className="mr-1" /> {erro.gravidade === "sugestao" ? "Aplicar sugestão" : "Corrigir automaticamente"}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              {resultado.erros && resultado.erros.length > 0 && resultado.erros.some(e => e.correcao) && onCorrigirTudo && (
                <Button size="sm" onClick={handleApplyAll} className="bg-primary">
                  <Wand2 size={14} className="mr-1" /> Corrigir tudo automaticamente
                </Button>
              )}
              {onExportarMesmoAssim && (
                <Button size="sm" variant={temErrosGraves ? "outline" : "default"} onClick={onExportarMesmoAssim}>
                  📄 {temErrosGraves ? "Exportar mesmo assim" : "Exportar"}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
                ✏️ Voltar e editar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
