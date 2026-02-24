import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface OficioRow {
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

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("oficios").select("status, destinatario, operador_nome, linha_telefonica, created_at");
      setOficios((data as OficioRow[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  // Stats
  const total = oficios.length;
  const hoje = new Date().toISOString().split("T")[0];
  const hojCount = oficios.filter(o => o.created_at.startsWith(hoje)).length;

  // By status
  const statusCounts: Record<string, number> = {};
  oficios.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // By operador
  const opCounts: Record<string, number> = {};
  oficios.forEach(o => { const n = o.operador_nome || "Sem operador"; opCounts[n] = (opCounts[n] || 0) + 1; });
  const opData = Object.entries(opCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

  // Top destinatários
  const destCounts: Record<string, number> = {};
  oficios.forEach(o => { destCounts[o.destinatario] = (destCounts[o.destinatario] || 0) + 1; });
  const destData = Object.entries(destCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

  if (loading) return <p className="text-center text-muted-foreground py-12">Carregando relatórios...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 size={24} className="text-primary" />
        <div>
          <h1 className="text-xl font-medium text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">{total} ofício(s) no total · {hojCount} hoje</p>
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
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,25%,20%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(220,70%,50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Destinatários */}
        <div className="bg-card rounded-xl border border-border p-5 lg:col-span-2">
          <h3 className="text-sm font-medium text-foreground mb-4">Destinatários Mais Frequentes</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={destData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,25%,20%)" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="name" type="category" width={200} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(145,60%,40%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
