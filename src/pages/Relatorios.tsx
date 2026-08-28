import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Download, Calendar, Users, Clock, ShieldAlert, Monitor, Smartphone, Globe } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { exportToCSV } from "@/lib/exportOficio";
import { rankearBairros, BAIRRO_NAO_IDENTIFICADO } from "@/lib/bairros";
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
  origem?: string | null;
  codigo_z?: string | null;
  bairro?: string | null;
  endereco_completo?: string | null;
  local_demanda?: string | null;
  tipo_demanda?: string | null;
  secretaria_identificada?: string | null;
  solicitante?: string | null;
  contato_solicitante?: string | null;
}

interface SessionRow {
  id: string;
  user_id: string;
  logged_in_at: string;
  ip_address?: string | null;
  user_agent?: string | null;
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
  uniqueDevices24h: number;
  multiDeviceWarning: boolean;
  sessions: { date: string; time: string; device: string; browser: string; ip: string }[];
}

interface LoginAttemptRow {
  id: string;
  identifier: string;
  success: boolean;
  motivo: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

function parseUA(ua?: string | null): { device: string; browser: string } {
  if (!ua) return { device: "Desconhecido", browser: "—" };
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const device = isMobile ? "Mobile" : "Desktop";
  let browser = "Outro";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  return { device, browser };
}

const COLORS = ["hsl(220,70%,50%)", "hsl(25,80%,50%)", "hsl(145,60%,40%)", "hsl(280,50%,50%)", "hsl(30,60%,40%)", "hsl(0,70%,50%)"];

export default function Relatorios() {
  const [oficios, setOficios] = useState<OficioRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [attempts, setAttempts] = useState<LoginAttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("todos");
  const [selectedUser, setSelectedUser] = useState<UserAccessSummary | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [oficiosRes, sessionsRes, profilesRes, attemptsRes] = await Promise.all([
        supabase.from("oficios").select("numero, assunto, status, destinatario, operador_nome, linha_telefonica, origem, codigo_z, created_at, bairro, endereco_completo, local_demanda, tipo_demanda, secretaria_identificada, solicitante, contato_solicitante").is("deleted_at" as any, null),
        supabase.from("user_sessions").select("id, user_id, logged_in_at, ip_address, user_agent").order("logged_in_at", { ascending: false }).limit(1000),
        supabase.from("profiles").select("id, full_name, email"),
        (supabase.from("login_attempts" as any).select("id, identifier, success, motivo, ip_address, user_agent, created_at").order("created_at", { ascending: false }).limit(500))
      ]);
      setOficios((oficiosRes.data as OficioRow[]) || []);
      setSessions((sessionsRes.data as SessionRow[]) || []);
      setProfiles((profilesRes.data as ProfileRow[]) || []);
      setAttempts(((attemptsRes as any).data as LoginAttemptRow[]) || []);
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

  // Volume por origem + código (Zap/Req/etc.) — usado pra saber qual linha mais recebe
  const origemCodigoCounts: Record<string, number> = {};
  filtered.forEach(o => {
    if (!o.origem) return;
    const cod = (o.codigo_z || "").toString().trim();
    const label = cod
      ? (o.origem === "Requerimento" ? `REQ ${cod.padStart(2, "0")}` : `${o.origem} ${cod}`)
      : o.origem;
    origemCodigoCounts[label] = (origemCodigoCounts[label] || 0) + 1;
  });
  const origemCodigoData = Object.entries(origemCodigoCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // ===== Inteligência de demandas (auditoria) =====
  const contar = (fn: (o: OficioRow) => string | null | undefined) => {
    const map = new Map<string, number>();
    filtered.forEach((o) => {
      const raw = (fn(o) || "").toString().trim();
      if (!raw) return;
      map.set(raw, (map.get(raw) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const bairrosData = rankearBairros(filtered);
  const bairrosIdentificados = bairrosData
    .filter((b) => b.name !== BAIRRO_NAO_IDENTIFICADO);
  const naoIdentificados =
    bairrosData.find((b) => b.name === BAIRRO_NAO_IDENTIFICADO)?.value || 0;
  const coberturaBairro = total > 0 ? Math.round(((total - naoIdentificados) / total) * 100) : 0;

  const tiposData = contar((o) => o.tipo_demanda);
  const secretariasData = contar((o) => o.secretaria_identificada || o.destinatario);
  const solicitantesData = contar((o) => o.solicitante);
  const telefonesData = contar((o) => o.contato_solicitante);
  const operadoresData = contar((o) => o.operador_nome);

  const baixarCSV = (nome: string, linhas: { name: string; value: number }[], coluna: string) => {
    const csv = [`${coluna};Quantidade`, ...linhas.map((l) => `"${l.name.replace(/"/g, "'")}";${l.value}`)].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nome}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };



  // User access summary
  const profileMap = new Map(profiles.map(p => [p.id, p]));
  const userAccessMap = new Map<string, UserAccessSummary>();
  sessions.forEach(s => {
    const existing = userAccessMap.get(s.user_id);
    const sessionDate = new Date(s.logged_in_at);
    const { device, browser } = parseUA(s.user_agent);
    const sessionInfo = {
      date: format(sessionDate, "dd/MM/yyyy", { locale: ptBR }),
      time: format(sessionDate, "HH:mm:ss", { locale: ptBR }),
      device,
      browser,
      ip: s.ip_address || "—",
    };
    const profile = profileMap.get(s.user_id);
    if (existing) {
      existing.total++;
      existing.sessions.push(sessionInfo);
    } else {
      userAccessMap.set(s.user_id, {
        user_id: s.user_id,
        name: profile?.full_name || "Sem nome",
        email: profile?.email || "Sem email",
        total: 1,
        lastAccess: format(sessionDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
        uniqueDevices24h: 0,
        multiDeviceWarning: false,
        sessions: [sessionInfo]
      });
    }
  });
  // Compute unique devices in the last 24h per user (browser+device+IP fingerprint)
  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
  userAccessMap.forEach((u) => {
    const recent = sessions.filter(
      (s) => s.user_id === u.user_id && new Date(s.logged_in_at).getTime() >= cutoff24h
    );
    const fingerprints = new Set(
      recent.map((s) => {
        const { device, browser } = parseUA(s.user_agent);
        return `${device}|${browser}|${s.ip_address || "?"}`;
      })
    );
    u.uniqueDevices24h = fingerprints.size;
    u.multiDeviceWarning = fingerprints.size >= 2;
  });
  const userAccessList = Array.from(userAccessMap.values()).sort((a, b) => b.total - a.total);
  const topAccessData = userAccessList.slice(0, 10).map(u => ({ name: u.name.split(" ")[0], value: u.total }));

  // Login attempts stats
  const failedAttempts = attempts.filter(a => !a.success);
  const successAttempts = attempts.filter(a => a.success);
  const failedToday = failedAttempts.filter(a => new Date(a.created_at).toDateString() === now.toDateString()).length;
  // Devices distribution from sessions
  const deviceCounts: Record<string, number> = { Desktop: 0, Mobile: 0 };
  const browserCounts: Record<string, number> = {};
  sessions.forEach(s => {
    const { device, browser } = parseUA(s.user_agent);
    deviceCounts[device] = (deviceCounts[device] || 0) + 1;
    browserCounts[browser] = (browserCounts[browser] || 0) + 1;
  });
  const deviceData = Object.entries(deviceCounts).map(([name, value]) => ({ name, value }));
  const browserData = Object.entries(browserCounts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

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
          <TabsTrigger value="inteligencia">Inteligência</TabsTrigger>
          <TabsTrigger value="acessos">Acessos de Usuários</TabsTrigger>
          <TabsTrigger value="tentativas">Tentativas de Login</TabsTrigger>
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

            <div className="bg-card rounded-xl border border-border p-5 lg:col-span-2">
              <h3 className="text-sm font-medium text-foreground mb-1">Volume por Linha de Origem (Zap / REQ / etc.)</h3>
              <p className="text-xs text-muted-foreground mb-4">Quantidade de ofícios recebidos por cada código de origem — útil para medir o fluxo de cada número.</p>
              {origemCodigoData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum ofício com origem/código registrado ainda.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, origemCodigoData.length * 28)}>
                  <BarChart data={origemCodigoData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="inteligencia" className="space-y-6 mt-4">
          <div className="bg-card rounded-xl border border-border p-4 flex flex-wrap items-center gap-4 justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Qualidade do cadastro de bairros</p>
              <p className="text-xs text-muted-foreground">
                {total - naoIdentificados} de {total} ofícios ({coberturaBairro}%) com bairro identificado.
                O sistema agora deduz o bairro a partir do endereço quando o campo vem preenchido com a rua.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={coberturaBairro >= 70 ? "default" : "secondary"}>{coberturaBairro}% cobertura</Badge>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Download size={14} className="mr-1" /> Imprimir / PDF
              </Button>
            </div>
          </div>

          <BlocoRanking
            titulo="Bairros com mais demandas"
            descricao="Bairro real identificado no endereço, local ou texto do ofício."
            coluna="Bairro"
            dados={bairrosIdentificados}
            cor="hsl(var(--primary))"
            onExport={baixarCSV}
            arquivo="bairros"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BlocoRanking
              titulo="Tipos de demanda mais pedidos"
              coluna="Tipo de demanda"
              dados={tiposData}
              cor="hsl(var(--chart-3))"
              onExport={baixarCSV}
              arquivo="tipos-demanda"
            />
            <BlocoRanking
              titulo="Secretarias / órgãos mais acionados"
              coluna="Secretaria"
              dados={secretariasData}
              cor="hsl(var(--chart-4))"
              onExport={baixarCSV}
              arquivo="secretarias"
            />
            <BlocoRanking
              titulo="Linhas de origem (Zap / REQ)"
              coluna="Origem"
              dados={origemCodigoData}
              cor="hsl(var(--primary))"
              onExport={baixarCSV}
              arquivo="origens"
            />
            <BlocoRanking
              titulo="Operadores que mais produzem"
              coluna="Operador"
              dados={operadoresData}
              cor="hsl(var(--chart-3))"
              onExport={baixarCSV}
              arquivo="operadores"
            />
            <BlocoRanking
              titulo="Solicitantes mais frequentes"
              coluna="Solicitante"
              dados={solicitantesData}
              cor="hsl(var(--chart-4))"
              onExport={baixarCSV}
              arquivo="solicitantes"
            />
            <BlocoRanking
              titulo="Telefones que mais acionam o gabinete"
              coluna="Telefone"
              dados={telefonesData}
              cor="hsl(var(--primary))"
              onExport={baixarCSV}
              arquivo="telefones"
            />
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
                      <TableHead className="text-center">Disp. (24h)</TableHead>
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
                        <TableCell className="text-center">
                          {u.multiDeviceWarning ? (
                            <Badge variant="destructive" className="gap-1">
                              <ShieldAlert size={10} /> {u.uniqueDevices24h}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">{u.uniqueDevices24h}</span>
                          )}
                        </TableCell>
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
                      <TableHead>Dispositivo</TableHead>
                      <TableHead>Navegador</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedUser.sessions.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell>{s.date}</TableCell>
                        <TableCell>{s.time}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-xs">
                            {s.device === "Mobile" ? <Smartphone size={12} /> : <Monitor size={12} />}
                            {s.device}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">{s.browser}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{s.ip}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tentativas" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <ShieldAlert size={20} className="mx-auto mb-1 text-destructive" />
              <p className="text-2xl font-bold text-foreground">{failedAttempts.length}</p>
              <p className="text-xs text-muted-foreground">Falhas (total)</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-2xl font-bold text-destructive">{failedToday}</p>
              <p className="text-xs text-muted-foreground">Falhas hoje</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-2xl font-bold text-primary">{successAttempts.length}</p>
              <p className="text-xs text-muted-foreground">Sucessos registrados</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <Globe size={20} className="mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold text-foreground">{new Set(attempts.map(a => a.ip_address).filter(Boolean)).size}</p>
              <p className="text-xs text-muted-foreground">IPs únicos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-medium text-foreground mb-4">Dispositivos (sessões)</h3>
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={deviceData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {deviceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-medium text-foreground mb-4">Navegadores (sessões)</h3>
              {browserData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={browserData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-sm font-medium text-foreground mb-4">Últimas tentativas (500 mais recentes)</h3>
            {attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tentativa registrada ainda. Os registros começam a partir de agora.</p>
            ) : (
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Identificador</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Dispositivo</TableHead>
                      <TableHead>Navegador</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attempts.map(a => {
                      const { device, browser } = parseUA(a.user_agent);
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(a.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-xs">{a.identifier}</TableCell>
                          <TableCell>
                            <Badge variant={a.success ? "default" : "destructive"} className="text-[10px]">
                              {a.success ? "Sucesso" : "Falha"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate" title={a.motivo || ""}>
                            {a.motivo || "—"}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-xs">
                              {device === "Mobile" ? <Smartphone size={12} /> : <Monitor size={12} />}
                              {device}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{browser}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">{a.ip_address || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
