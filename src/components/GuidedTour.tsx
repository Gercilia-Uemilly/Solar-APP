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
      "Este é o Sistema de Gerenciamento de Mandato. Vamos fazer um tour rápido mostrando cada funcionalidade do sistema.\n\nUse as setas ← → do teclado ou clique em Próximo para avançar.",
  },
  {
    title: "🚀 Guia Rápido – Como Criar um Ofício",
    description:
      "1. ACESSO AO SISTEMA\n   Entre com seu email e senha. Se não tiver conta, clique em \"Criar conta\".\n\n2. CONECTAR GOOGLE DRIVE\n   Vá em Configurações e conecte sua conta Google para exportar documentos.\n\n3. CRIAR NOVO OFÍCIO\n   No menu lateral, clique em \"Novo Ofício\".\n\n4. PREENCHER AS INFORMAÇÕES\n   Selecione a secretaria, preencha assunto, bairro e solicitante.\n\n5. GERAR TEXTO COM IA\n   Escreva uma descrição curta ou cole uma conversa de WhatsApp e clique em \"✨ Gerar Texto com IA\".\n\n6. REVISAR E EDITAR\n   Leia o texto gerado e faça ajustes se necessário.\n\n7. VISUALIZAR\n   Na aba \"Visualizar\", confira o preview formatado com cabeçalho oficial.\n\n8. SALVAR OU EXPORTAR\n   Salve como rascunho, exporte para Word, PDF ou envie ao Google Drive.\n\n9. ORGANIZAÇÃO\n   Classifique como: Rascunho, Protocolado ou Respondido.\n\n💡 Dica: Sempre revise antes de enviar.",
  },
  {
    title: "📊 Painel (Dashboard)",
    description:
      "A tela inicial do sistema. Aqui você encontra:\n\n• Resumo geral: total de ofícios, pendentes e concluídos\n• Gráficos por operador e por bairro\n• Ranking dos bairros com mais demandas\n• Atalhos rápidos para as principais páginas\n\n👉 Clique em \"Painel\" no menu lateral para voltar a esta tela a qualquer momento.",
  },
  {
    title: "📝 Novo Ofício – Dados (1/3)",
    description:
      "Para criar um ofício:\n\n1. Clique em \"Novo Ofício\" no menu lateral\n2. Clique no botão \"+ Novo Ofício\" no topo da página\n3. Na aba \"Dados\", preencha:\n   • Secretaria (preenche o destinatário automaticamente)\n   • Assunto e Bairro (obrigatórios)\n   • Solicitante e WhatsApp do solicitante\n4. No campo \"Descrição da demanda\", escreva o problema\n\n💡 Sugestões de ofícios similares aparecem automaticamente enquanto você preenche.",
  },
  {
    title: "✨ Novo Ofício – IA e Geração (2/3)",
    description:
      "O campo de descrição aceita 3 tipos de entrada:\n\n1. Descrição curta — ex: \"buraco na Rua das Flores, bairro Martins\"\n2. Conversa de WhatsApp — cole a conversa e a IA extrai os dados\n3. Narrativa detalhada — a IA formaliza o texto\n\nDepois de preencher, clique em \"✨ Gerar Texto com IA\" para criar o corpo do ofício automaticamente.\n\n💡 A IA consulta a Base de Conhecimento para enriquecer o texto.",
  },
  {
    title: "👁️ Novo Ofício – Visualizar e Exportar (3/3)",
    description:
      "Na aba \"Visualizar\":\n\n1. Veja a prévia do ofício com cabeçalho oficial\n2. Edite o texto diretamente no preview (clique no conteúdo)\n3. Insira imagens no corpo do texto usando o botão 🖼️\n4. Use a barra de formatação para ajustar fonte e espaçamento\n\nBotões de ação:\n   • 💾 Salvar — salva sem fechar\n   • ✓ Salvar e Fechar — salva e volta à lista\n   • 📝 Word — exporta como .docx\n   • 📄 PDF — gera o PDF final\n   • ☁️ Drive — envia direto ao Google Drive",
  },
  {
    title: "📂 Todos os Ofícios",
    description:
      "Para consultar ofícios já criados:\n\n1. Clique em \"Todos os Ofícios\" no menu lateral\n2. Use a barra de busca para pesquisar por assunto, destinatário ou número\n3. Filtre por status, operador ou período de datas\n4. Abas disponíveis:\n   • 📝 Rascunhos — ofícios em andamento\n   • 📬 Finalizados — protocolados, feitos ou respondidos\n5. Clique no ícone 👁️ para visualizar, editar conteúdo inline, exportar ou excluir\n\n💡 Você pode alterar o marcador e status diretamente na lista.",
  },
  {
    title: "💬 Respostas ao Cidadão",
    description:
      "Na página \"Respostas\":\n\n• Gere respostas empáticas e personalizadas para devolver ao cidadão\n• A IA cria uma mensagem amigável com base no ofício e no status da demanda\n• Ideal para responder via WhatsApp ao solicitante\n\n👉 Clique em \"Respostas\" no menu lateral.",
  },
  {
    title: "📚 Banco de Informações",
    description:
      "A Central de Inteligência reúne toda a base de conhecimento:\n\n• Aba \"Base\": pesquise e filtre notícias, links e referências cadastradas\n• Aba \"Scripts\": modelos de texto prontos para copiar e usar no atendimento\n• Aba \"Upload\": envie PDF, DOCX, CSV ou imagens para extração automática de texto\n• Aba \"SOS Uberlândia\" (admin): importe notícias automaticamente\n• Aba \"Instagram\": importe posts por URL\n\n⭐ Marque entradas como \"Modelo\" para calibrar o tom de voz da IA.\n💡 A IA consulta toda esta base ao gerar ofícios e respostas.",
  },
  {
    title: "📱 WhatsApp",
    description:
      "O sistema tem integração com WhatsApp:\n\n• \"WhatsApp\" — conecte uma instância para envio e recebimento de mensagens\n• \"Mensagens WA\" — visualize conversas recebidas e gerencie atendimentos\n\n👉 Acesse pelo menu lateral clicando em \"WhatsApp\" ou \"Mensagens WA\".",
  },
  {
    title: "👥 Operadores (Admin)",
    description:
      "Para gerenciar os operadores do sistema (apenas administradores):\n\n1. Clique em \"Operadores\" no menu lateral\n2. Para convidar: clique \"+ Convidar Operador\" e preencha e-mail e nome\n3. Para ativar/desativar: use o botão ao lado do nome\n4. Para promover a admin: clique no ícone de escudo\n\n⚠️ Apenas administradores veem esta opção no menu.",
  },
  {
    title: "📊 Relatórios (Admin)",
    description:
      "Na página de Relatórios, administradores podem:\n\n• Visualizar estatísticas gerais do sistema\n• Acompanhar a produtividade por operador\n• Analisar demandas por bairro e secretaria\n\n👉 Clique em \"Relatórios\" no menu lateral (visível apenas para admins).",
  },
  {
    title: "⚙️ Configurações",
    description:
      "Para ajustar seu perfil e preferências:\n\n1. Clique em \"Configurações\" no menu lateral\n2. Atualize seu nome e foto de perfil\n3. Configure até 3 números de telefone (aparecem nas opções do ofício)\n4. Alterne entre tema claro e escuro\n5. Conecte e autorize o Google Drive para exportação de documentos",
  },
  {
    title: "📞 Suporte",
    description:
      "Precisa de ajuda?\n\n1. Clique no botão \"🎧 Suporte\" na parte inferior do menu lateral\n2. Escolha entre:\n   • 💬 Chat via WhatsApp — para resposta rápida\n   • ✉️ Formulário de e-mail — descreva seu problema ou sugestão\n\nSuas mensagens ficam registradas e serão respondidas o mais breve possível.",
  },
  {
    title: "🎉 Tutorial Completo!",
    description:
      "Agora você conhece todas as funcionalidades do Solar!\n\nResumo rápido:\n• Painel → visão geral e gráficos\n• Novo Ofício → criar ofícios com IA\n• Todos os Ofícios → consultar, editar e exportar\n• Respostas → mensagens empáticas ao cidadão\n• Banco de Info → base de conhecimento + scripts\n• WhatsApp → integração para mensagens\n• Operadores → gerenciar equipe (admin)\n• Relatórios → estatísticas (admin)\n• Configurações → perfil e Google Drive\n\n👉 Clique em \"Tutorial\" no menu lateral sempre que precisar rever.",
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

              <motion.div
                key={`desc-${step}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line max-h-[50vh] overflow-y-auto pr-1"
              >
                {current.description}
              </motion.div>
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
