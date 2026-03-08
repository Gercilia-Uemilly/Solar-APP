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
      "Este é o Sistema de Gerenciamento de Mandato. Vamos fazer um tour completo, passo a passo, mostrando onde clicar e como usar cada funcionalidade. Use as setas ← → ou clique em Próximo.",
  },
  {
    title: "📊 Painel (Dashboard)",
    description:
      "Esta é a tela inicial ao fazer login. Aqui você vê:\n\n• Resumo geral: total de ofícios, pendentes, em andamento e concluídos\n• Gráficos por operador e por bairro\n• Ranking dos bairros com mais demandas\n• Atalhos rápidos para as principais páginas\n\n👉 Clique em \"Painel\" no menu lateral esquerdo para voltar a esta tela a qualquer momento.",
  },
  {
    title: "📝 Criar um Novo Ofício (1/3)",
    description:
      "Para criar um ofício:\n\n1. Clique em \"Novo Ofício\" no menu lateral\n2. Clique no botão azul \"+ Novo Ofício\" no topo da página\n3. Na aba \"Dados\", preencha: tipo de serviço, assunto, destinatário, bairro e solicitante\n4. A secretaria é preenchida automaticamente conforme o tipo de serviço selecionado\n\n💡 Enquanto preenche, sugestões de ofícios similares aparecem automaticamente.",
  },
  {
    title: "📝 Texto e Mídias (2/3)",
    description:
      "Na aba \"Texto\" do ofício:\n\n1. Escreva ou cole a descrição da demanda\n2. Ou arraste/clique em \"Anexar Mídias\" para enviar fotos, áudios ou vídeos\n3. A IA transcreve áudios e extrai texto de imagens automaticamente\n4. Clique \"Inserir tudo na descrição\" para adicionar o conteúdo extraído\n5. Clique no botão \"✨ Gerar Ofício com IA\" para criar o texto formal\n\n🎤 Áudios enviados aqui ficam disponíveis para download — use os botões \"Baixar\" e \"WhatsApp\" para encaminhar ao solicitante.",
  },
  {
    title: "📝 Visualizar e Exportar (3/3)",
    description:
      "Na aba \"Visualizar\":\n\n1. Veja a prévia do ofício formatado com cabeçalho oficial\n2. Use a barra de formatação para ajustar tamanho da fonte, margens e espaçamento\n3. Clique \"📥 Word\" para exportar como documento editável\n4. Clique \"📄 PDF\" para gerar o PDF final\n5. Clique \"☁️ Drive\" para enviar direto ao Google Drive\n\nNa aba \"Status\", altere o status do ofício e veja/edite a resposta ao cidadão.",
  },
  {
    title: "📂 Todos os Ofícios",
    description:
      "Para consultar ofícios já criados:\n\n1. Clique em \"Todos os Ofícios\" no menu lateral\n2. Use a barra de busca para pesquisar por assunto, destinatário ou número\n3. Filtre por status (Rascunho, Gerado, Enviado, etc.)\n4. Filtre por operador ou período de datas\n5. Clique no ícone 👁️ para visualizar, 📥 para exportar ou 🗑️ para excluir\n\n💡 Administradores podem ver ofícios de todos os operadores.",
  },
  {
    title: "💬 Respostas ao Cidadão",
    description:
      "Para gerar uma resposta empática ao cidadão:\n\n1. Clique em \"Respostas\" no menu lateral\n2. Preencha: nome do solicitante, assunto, descrição da demanda\n3. Selecione secretaria, tipo de demanda e urgência\n4. Anexe fotos ou áudios se necessário\n5. Clique \"✨ Gerar Resposta\" — a IA cria um texto acolhedor e profissional\n6. Use \"📋 Copiar\" ou \"📱 WhatsApp\" para enviar a resposta",
  },
  {
    title: "📋 Scripts de Atendimento",
    description:
      "Para gerenciar modelos de texto prontos:\n\n1. Clique em \"Scripts\" no menu lateral\n2. Pesquise por título ou filtre por categoria\n3. Clique no ícone 📋 ao lado de qualquer script para copiar o texto\n4. Use a ⭐ para favoritar os scripts mais usados\n5. Clique \"+ Novo Script\" para criar um novo modelo\n\n💡 Scripts são usados pela IA como referência ao gerar respostas.",
  },
  {
    title: "🎤 Banco de Áudios",
    description:
      "Para gerenciar áudios de referência:\n\n1. Clique em \"Banco de Info\" no menu lateral\n2. Acesse a aba \"🎤 Áudios\"\n3. Clique \"Enviar Áudios\" para fazer upload (MP3, WAV, M4A, etc.)\n4. A IA transcreve o áudio automaticamente\n5. Para cada áudio você pode:\n   • ▶️ Ouvir direto no player\n   • 📥 Baixar o arquivo original\n   • 📱 Enviar o link via WhatsApp\n   • 📋 Copiar a transcrição\n   • ✨ Criar script a partir do conteúdo\n\n💡 Os áudios ficam em formato compatível com WhatsApp Web e celular.",
  },
  {
    title: "📚 Banco de Informações",
    description:
      "Para alimentar a base de conhecimento da IA:\n\n1. Aba \"Base\": pesquise e filtre todas as entradas cadastradas\n2. Aba \"SOS Uberlândia\" (admin): importe notícias automaticamente\n3. Aba \"Instagram\": importe posts do Instagram por URL\n4. Aba \"Upload\": envie PDF, DOCX, CSV ou imagens para extração de texto\n\n⭐ Marque entradas como \"Modelo\" para priorizar na geração de respostas.\n💡 A IA consulta toda esta base ao gerar ofícios e respostas.",
  },
  {
    title: "👥 Operadores (Admin)",
    description:
      "Para gerenciar os operadores do sistema (apenas administradores):\n\n1. Clique em \"Operadores\" no menu lateral\n2. Para convidar: clique \"+ Convidar Operador\" e preencha e-mail e nome\n3. Para ativar/desativar: use o botão ao lado do nome do operador\n4. Para promover a admin: clique no ícone de escudo\n\n⚠️ Apenas administradores veem esta opção no menu.",
  },
  {
    title: "⚙️ Configurações",
    description:
      "Para ajustar seu perfil e preferências:\n\n1. Clique em \"Configurações\" no menu lateral\n2. Atualize seu nome e foto de perfil\n3. Configure até 3 números de telefone (aparecem nas opções do ofício)\n4. Alterne entre tema claro e escuro\n5. Administradores podem autorizar o Google Drive aqui",
  },
  {
    title: "📞 Suporte",
    description:
      "Precisa de ajuda?\n\n1. Clique no botão \"🎧 Suporte\" na parte inferior do menu lateral\n2. Escolha entre:\n   • 💬 Chat via WhatsApp — para resposta rápida\n   • ✉️ Formulário de e-mail — descreva seu problema ou sugestão\n\nSuas mensagens ficam registradas e serão respondidas o mais breve possível.",
  },
  {
    title: "🎉 Tutorial Completo!",
    description:
      "Agora você conhece todas as funcionalidades do Solar!\n\nResumo rápido:\n• Painel → visão geral\n• Novo Ofício → criar ofícios com IA\n• Todos os Ofícios → consultar e exportar\n• Respostas → gerar textos para cidadãos\n• Scripts → modelos prontos\n• Áudios → banco de áudios para WhatsApp\n• Banco de Info → alimentar a IA\n\n👉 Clique em \"Tutorial\" no menu lateral sempre que precisar rever.",
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
