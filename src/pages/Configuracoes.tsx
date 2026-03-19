import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Save, Phone, CheckCircle2, XCircle, Loader2, Link2, Shield, ShieldCheck, ShieldOff } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

function AuditLogSection() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  useEffect(() => {
    (supabase.from("audit_log") as any)
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(50)
      .then(({ data }: any) => { setLogs(data || []); setLoadingLogs(false); });
  }, []);

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2"><Shield size={16} /> Log de Auditoria</h3>
      {loadingLogs ? (
        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin" /></div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum registro.</p>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1">
          {logs.map((l: any) => (
            <div key={l.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-border last:border-0">
              <span className="text-muted-foreground w-28 shrink-0">{new Date(l.criado_em).toLocaleString("pt-BR")}</span>
              <span className="font-medium text-foreground w-24 shrink-0">{l.user_nome}</span>
              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">{l.acao}</span>
              <span className="text-muted-foreground truncate">{l.detalhes?.numero || l.detalhes?.formato || ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TwoFactorSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [usa2fa, setUsa2fa] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("usa_2fa" as any)
      .eq("id", user.id)
      .single()
      .then(({ data }: any) => {
        if (data) {
          setUsa2fa(data.usa_2fa || false);
        }
        setLoading(false);
      });
  }, [user]);

  const toggle2FA = async () => {
    if (!user) return;
    setSaving(true);
    const novoValor = !usa2fa;
    await supabase.from("profiles").update({
      usa_2fa: novoValor,
    } as any).eq("id", user.id);
    setUsa2fa(novoValor);
    toast({ title: novoValor ? "✅ 2FA ativado! Você receberá um código por email ao fazer login." : "2FA desativado" });
    setSaving(false);
  };

  if (loading) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <ShieldCheck size={16} className="text-primary" /> Verificação em Duas Etapas (2FA)
      </h3>
      <p className="text-xs text-muted-foreground">
        Ative para receber um código de verificação por e-mail ao fazer login. Mais segurança para sua conta — 100% gratuito.
      </p>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        {usa2fa ? (
          <span className="text-sm font-medium text-emerald-500 flex items-center gap-1">
            <ShieldCheck size={14} /> Ativo
          </span>
        ) : (
          <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <ShieldOff size={14} /> Inativo
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {usa2fa ? (
          <Button variant="outline" onClick={toggle2FA} disabled={saving} className="border-border text-destructive hover:text-destructive">
            <ShieldOff size={14} className="mr-1" /> Desativar 2FA
          </Button>
        ) : (
          <Button onClick={toggle2FA} disabled={saving} className="bg-primary text-primary-foreground">
            {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : <ShieldCheck size={14} className="mr-1" />}
            Ativar 2FA por Email
          </Button>
        )}
      </div>
    </div>
  );
}

import ThemeToggle from "@/components/ThemeToggle";
import UserAvatar from "@/components/UserAvatar";

export default function Configuracoes() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [tel1, setTel1] = useState("");
  const [tel2, setTel2] = useState("");
  const [tel3, setTel3] = useState("");
  const [saving, setSaving] = useState(false);

  // Per-user Drive state
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveEmail, setDriveEmail] = useState<string | null>(null);
  const [checkingDrive, setCheckingDrive] = useState(true);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [disconnectingDrive, setDisconnectingDrive] = useState(false);
  const [testingDrive, setTestingDrive] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase.from("profiles").select("full_name, telefone1, telefone2, telefone3, avatar_url" as any).eq("id", user.id).single();
      if (data) {
        const d = data as any;
        setFullName(d.full_name || "");
        setAvatarUrl(d.avatar_url || null);
        setTel1(d.telefone1 || "");
        setTel2(d.telefone2 || "");
        setTel3(d.telefone3 || "");
      }
    };
    fetchProfile();
  }, [user]);

  const checkDriveStatus = useCallback(async () => {
    if (!user) return;
    setCheckingDrive(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/google-user-oauth`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status" }),
      });
      const result = await resp.json();
      setDriveConnected(result.connected || false);
      setDriveEmail(result.google_email || null);
    } catch {
      // Ignore
    } finally {
      setCheckingDrive(false);
    }
  }, [user]);

  useEffect(() => { checkDriveStatus(); }, [checkDriveStatus]);

  useEffect(() => {
    if (searchParams.get("drive") === "conectado") {
      toast({ title: "✅ Google Drive conectado!" });
      checkDriveStatus();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, checkDriveStatus, toast, setSearchParams]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName || null,
      telefone1: tel1 || null,
      telefone2: tel2 || null,
      telefone3: tel3 || null,
    }).eq("id", user.id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configurações salvas!" });
    }
    setSaving(false);
  };

  const handleConnectDrive = async () => {
    setConnectingDrive(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast({ title: "Erro", description: "Faça login primeiro.", variant: "destructive" }); return; }
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/google-user-oauth`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_auth_url", redirect_origin: "https://solar-ia.lovable.app" }),
      });
      const result = await resp.json();
      if (!resp.ok) { toast({ title: "Erro", description: result.error || "Falha na autorização", variant: "destructive" }); return; }
      window.location.href = result.authUrl;
    } catch {
      toast({ title: "Erro", description: "Falha ao iniciar conexão.", variant: "destructive" });
    } finally {
      setConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (!confirm("Deseja desconectar sua conta Google?")) return;
    setDisconnectingDrive(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      await fetch(`https://${projectId}.supabase.co/functions/v1/google-user-oauth`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      setDriveConnected(false);
      setDriveEmail(null);
      toast({ title: "Conta Google desconectada" });
    } catch {
      toast({ title: "Erro ao desconectar", variant: "destructive" });
    } finally {
      setDisconnectingDrive(false);
    }
  };

  const handleTestDrive = async () => {
    setTestingDrive(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setTestResult({ ok: false, msg: "Sessão expirada." }); return; }
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const testContent = btoa("Teste de conexão Solar - " + new Date().toISOString());
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/upload-to-drive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ file: testContent, fileName: "_teste_conexao_solar.txt", mimeType: "text/plain", metadata: { operadorNome: fullName, operadorEmail: user?.email || "" } }),
      });
      const result = await resp.json();
      if (!resp.ok) { setTestResult({ ok: false, msg: result.error || "Erro ao enviar arquivo teste." }); return; }
      try {
        const { data: tokenData } = await supabase.from("user_drive_tokens").select("access_token").eq("user_id", user!.id).single();
        if (tokenData?.access_token) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${result.driveFileId}`, { method: "DELETE", headers: { Authorization: `Bearer ${tokenData.access_token}` } });
        }
      } catch { /* ignore */ }
      setTestResult({ ok: true, msg: `Conexão OK — salvando como ${result.googleEmail}` });
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message || "Erro desconhecido" });
    } finally {
      setTestingDrive(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-primary" />
        <h1 className="text-xl font-medium text-foreground">Configurações</h1>
      </div>

      {/* Profile */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="text-sm font-medium text-foreground">Perfil</h3>
        <div className="flex items-center gap-4 pb-2 border-b border-border">
          <UserAvatar userId={user?.id} fullName={fullName} avatarUrl={avatarUrl} size="xl" editable onAvatarChange={setAvatarUrl} />
          <div>
            <p className="text-lg font-semibold text-foreground">{fullName || "Sem nome"}</p>
            <p className="text-sm text-muted-foreground">{user?.email || ""}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Passe o mouse sobre a foto para alterar</p>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome completo</label>
          <Input value={fullName} onChange={e => setFullName(e.target.value)} className="bg-secondary border-border" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail</label>
          <Input value={user?.email || ""} disabled className="bg-secondary border-border opacity-60" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">ID do usuário</label>
          <Input value={user?.id || ""} disabled className="bg-secondary border-border opacity-60 font-mono text-xs" />
        </div>
      </div>

      {/* Phone Lines */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2"><Phone size={16} /> Linhas Telefônicas (WhatsApp)</h3>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Linha 1</label>
          <Input value={tel1} onChange={e => setTel1(e.target.value)} placeholder="(34) 99999-0001" className="bg-secondary border-border" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Linha 2</label>
          <Input value={tel2} onChange={e => setTel2(e.target.value)} placeholder="(34) 99999-0002" className="bg-secondary border-border" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Linha 3</label>
          <Input value={tel3} onChange={e => setTel3(e.target.value)} placeholder="(34) 99999-0003" className="bg-secondary border-border" />
        </div>
      </div>

      {/* 2FA via SMS */}
      <TwoFactorSection />

      {/* Google Drive */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2"><Link2 size={16} /> Minha Conta Google</h3>
        {checkingDrive ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Verificando conexão...</div>
        ) : driveConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Conectado como: {driveEmail}</p>
            </div>
            <p className="text-xs text-muted-foreground">Seus ofícios serão salvos na pasta do gabinete com seu nome como autor.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleConnectDrive} disabled={connectingDrive}>🔄 Trocar conta</Button>
              <Button variant="outline" size="sm" onClick={handleDisconnectDrive} disabled={disconnectingDrive} className="text-destructive hover:text-destructive">❌ Desconectar</Button>
              <Button variant="outline" size="sm" onClick={handleTestDrive} disabled={testingDrive}>
                {testingDrive ? <Loader2 size={14} className="mr-1 animate-spin" /> : null} 🧪 Testar
              </Button>
            </div>
            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-lg border ${testResult.ok ? "bg-emerald-500/10 border-emerald-500/20" : "bg-destructive/10 border-destructive/20"}`}>
                {testResult.ok ? <CheckCircle2 size={14} className="text-emerald-500" /> : <XCircle size={14} className="text-destructive" />}
                <p className="text-xs">{testResult.msg}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <XCircle size={16} className="text-orange-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-orange-700 dark:text-orange-400">⚠️ Não conectado</p>
                <p className="text-xs text-muted-foreground">Conecte sua conta Google para salvar ofícios no Drive do Gabinete.</p>
              </div>
            </div>
            <Button onClick={handleConnectDrive} disabled={connectingDrive} className="bg-primary text-primary-foreground">
              {connectingDrive ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Link2 size={16} className="mr-1" />} Conectar minha conta Google
            </Button>
          </div>
        )}
      </div>

      {/* Audit Log (Admin only) */}
      {isAdmin && <AuditLogSection />}

      {/* Theme */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="text-sm font-medium text-foreground">Aparência</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Alternar tema claro/escuro</span>
          <ThemeToggle />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
        <Save size={16} className="mr-1" /> Salvar Configurações
      </Button>
    </div>
  );
}
