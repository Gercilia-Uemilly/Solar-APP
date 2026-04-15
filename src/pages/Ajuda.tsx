import { useEffect } from "react";
import { 
  AlertTriangle, 
  RefreshCw, 
  FileDigit, 
  FileText, 
  Image, 
  HelpCircle,
  CheckCircle,
  MessageCircle,
  BookOpen,
  ChevronRight
} from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const sections = [
  {
    id: "drive",
    icon: RefreshCw,
    title: "Problema com Google Drive (Permissões)",
    errorMessage: "Desconecte e reconecte seu Google Drive em Configurações para atualizar as permissões.",
    steps: ["Configurações", "Google Drive", "Desconectar", "Conectar novamente"],
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200"
  },
  {
    id: "numero-duplicado",
    icon: FileDigit,
    title: "Número de Ofício duplicado",
    description: "Sempre conferir no Drive antes de exportar. Se já existir, usar o próximo número e avisar o administrador.",
    alert: "Vale sempre o primeiro que foi feito",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200"
  },
  {
    id: "incompleto",
    icon: FileText,
    title: "Ofício incompleto",
    description: "Ler até o final antes de exportar. Se faltar algo, corrigir antes.",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200"
  },
  {
    id: "imagens",
    icon: Image,
    title: "Imagens diferentes no preview e no Drive",
    description: "Pode acontecer do preview estar certo e no Drive sair diferente. Isso é normal em alguns casos, varia de imagem pra imagem.",
    action: "Se estiver aceitável → pode seguir. Se estiver ruim → avisar o administrador.",
    note: "Estamos ajustando para padronizar automaticamente",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200"
  },
  {
    id: "numero-sumiu",
    icon: HelpCircle,
    title: "Número mudou ou sumiu",
    description: "Usar o próximo número disponível e seguir normalmente.",
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200"
  },
  {
    id: "sistema-drive",
    icon: AlertTriangle,
    title: "Sistema diferente do Drive",
    description: "Sempre vale o que já está no Drive.",
    action: "Ajustar para o próximo número",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200"
  }
];

const checkList = [
  "Conferir número",
  "Conferir Drive",
  "Ler o ofício até o final"
];

const quandoAvisar = [
  "Número duplicando",
  "Imagem muito errada",
  "Sistema travando",
  "Qualquer coisa fora do padrão"
];

export default function Ajuda() {
  useEffect(() => {
    document.title = "Ajuda — Manual Rápido";
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="p-2 rounded-lg bg-primary/10">
          <BookOpen className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Manual Rápido</h1>
          <p className="text-sm text-muted-foreground">Problemas e Soluções do Sistema</p>
        </div>
      </motion.div>

      {/* Alerta inicial */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 shrink-0">
                💡 Antes de tudo
              </Badge>
              <div className="space-y-2">
                <p className="text-sm text-foreground">
                  O sistema ajuda muito, mas ainda pode ter falhas.
                </p>
                <p className="text-sm font-medium text-foreground">
                  Sempre conferir antes de finalizar.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Seções de problemas */}
      <div className="space-y-4">
        {sections.map((section, index) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
          >
            <Card className={`overflow-hidden border ${section.borderColor}`}>
              <CardHeader className={`${section.bgColor} py-4`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-white/80 ${section.color}`}>
                    <section.icon className="w-5 h-5" />
                  </div>
                  <CardTitle className={`text-base font-semibold ${section.color}`}>
                    {index + 1}. {section.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-4 pb-4 space-y-3">
                {section.errorMessage && (
                  <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800">
                    <strong>Mensagem:</strong> "{section.errorMessage}"
                  </div>
                )}
                
                {section.description && (
                  <p className="text-sm text-foreground leading-relaxed">
                    {section.description}
                  </p>
                )}

                {section.steps && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Como resolver:</span>
                    {section.steps.map((step, i) => (
                      <span key={i} className="flex items-center text-sm">
                        <span className="px-2 py-1 rounded bg-secondary text-secondary-foreground font-medium">
                          {step}
                        </span>
                        {i < section.steps.length - 1 && (
                          <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {section.alert && (
                  <div className="flex items-center gap-2 p-2 rounded bg-red-100 border border-red-200">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span className="text-sm font-medium text-red-700">{section.alert}</span>
                  </div>
                )}

                {section.action && (
                  <div className="p-3 rounded-md bg-muted/50 border border-border">
                    <p className="text-sm text-foreground">{section.action}</p>
                  </div>
                )}

                {section.note && (
                  <p className="text-xs text-muted-foreground italic">
                    💡 {section.note}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Separator />

      {/* Regra de ouro */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="bg-emerald-50/50">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-base font-semibold text-emerald-700">
                🧠 Regra de ouro — Antes de exportar:
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {checkList.map((item, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200"
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold">
                    ✔
                  </span>
                  <span className="text-sm font-medium text-emerald-800">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quando avisar administrador */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
      >
        <Card>
          <CardHeader className="bg-amber-50/50">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-amber-600" />
              <CardTitle className="text-base font-semibold text-amber-700">
                📞 Quando avisar o administrador:
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quandoAvisar.map((item, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-sm text-amber-800">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recado final */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6 pb-6 text-center space-y-3">
            <p className="text-base font-medium text-foreground">
              💬 Recado final
            </p>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Erros podem acontecer 😊
              </p>
              <p className="text-sm text-muted-foreground">
                O importante é <strong className="text-foreground">conferir antes de finalizar</strong>.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                O sistema está em melhoria contínua e tudo será ajustado.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
