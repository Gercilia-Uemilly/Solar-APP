import { Link } from "react-router-dom";
import { ClipboardList, Clock, TrendingUp, CheckCircle2, FileText, MessageSquare, Zap } from "lucide-react";
import { store } from "@/lib/store";
import { useMemo } from "react";

export default function Dashboard() {
  const demandas = useMemo(() => store.getDemandas(), []);
  const oficios = useMemo(() => store.getOficios(), []);

  const total = demandas.length;
  const pendentes = demandas.filter((d) => d.status === "Pendente").length;
  const emAndamento = demandas.filter((d) => d.status === "Em Andamento").length;
  const concluidas = demandas.filter((d) => d.status === "Concluída").length;
  const urgentes = demandas.filter((d) => d.prioridade === "Urgente").length;

  const hoje = new Date();
  const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const dataFormatada = `${diasSemana[hoje.getDay()]}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;

  const statCards = [
    { label: "Total de Demandas", value: total, icon: ClipboardList, color: "bg-status-total" },
    { label: "Pendentes", value: pendentes, icon: Clock, color: "bg-status-pending" },
    { label: "Em Andamento", value: emAndamento, icon: TrendingUp, color: "bg-status-progress" },
    { label: "Concluídas", value: concluidas, icon: CheckCircle2, color: "bg-status-done" },
  ];

  // Group demandas by tipo for chart
  const tipoCount = demandas.reduce((acc, d) => {
    acc[d.tipo] = (acc[d.tipo] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusCount = demandas.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card rounded-xl p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{dataFormatada}</p>
          <h1 className="text-2xl font-bold text-foreground mt-1">Gabinete do Vereador Fabão</h1>
          <p className="text-sm text-muted-foreground">Câmara Municipal de Uberlândia · Mandato 2025–2028</p>
        </div>
        <Link
          to="/demandas?new=true"
          className="px-4 py-2 border border-foreground/20 rounded-lg text-sm text-foreground hover:bg-accent transition-colors"
        >
          + Nova Demanda
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className={`${card.color} rounded-xl p-5 relative overflow-hidden`}>
            <p className="text-sm text-primary-foreground/80">{card.label}</p>
            <p className="text-3xl font-bold text-primary-foreground mt-2">{card.value}</p>
            <card.icon className="absolute right-4 top-4 text-primary-foreground/30" size={24} />
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-3 gap-4">
        <Link to="/oficios" className="bg-card rounded-xl p-5 hover:bg-accent transition-colors flex items-center gap-3">
          <FileText size={20} className="text-status-success" />
          <div>
            <p className="text-sm font-semibold text-foreground">Ofícios</p>
            <p className="text-xs text-muted-foreground">{oficios.length} gerado(s)</p>
          </div>
        </Link>
        <Link to="/scripts" className="bg-card rounded-xl p-5 hover:bg-accent transition-colors flex items-center gap-3">
          <MessageSquare size={20} className="text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Scripts</p>
            <p className="text-xs text-muted-foreground">Respostas prontas</p>
          </div>
        </Link>
        <Link to="/demandas?prioridade=Urgente" className="bg-card rounded-xl p-5 hover:bg-accent transition-colors flex items-center gap-3">
          <Zap size={20} className="text-status-pending" />
          <div>
            <p className="text-sm font-semibold text-foreground">Urgentes</p>
            <p className="text-xs text-muted-foreground">{urgentes} demanda(s)</p>
          </div>
        </Link>
      </div>

      {/* Charts area */}
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 bg-card rounded-xl p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Demandas por Tipo</h2>
          {Object.keys(tipoCount).length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">Nenhuma demanda ainda</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(tipoCount).map(([tipo, count]) => (
                <div key={tipo} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{tipo}</span>
                  <span className="text-sm text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="col-span-2 bg-card rounded-xl p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Por Status</h2>
          {Object.keys(statusCount).length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">Nenhuma demanda ainda</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(statusCount).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{status}</span>
                  <span className="text-sm text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Demandas */}
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Demandas Recentes</h2>
          <Link to="/demandas" className="text-sm text-primary hover:underline flex items-center gap-1">
            Ver todas →
          </Link>
        </div>
        {demandas.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">Nenhuma demanda cadastrada</p>
        ) : (
          <div className="space-y-2">
            {demandas.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm text-foreground">{d.titulo}</p>
                  <p className="text-xs text-muted-foreground">{d.solicitante} · {d.tipo}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-accent text-accent-foreground">{d.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
