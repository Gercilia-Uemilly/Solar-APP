import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, Plus, Calendar, Clock, Trash2, Users, User, AlertTriangle, ExternalLink } from "lucide-react";
import { format, differenceInHours, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Lembrete {
  id: string;
  criado_por: string;
  destinatarios: string[];
  titulo: string;
  descricao: string | null;
  data_hora: string;
  recorrencia: string;
  tipo: string;
  lido_por: string[];
  google_event_id: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export default function Lembretes() {
  const { user, isAdmin } = useAuth();
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataHora, setDataHora] = useState("");
  const [recorrencia, setRecorrencia] = useState("nenhuma");

  // Admin form
  const [adminTitulo, setAdminTitulo] = useState("");
  const [adminDescricao, setAdminDescricao] = useState("");
  const [adminDataHora, setAdminDataHora] = useState("");
  const [adminParaTodos, setAdminParaTodos] = useState(true);
  const [adminDestinatarios, setAdminDestinatarios] = useState<string[]>([]);

  useEffect(() => {
    fetchLembretes();
    fetchProfiles();
    const ch = supabase
      .channel("lembretes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "lembretes" }, () => {
        fetchLembretes();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const fetchLembretes = async () => {
    if (!user) return;
    const { data } = await supabase.from("lembretes").select("*").order("data_hora", { ascending: true });
    if (data) setLembretes(data as unknown as Lembrete[]);
    setLoading(false);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name, email").eq("status", "aprovado");
    if (data) setProfiles(data as Profile[]);
  };

  const handleCreatePessoal = async () => {
    if (!titulo.trim() || !dataHora || !user) return;
    const { error } = await supabase.from("lembretes").insert({
      criado_por: user.id,
      destinatarios: [user.id],
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      data_hora: new Date(dataHora).toISOString(),
      recorrencia,
      tipo: "pessoal",
    } as any);
    if (error) { toast.error("Erro ao criar lembrete"); return; }
    toast.success("Lembrete criado!");
    setTitulo(""); setDescricao(""); setDataHora(""); setRecorrencia("nenhuma");
    setDialogOpen(false);
  };

  const handleCreateAdmin = async () => {
    if (!adminTitulo.trim() || !adminDataHora || !user) return;
    const dest = adminParaTodos
      ? profiles.map(p => p.id)
      : adminDestinatarios;
    if (dest.length === 0) { toast.error("Selecione ao menos um destinatário"); return; }
    const { error } = await supabase.from("lembretes").insert({
      criado_por: user.id,
      destinatarios: dest,
      titulo: adminTitulo.trim(),
      descricao: adminDescricao.trim() || null,
      data_hora: new Date(adminDataHora).toISOString(),
      recorrencia: "nenhuma",
      tipo: "admin",
    } as any);
    if (error) { toast.error("Erro ao enviar lembrete"); return; }
    toast.success("Lembrete enviado para a equipe!");
    setAdminTitulo(""); setAdminDescricao(""); setAdminDataHora("");
    setAdminParaTodos(true); setAdminDestinatarios([]);
    setAdminDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("lembretes").delete().eq("id", id);
    toast.success("Lembrete removido");
  };

  const handleMarkRead = async (lembrete: Lembrete) => {
    if (!user || lembrete.lido_por?.includes(user.id)) return;
    const newLidoPor = [...(lembrete.lido_por || []), user.id];
    await supabase.from("lembretes").update({ lido_por: newLidoPor } as any).eq("id", lembrete.id);
  };

  const meusLembretes = useMemo(() =>
    lembretes.filter(l => l.tipo === "pessoal" && l.criado_por === user?.id),
    [lembretes, user]
  );

  const lembretesEquipe = useMemo(() =>
    lembretes.filter(l => l.tipo === "admin" && l.destinatarios?.includes(user?.id || "")),
    [lembretes, user]
  );

  const getProfileName = (id: string) => {
    const p = profiles.find(pr => pr.id === id);
    return p?.full_name || p?.email?.split("@")[0] || "Usuário";
  };

  const getUrgencyBadge = (dataHora: string) => {
    const hoursLeft = differenceInHours(new Date(dataHora), new Date());
    if (isPast(new Date(dataHora))) return <Badge variant="destructive" className="text-2xs">Vencido</Badge>;
    if (hoursLeft < 24) return <Badge className="bg-amber-500 text-white text-2xs"><AlertTriangle size={10} className="mr-1" />Urgente</Badge>;
    return null;
  };

  const toggleDestinatario = (id: string) => {
    setAdminDestinatarios(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const renderLembreteCard = (l: Lembrete, showCreator = false) => {
    const isRead = l.lido_por?.includes(user?.id || "");
    return (
      <Card
        key={l.id}
        className={`transition-all ${!isRead && l.tipo === "admin" ? "border-primary/50 bg-primary/5" : ""}`}
        onClick={() => handleMarkRead(l)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground truncate">{l.titulo}</h3>
                {getUrgencyBadge(l.data_hora)}
                {!isRead && l.tipo === "admin" && <Badge variant="secondary" className="text-2xs">Novo</Badge>}
                {l.recorrencia !== "nenhuma" && (
                  <Badge variant="outline" className="text-2xs capitalize">{l.recorrencia}</Badge>
                )}
              </div>
              {l.descricao && <p className="text-sm text-muted-foreground mb-2">{l.descricao}</p>}
              <div className="flex items-center gap-3 text-2xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar size={11} />
                  {format(new Date(l.data_hora), "dd/MM/yyyy", { locale: ptBR })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {format(new Date(l.data_hora), "HH:mm")}
                </span>
                {showCreator && (
                  <span className="flex items-center gap-1">
                    <User size={11} />
                    {getProfileName(l.criado_por)}
                  </span>
                )}
              </div>
            </div>
            {(l.criado_por === user?.id || isAdmin) && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(l.id); }}>
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Google Calendar iframe URL (user's public calendar)
  const googleCalendarEmbedUrl = "https://calendar.google.com/calendar/embed?src=primary&ctz=America/Sao_Paulo";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-serif flex items-center gap-2">
            <Bell size={24} /> Lembretes e Agenda
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus lembretes e acompanhe a agenda da equipe</p>
        </div>
      </div>

      <Tabs defaultValue="meus">
        <TabsList>
          <TabsTrigger value="meus" className="gap-1"><User size={14} /> Meus Lembretes</TabsTrigger>
          <TabsTrigger value="equipe" className="gap-1">
            <Users size={14} /> Equipe
            {lembretesEquipe.filter(l => !l.lido_por?.includes(user?.id || "")).length > 0 && (
              <Badge variant="destructive" className="ml-1 text-2xs h-4 min-w-[16px] px-1">
                {lembretesEquipe.filter(l => !l.lido_por?.includes(user?.id || "")).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1"><Calendar size={14} /> Calendário</TabsTrigger>
        </TabsList>

        <TabsContent value="meus" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{meusLembretes.length} lembrete(s) pessoal(is)</p>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1"><Plus size={14} /> Novo Lembrete</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Lembrete</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Título *" value={titulo} onChange={e => setTitulo(e.target.value)} />
                  <Textarea placeholder="Descrição (opcional)" value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} />
                  <Input type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)} />
                  <Select value={recorrencia} onValueChange={setRecorrencia}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma">Sem recorrência</SelectItem>
                      <SelectItem value="diaria">Diária</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleCreatePessoal} className="w-full" disabled={!titulo.trim() || !dataHora}>Criar Lembrete</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {isAdmin && (
            <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1"><Users size={14} /> Enviar para Equipe</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Lembrete para a Equipe</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Título *" value={adminTitulo} onChange={e => setAdminTitulo(e.target.value)} />
                  <Textarea placeholder="Mensagem" value={adminDescricao} onChange={e => setAdminDescricao(e.target.value)} rows={3} />
                  <Input type="datetime-local" value={adminDataHora} onChange={e => setAdminDataHora(e.target.value)} />
                  <div className="flex items-center gap-2">
                    <Checkbox checked={adminParaTodos} onCheckedChange={(v) => setAdminParaTodos(!!v)} id="todos" />
                    <label htmlFor="todos" className="text-sm">Enviar para todos</label>
                  </div>
                  {!adminParaTodos && (
                    <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
                      {profiles.filter(p => p.id !== user?.id).map(p => (
                        <div key={p.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={adminDestinatarios.includes(p.id)}
                            onCheckedChange={() => toggleDestinatario(p.id)}
                          />
                          <span className="text-sm">{p.full_name || p.email}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button onClick={handleCreateAdmin} className="w-full" disabled={!adminTitulo.trim() || !adminDataHora}>Enviar Lembrete</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <div className="space-y-2">
            {meusLembretes.length === 0 && !loading && (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum lembrete pessoal. Crie um!</p>
            )}
            {meusLembretes.map(l => renderLembreteCard(l))}
          </div>
        </TabsContent>

        <TabsContent value="equipe" className="mt-4 space-y-2">
          {lembretesEquipe.length === 0 && !loading && (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum lembrete da equipe.</p>
          )}
          {lembretesEquipe.map(l => renderLembreteCard(l, true))}
        </TabsContent>

        <TabsContent value="calendario" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar size={18} /> Google Calendar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Visualize seu calendário integrado. Para conectar, acesse <strong>Configurações → Google Drive</strong> (a mesma conta Google é utilizada).
                </p>
                <div className="rounded-lg overflow-hidden border border-border" style={{ height: 500 }}>
                  <iframe
                    src={googleCalendarEmbedUrl}
                    className="w-full h-full border-0"
                    title="Google Calendar"
                  />
                </div>
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink size={13} /> Abrir no Google Calendar
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
