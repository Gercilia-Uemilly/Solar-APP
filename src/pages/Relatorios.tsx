import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Download, Calendar, Users, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportToCSV } from "@/lib/exportOficio";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OficioRow {
  numero?: string;
  assunto: string;
  status: string;
  destinatario: string;
  operador_nome: string | null;
  linha_telefonica: string | null;
  created_at: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  logged_in_at: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface UserAccessSummary {
  user_id: string;
  name: string;
  email: string;
  total: number;
  lastAccess: string;
  sessions: { date: string; time: string }[];
}

const COLORS = ["hsl(220,70%,50%)", "hsl(25,80%,50%)", "hsl(145,60%,40%)", "hsl(280,50%,50%)", "hsl(30,60%,40%)", "hsl(0,70%,50%)"];

export default function Relatorios() {
  const [oficios, setOficios] = useState<OficioRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("todos");
  const [selectedUser, setSelectedUser] = useState<UserAccessSummary | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [oficiosRes, sessionsRes, profilesRes] = await Promise.all([
        supabase.from("oficios").select("numero, assunto, status, destinatario, operador_nome, linha_telefonica, created_at"),
        supabase.from("user_sessions").select("id, user_id, logged_in_at").order("logged_in_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email")
      ]);
      setOficios((oficiosRes.data as OficioRow[]) || []);
      setSessions((sessionsRes.data as SessionRow[]) || []);
      setProfiles((profilesRes.data as ProfileRow[]) || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Period filter for oficios
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

  // User access summary
  const userAccessMap = new Map<string, UserAccessSummary>();
  sessions.forEach(s => {
    const existing = userAccessMap.get(s.user_id);
    const sessionDate = new Date(s.logged_in_at);
    const sessionInfo = {
      date: format(sessionDate, "dd/MM/yyyy", { locale: ptBR }),
      time: format(sessionDate, "HH:mm:ss", { locale: ptBR })
    };
    if (existing) {
      existing.total++;
      existing.sessions.push(sessionInfo);
    } else {
      userAccessMap.set(s.user_id, {
        user_id: s.user_id,
        name: s.profiles?.full_name || "Sem nome",
        email: s.profiles?.email || "Sem email",
        total: 1,
        lastAccess: format(sessionDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
        sessions: [sessionInfo]
      });
    }
  });
  const userAccessList = Array.from(userAccessMap.values()).sort((a, b) => b.total - a.total);
  const topAccessData = userAccessList.slice(0, 10).map(u => ({ name: u.name.split(" ")[0], value: u.total }));

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

      <Tabs defaultValue="oficios" className="w-full">
        <TabsList className="bg-secondary">
          <TabsTrigger value="oficios">Ofícios</TabsTrigger>
          <TabsTrigger value="acessos">Acessos de Usuários</TabsTrigger>
        </TabsList>

        <TabsContent value="oficios" className="space-y-6 mt-4">
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
        </TabsContent>

        <TabsContent value="acessos" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <Users size={20} className="mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold text-foreground">{userAccessList.length}</p>
              <p className="text-xs text-muted-foreground">Usuários únicos</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <Clock size={20} className="mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold text-foreground">{sessions.length}</p>
              <p className="text-xs text-muted-foreground">Total de acessos</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {sessions.filter(s => new Date(s.logged_in_at).toDateString() === now.toDateString()).length}
              </p>
              <p className="text-xs text-muted-foreground">Acessos hoje</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {userAccessList.length > 0 ? Math.round(sessions.length / userAccessList.length) : 0}
              </p>
              <p className="text-xs text-muted-foreground">Média por usuário</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-medium text-foreground mb-4">Top 10 Usuários por Acessos</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topAccessData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-medium text-foreground mb-4">Todos os Usuários</h3>
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead className="text-center">Acessos</TableHead>
                      <TableHead>Último</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userAccessList.map(u => (
                      <TableRow 
                        key={u.user_id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedUser(u)}
                      >
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{u.email}</TableCell>
                        <TableCell className="text-center font-bold">{u.total}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.lastAccess}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {selectedUser && (
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-foreground">
                  Histórico de {selectedUser.name}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
                  Fechar
                </Button>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Horário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedUser.sessions.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell>{s.date}</TableCell>
                        <TableCell>{s.time}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
