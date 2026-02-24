import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Pencil, Phone, Save } from "lucide-react";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  telefone1: string | null;
  telefone2: string | null;
  telefone3: string | null;
  created_at: string;
}

export default function Operadores() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTel1, setEditTel1] = useState("");
  const [editTel2, setEditTel2] = useState("");
  const [editTel3, setEditTel3] = useState("");

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setProfiles((data as Profile[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const openEdit = (p: Profile) => {
    setEditProfile(p);
    setEditName(p.full_name || "");
    setEditTel1(p.telefone1 || "");
    setEditTel2(p.telefone2 || "");
    setEditTel3(p.telefone3 || "");
    setShowEdit(true);
  };

  const handleSave = async () => {
    if (!editProfile) return;
    const { error } = await supabase.from("profiles").update({
      full_name: editName || null,
      telefone1: editTel1 || null,
      telefone2: editTel2 || null,
      telefone3: editTel3 || null,
    }).eq("id", editProfile.id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Operador atualizado!" });
      setShowEdit(false);
      fetchProfiles();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users size={24} className="text-primary" />
        <div>
          <h1 className="text-xl font-medium text-foreground">Operadores</h1>
          <p className="text-sm text-muted-foreground">{profiles.length} operador(es) cadastrado(s)</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Linha 1</TableHead>
              <TableHead>Linha 2</TableHead>
              <TableHead>Linha 3</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : profiles.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum operador encontrado.</TableCell></TableRow>
            ) : profiles.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.email || "—"}</TableCell>
                <TableCell className="text-sm">{p.telefone1 || "—"}</TableCell>
                <TableCell className="text-sm">{p.telefone2 || "—"}</TableCell>
                <TableCell className="text-sm">{p.telefone3 || "—"}</TableCell>
                <TableCell className="text-right">
                  <button onClick={() => openEdit(p)} className="p-2 text-muted-foreground hover:text-foreground"><Pencil size={16} /></button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar Operador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1"><Phone size={12} /> Linha 1 (WhatsApp)</label>
              <Input value={editTel1} onChange={e => setEditTel1(e.target.value)} placeholder="(34) 99999-0001" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1"><Phone size={12} /> Linha 2 (WhatsApp)</label>
              <Input value={editTel2} onChange={e => setEditTel2(e.target.value)} placeholder="(34) 99999-0002" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1"><Phone size={12} /> Linha 3 (WhatsApp)</label>
              <Input value={editTel3} onChange={e => setEditTel3(e.target.value)} placeholder="(34) 99999-0003" className="bg-secondary border-border" />
            </div>
            <Button onClick={handleSave} className="w-full bg-primary text-primary-foreground">
              <Save size={16} className="mr-1" /> Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
