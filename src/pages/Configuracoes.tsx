import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Save, Phone } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function Configuracoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [tel1, setTel1] = useState("");
  const [tel2, setTel2] = useState("");
  const [tel3, setTel3] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase.from("profiles").select("full_name, telefone1, telefone2, telefone3").eq("id", user.id).single();
      if (data) {
        setFullName(data.full_name || "");
        setTel1(data.telefone1 || "");
        setTel2(data.telefone2 || "");
        setTel3(data.telefone3 || "");
      }
    };
    fetch();
  }, [user]);

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

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-primary" />
        <h1 className="text-xl font-medium text-foreground">Configurações</h1>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h3 className="text-sm font-medium text-foreground">Perfil</h3>
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
