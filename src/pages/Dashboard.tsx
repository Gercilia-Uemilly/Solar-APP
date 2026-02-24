import { Link } from "react-router-dom";
import { FileText, MessageSquare, FolderOpen, Users, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [oficioCount, setOficioCount] = useState(0);
  const [rascunhos, setRascunhos] = useState(0);
  const [gerados, setGerados] = useState(0);
  const [enviados, setEnviados] = useState(0);

  const hoje = new Date();
  const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const dataFormatada = `${diasSemana[hoje.getDay()]}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;

  useEffect(() => {
    const fetchStats = async () => {
      const { data } = await supabase.from("oficios").select("status");
      if (data) {
        setOficioCount(data.length);
        setRascunhos(data.filter(o => o.status === "Rascunho").length);
        setGerados(data.filter(o => o.status === "Gerado").length);
        setEnviados(data.filter(o => o.status === "Enviado" || o.status === "Respondido").length);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: "Total de Ofícios", value: oficioCount, color: "from-primary/80 to-primary" },
    { label: "Rascunhos", value: rascunhos, color: "from-yellow-600/80 to-yellow-500" },
    { label: "Gerados", value: gerados, color: "from-blue-600/80 to-blue-500" },
    { label: "Enviados", value: enviados, color: "from-emerald-600/80 to-emerald-500" },
  ];

  const quickLinks = [
    { to: "/oficios", icon: FileText, label: "Novo Ofício", desc: "Criar com IA" },
    { to: "/meus-oficios", icon: FolderOpen, label: "Meus Ofícios", desc: "Gerenciar documentos" },
    { to: "/scripts", icon: MessageSquare, label: "Scripts", desc: "Respostas prontas" },
  ];

  const adminLinks = [
    { to: "/operadores", icon: Users, label: "Operadores", desc: "Gerenciar equipe" },
    { to: "/relatorios", icon: BarChart3, label: "Relatórios", desc: "Estatísticas" },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        className="bg-card/60 backdrop-blur-md rounded-2xl p-6 border border-border"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-sm text-muted-foreground">{dataFormatada}</p>
        <h1 className="text-xl font-medium text-foreground mt-1">
          Bem-vindo, {user?.user_metadata?.full_name || user?.email || "Operador"}
        </h1>
        <p className="text-sm text-muted-foreground">The Office 30 · Gabinete Vereador Fabão · Câmara Municipal de Uberlândia</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 relative overflow-hidden`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <p className="text-xs font-normal text-primary-foreground/80">{card.label}</p>
            <p className="text-2xl font-medium text-primary-foreground mt-2">{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {quickLinks.map(link => (
          <Link key={link.to} to={link.to} className="bg-card/60 backdrop-blur-md rounded-2xl p-5 hover:bg-accent/50 transition-all border border-border flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
              <link.icon size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{link.label}</p>
              <p className="text-xs text-muted-foreground">{link.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {adminLinks.map(link => (
            <Link key={link.to} to={link.to} className="bg-card/60 backdrop-blur-md rounded-2xl p-5 hover:bg-accent/50 transition-all border border-border flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                <link.icon size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
