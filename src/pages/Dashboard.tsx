import { Link } from "react-router-dom";
import { FileText, MessageSquare, FolderOpen, Users, BarChart3, TrendingUp, TrendingDown, Minus, MapPin, UserCheck, Trophy } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface OficioRow {
  status: string;
  created_at: string;
  operador_nome: string | null;
  bairro: string | null;
}

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(45 93% 47%)",
  "hsl(210 80% 50%)",
  "hsl(150 60% 40%)",
  "hsl(0 70% 55%)",
  "hsl(270 60% 55%)",
];

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [oficios, setOficios] = useState<OficioRow[]>([]);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).single().then(({ data }) => {
      if (data) setProfileName(data.full_name || null);
    });
  }, [user]);

  const hoje = new Date();
  const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "dezembro"];
  const dataFormatada = `${diasSemana[hoje.getDay()]}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("oficios")
        .select("status, created_at, operador_nome, bairro");
      if (data) setOficios(data as OficioRow[]);
    };
    fetch();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const mesAtual = now.getMonth();
    const anoAtual = now.getFullYear();
    const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
    const anoMesAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;

    const doMes = oficios.filter(o => {
      const d = new Date(o.created_at);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });
    const doMesAnterior = oficios.filter(o => {
      const d = new Date(o.created_at);
      return d.getMonth() === mesAnterior && d.getFullYear() === anoMesAnterior;
    });

    const total = oficios.length;
    const totalMes = doMes.length;
    const rascunhos = oficios.filter(o => o.status === "Rascunho").length;
    const gerados = oficios.filter(o => o.status === "Gerado").length;
    const enviados = oficios.filter(o => o.status === "Enviado" || o.status === "Respondido").length;

    // por operador
    const opMap: Record<string, number> = {};
    doMes.forEach(o => {
      const name = o.operador_nome || "Sem operador";
      opMap[name] = (opMap[name] || 0) + 1;
    });
    const porOperador = Object.entries(opMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // por bairro (chart)
    const bairroMap: Record<string, number> = {};
    doMes.forEach(o => {
      const b = o.bairro || "Não informado";
      bairroMap[b] = (bairroMap[b] || 0) + 1;
    });
    const porBairro = Object.entries(bairroMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // ranking top 5 bairros com tendência
    const bairroMapAnterior: Record<string, number> = {};
    doMesAnterior.forEach(o => {
      const b = o.bairro || "Não informado";
      bairroMapAnterior[b] = (bairroMapAnterior[b] || 0) + 1;
    });
    const rankingBairros = Object.entries(bairroMap)
      .map(([name, value]) => {
        const anterior = bairroMapAnterior[name] || 0;
        const diff = value - anterior;
        const trend: "up" | "down" | "stable" = diff > 0 ? "up" : diff < 0 ? "down" : "stable";
        return { name, value, anterior, diff, trend };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // por status (pie)
    const statusMap: Record<string, number> = {};
    oficios.forEach(o => {
      statusMap[o.status] = (statusMap[o.status] || 0) + 1;
    });
    const porStatus = Object.entries(statusMap)
      .map(([name, value]) => ({ name, value }));

    return { total, totalMes, rascunhos, gerados, enviados, porOperador, porBairro, porStatus, rankingBairros };
  }, [oficios]);

  const statCards = [
    { label: "Total Geral", value: stats.total, icon: FileText, color: "from-primary/80 to-primary" },
    { label: "Este Mês", value: stats.totalMes, icon: TrendingUp, color: "from-blue-600/80 to-blue-500" },
    { label: "Gerados", value: stats.gerados, icon: BarChart3, color: "from-emerald-600/80 to-emerald-500" },
    { label: "Enviados", value: stats.enviados, icon: UserCheck, color: "from-violet-600/80 to-violet-500" },
  ];

  const quickLinks = [
    { to: "/oficios", icon: FileText, label: "Novo Ofício", desc: "Criar com IA" },
    { to: "/meus-oficios", icon: FolderOpen, label: "Meus Ofícios", desc: "Gerenciar documentos" },
    { to: "/scripts", icon: MessageSquare, label: "Scripts", desc: "Respostas prontas" },
  ];

  const adminLinks = [
    { to: "/operadores", icon: Users, label: "Operadores", desc: "Gerenciar equipe" },
    { to: "/relatorios", icon: BarChart3, label: "Relatórios", desc: "Estatísticas completas" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="bg-card/60 backdrop-blur-md rounded-2xl p-6 border border-border"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-sm text-muted-foreground">{dataFormatada}</p>
        <h1 className="text-xl font-medium text-foreground mt-1">
          Bem-vindo, {profileName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Operador"}
        </h1>
        <p className="text-sm text-muted-foreground">Solar · Gabinete Vereador Fabão · Câmara Municipal de Uberlândia</p>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 relative overflow-hidden`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-normal text-primary-foreground/80">{card.label}</p>
              <card.icon size={16} className="text-primary-foreground/50" />
            </div>
            <p className="text-3xl font-semibold text-primary-foreground mt-2">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Por Operador */}
        <motion.div
          className="bg-card/60 backdrop-blur-md rounded-2xl p-5 border border-border"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <h2 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
            <Users size={16} className="text-primary" />
            Ofícios por Operador (mês)
          </h2>
          {stats.porOperador.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.porOperador} layout="vertical" margin={{ left: 0, right: 12 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum ofício neste mês</p>
          )}
        </motion.div>

        {/* Por Bairro */}
        <motion.div
          className="bg-card/60 backdrop-blur-md rounded-2xl p-5 border border-border"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <h2 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            Top Bairros (mês)
          </h2>
          {stats.porBairro.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.porBairro} margin={{ left: 0, right: 12 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-30} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="value" fill="hsl(210 80% 50%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum dado de bairro</p>
          )}
        </motion.div>
      </div>

      {/* Ranking Top 5 Bairros */}
      <motion.div
        className="bg-card/60 backdrop-blur-md rounded-2xl p-5 border border-border"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.32 }}
      >
        <h2 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Trophy size={16} className="text-primary" />
          Top 5 Bairros com Mais Demandas (mês)
        </h2>
        {stats.rankingBairros.length > 0 ? (
          <div className="space-y-3">
            {stats.rankingBairros.map((b, i) => {
              const maxVal = stats.rankingBairros[0]?.value || 1;
              const pct = Math.round((b.value / maxVal) * 100);
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`;
              return (
                <div key={b.name} className="flex items-center gap-3">
                  <span className="text-sm w-6 text-center">{medal}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground truncate">{b.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{b.value}</span>
                        {b.trend === "up" && (
                          <span className="flex items-center gap-0.5 text-xs text-emerald-500 font-medium">
                            <TrendingUp size={12} /> +{b.diff}
                          </span>
                        )}
                        {b.trend === "down" && (
                          <span className="flex items-center gap-0.5 text-xs text-red-500 font-medium">
                            <TrendingDown size={12} /> {b.diff}
                          </span>
                        )}
                        {b.trend === "stable" && (
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                            <Minus size={12} /> 0
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.1 }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground mt-2">Tendência comparada ao mês anterior</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhum dado de bairro neste mês</p>
        )}
      </motion.div>

      {/* Status Pie + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div
          className="bg-card/60 backdrop-blur-md rounded-2xl p-5 border border-border"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <h2 className="text-sm font-medium text-foreground mb-4">Distribuição por Status</h2>
          {stats.porStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={stats.porStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {stats.porStatus.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Sem dados</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {stats.porStatus.map((s, i) => (
              <span key={s.name} className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {s.name} ({s.value})
              </span>
            ))}
          </div>
        </motion.div>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
