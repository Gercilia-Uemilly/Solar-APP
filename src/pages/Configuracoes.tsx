import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Save, Phone, HardDrive, CheckCircle2, ExternalLink } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import UserAvatar from "@/components/UserAvatar";

export default function Configuracoes() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [tel1, setTel1] = useState("");
  const [tel2, setTel2] = useState("");
  const [tel3, setTel3] = useState("");
  const [saving, setSaving] = useState(false);
  const [driveAuthorized, setDriveAuthorized] = useState(false);
  const [checkingDrive, setCheckingDrive] = useState(false);

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

  useEffect(() => {
    if (!isAdmin) return;
    const checkDriveAuth = async () => {
      setCheckingDrive(true);
      const { data } = await supabase
        .from("app_settings" as any)
        .select("value")
        .eq("key", "google_refresh_token")
        .single();
      setDriveAuthorized(!!(data as any)?.value);
      setCheckingDrive(false);
    };
    checkDriveAuth();
  }, [isAdmin]);

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

  const handleAuthorizeDrive = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
        return;
      }
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/google-oauth-callback`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await resp.json();
      if (!resp.ok) {
        toast({ title: "Erro", description: result.error || "Falha na autorização", variant: "destructive" });
        return;
      }
      window.open(result.authUrl, "_blank", "width=600,height=700");
    } catch (e) {
      toast({ title: "Erro", description: "Falha ao iniciar autorização Google.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-primary" />
        <h1 className="text-xl font-medium text-foreground">Configurações</h1>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="text-sm font-medium text-foreground">Perfil</h3>
        <div className="flex items-center gap-4 pb-2 border-b border-border">
          <UserAvatar
            userId={user?.id}
            fullName={fullName}
            avatarUrl={avatarUrl}
            size="xl"
            editable
            onAvatarChange={setAvatarUrl}
          />
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

      {isAdmin && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <HardDrive size={16} /> Google Drive
          </h3>
          <p className="text-xs text-muted-foreground">
            Autorize sua conta Google para que os ofícios sejam salvos no seu Google Drive pessoal.
          </p>
          {checkingDrive ? (
            <p className="text-xs text-muted-foreground">Verificando...</p>
          ) : driveAuthorized ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-500" />
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">Google Drive autorizado</span>
              <Button variant="outline" size="sm" onClick={handleAuthorizeDrive} className="ml-auto">
                <ExternalLink size={14} className="mr-1" /> Reautorizar
              </Button>
            </div>
          ) : (
            <Button onClick={handleAuthorizeDrive} className="bg-primary text-primary-foreground">
              <ExternalLink size={16} className="mr-1" /> Autorizar Google Drive
            </Button>
          )}
        </div>
      )}

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
