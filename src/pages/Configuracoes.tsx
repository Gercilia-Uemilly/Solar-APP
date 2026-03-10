import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Save, Phone, CheckCircle2, XCircle, Loader2, Link2 } from "lucide-react";
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
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "status" }),
      });
      const result = await resp.json();
      setDriveConnected(result.connected || false);
      setDriveEmail(result.google_email || null);
      // folder ID is now fixed (gabinete folder)
    } catch {
      // Ignore
    } finally {
      setCheckingDrive(false);
    }
  }, [user]);

  useEffect(() => {
    checkDriveStatus();
  }, [checkDriveStatus]);

  // Handle return from OAuth callback
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
      if (!token) {
        toast({ title: "Erro", description: "Faça login primeiro.", variant: "destructive" });
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/google-user-oauth`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "get_auth_url", redirect_origin: window.location.origin }),
      });
      const result = await resp.json();
      if (!resp.ok) {
        toast({ title: "Erro", description: result.error || "Falha na autorização", variant: "destructive" });
        return;
      }
      // Redirect to Google OAuth (not popup)
      window.location.href = result.authUrl;
    } catch {
      toast({ title: "Erro", description: "Falha ao iniciar conexão.", variant: "destructive" });
    } finally {
      setConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (!confirm("Deseja desconectar sua conta Google? Sem conexão, não será possível salvar ofícios no Drive do gabinete com seu nome.")) return;
    setDisconnectingDrive(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      await fetch(`https://${projectId}.supabase.co/functions/v1/google-user-oauth`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
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

      {/* Minha Conta Google */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Link2 size={16} /> Minha Conta Google
        </h3>

        {checkingDrive ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Verificando conexão...
          </div>
        ) : driveConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <CheckCircle2 size={16} className="text-green-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">Conectado como: {driveEmail}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Seus ofícios serão salvos na pasta do gabinete com seu nome como autor.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleConnectDrive} disabled={connectingDrive}>
                🔄 Trocar conta
              </Button>
              <Button variant="outline" size="sm" onClick={handleDisconnectDrive} disabled={disconnectingDrive} className="text-destructive hover:text-destructive">
                ❌ Desconectar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <XCircle size={16} className="text-orange-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-orange-700 dark:text-orange-400">⚠️ Não conectado</p>
                <p className="text-xs text-muted-foreground">Conecte sua conta Google para que seus ofícios apareçam com seu nome no Drive do Gabinete.</p>
              </div>
            </div>
            <Button onClick={handleConnectDrive} disabled={connectingDrive} className="bg-primary text-primary-foreground">
              {connectingDrive ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Link2 size={16} className="mr-1" />}
              Conectar minha conta Google
            </Button>
          </div>
        )}
      </div>



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
