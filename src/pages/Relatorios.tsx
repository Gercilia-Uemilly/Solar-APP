import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Download, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToCSV } from "@/lib/exportOficio";

interface OficioRow {
  numero?: string;
  assunto: string;
  status: string;
  destinatario: string;
  operador_nome: string | null;
  linha_telefonica: string | null;
  created_at: string;
}

const COLORS = ["hsl(220,70%,50%)", "hsl(25,80%,50%)", "hsl(145,60%,40%)", "hsl(280,50%,50%)", "hsl(30,60%,40%)", "hsl(0,70%,50%)"];

export default function Relatorios() {
  const [oficios, setOficios] = useState<OficioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("todos");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("oficios").select("numero, assunto, status, destinatario, operador_nome, linha_telefonica, created_at");
      setOficios((data as OficioRow[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  // Period filter
  const now = new Date();
  const filtered = oficios.filter(o => {
    if (periodo === "todos") return true;
    const d = new Date(o.created_at);
    if (periodo === "hoje") return d.toDateString() === now.toDateString();
    if (periodo === "semana") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return d >= weekAgo;
    }
    if (periodo === "mes") {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const total = filtered.length;
  const hojCount = filtered.filter(o => new Date(o.created_at).toDateString() === now.toDateString()).length;

  // By status
  const statusCounts: Record<string, number> = {};
  filtered.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // By operador
  const opCounts: Record<string, number> = {};
  filtered.forEach(o => { const n = o.operador_nome || "Sem operador"; opCounts[n] = (opCounts[n] || 0) + 1; });
  const opData = Object.entries(opCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

  // Top destinatários
  const destCounts: Record<string, number> = {};
  filtered.forEach(o => { destCounts[o.destinatario] = (destCounts[o.destinatario] || 0) + 1; });
  const destData = Object.entries(destCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

  // Linhas telefônicas mais usadas
  const linhaCounts: Record<string, number> = {};
  filtered.forEach(o => {
    if (o.linha_telefonica) {
      linhaCounts[o.linha_telefonica] = (linhaCounts[o.linha_telefonica] || 0) + 1;
    }
  });
  const linhaData = Object.entries(linhaCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

  if (loading) return <p className="text-center text-muted-foreground py-12">Carregando relatórios...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 size={24} className="text-primary" />
          <div>
            <h1 className="text-xl font-medium text-foreground">Relatórios</h1>
            <p className="text-sm text-muted-foreground">{total} ofício(s) no período · {hojCount} hoje</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-36 bg-card border-border">
              <Calendar size={14} className="mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="semana">Última semana</SelectItem>
              <SelectItem value="mes">Este mês</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => exportToCSV(filtered)}>
            <Download size={14} className="mr-1" /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{statusCounts["Gerado"] || 0}</p>
          <p className="text-xs text-muted-foreground">Gerados</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{statusCounts["Enviado"] || 0}</p>
          <p className="text-xs text-muted-foreground">Enviados</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{Object.keys(opCounts).length}</p>
          <p className="text-xs text-muted-foreground">Operadores ativos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Status */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Por Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* By Operador */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Por Operador</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={opData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Destinatários */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Destinatários Mais Frequentes</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={destData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="name" type="category" width={200} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Linhas Telefônicas */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Linhas Telefônicas Mais Usadas</h3>
          {linhaData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma linha registrada ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={linhaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}