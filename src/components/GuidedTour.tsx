import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TourStep {
  title: string;
  description: string;
  selector?: string; // CSS selector to highlight
  position?: "top" | "bottom" | "left" | "right";
  icon?: string;
}

const tourSteps: TourStep[] = [
  {
    title: "Bem-vindo ao Solar! ☀️",
    description:
      "Este é o Sistema de Gerenciamento de Mandato. Vamos fazer um tour rápido pelas principais funcionalidades.",
  },
  {
    title: "📊 Painel / Dashboard",
    description:
      "No Painel você encontra um resumo de todos os ofícios, gráficos por operador e bairro, e atalhos rápidos para as principais ações.",
  },
  {
    title: "📝 Novo Ofício",
    description:
      "Crie ofícios rapidamente. Preencha os dados da demanda, use a IA para gerar o texto automaticamente, visualize e exporte em Word ou PDF.",
  },
  {
    title: "📂 Todos os Ofícios",
    description:
      "Consulte, filtre e gerencie todos os ofícios já criados. Você pode buscar por assunto, status, operador ou período. Também é possível exportar e enviar ao Google Drive.",
  },
  {
    title: "💬 Respostas",
    description:
      "Gere respostas empáticas para os cidadãos com apoio da IA. Basta preencher os dados da demanda e clicar em gerar — a resposta fica pronta para copiar ou enviar via WhatsApp.",
  },
  {
    title: "📋 Scripts",
    description:
      "Salve modelos de texto prontos para atendimento. Organize por categoria, favorite os mais usados e encontre rapidamente com a busca.",
  },
  {
    title: "📚 Banco de Informações",
    description:
      "Importe notícias, dados do Instagram e arquivos (PDF, DOCX, imagens) para alimentar a base de conhecimento. A IA usa essa base para gerar ofícios e respostas mais precisos.",
  },
  {
    title: "⚙️ Configurações",
    description:
      "Atualize seu perfil, telefones de contato e aparência do sistema. Administradores também podem autorizar o Google Drive aqui.",
  },
  {
    title: "🎉 Pronto!",
    description:
      "Agora você já conhece as principais funcionalidades. Clique no botão de ajuda (?) na barra lateral sempre que quiser rever este tutorial. Bom trabalho!",
  },
];

interface GuidedTourProps {
  open: boolean;
  onClose: () => void;
}

export default function GuidedTour({ open, onClose }: GuidedTourProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const handleNext = useCallback(() => {
    if (step < tourSteps.length - 1) setStep((s) => s + 1);
    else onClose();
  }, [step, onClose]);

  const handlePrev = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, handleNext, handlePrev, onClose]);

  const current = tourSteps[step];
  const isLast = step === tourSteps.length - 1;
  const isFirst = step === 0;
  const progress = ((step + 1) / tourSteps.length) * 100;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            key={step}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative z-10 w-[90vw] max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
          >
            {/* Progress bar */}
            <div className="h-1 bg-muted">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X size={16} />
            </button>

            {/* Content */}
            <div className="p-6 sm:p-8">
              <div className="text-xs text-muted-foreground mb-3 font-medium">
                {step + 1} de {tourSteps.length}
              </div>

              <motion.h2
                key={`title-${step}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xl font-semibold text-foreground mb-3"
              >
                {current.title}
              </motion.h2>

              <motion.p
                key={`desc-${step}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className="text-sm text-muted-foreground leading-relaxed"
              >
                {current.description}
              </motion.p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 sm:px-8 pb-6 sm:pb-8 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                disabled={isFirst}
                className="gap-1"
              >
                <ChevronLeft size={14} />
                Anterior
              </Button>

              {/* Dots */}
              <div className="flex gap-1.5">
                {tourSteps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className={`w-2 h-2 rounded-full transition-all duration-200 ${
                      i === step
                        ? "bg-primary w-5"
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                  />
                ))}
              </div>

              <Button size="sm" onClick={handleNext} className="gap-1">
                {isLast ? "Concluir" : "Próximo"}
                {!isLast && <ChevronRight size={14} />}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Small help button to be placed in sidebar */
export function TourTriggerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Tutorial de uso"
      className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors"
    >
      <HelpCircle size={16} />
    </button>
  );
}
