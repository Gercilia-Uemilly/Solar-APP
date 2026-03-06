import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Users, Pencil, Phone, Save, UserPlus, ShieldCheck, ShieldOff, Trash2, KeyRound } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  telefone1: string | null;
  telefone2: string | null;
  telefone3: string | null;
  active: boolean;
  created_at: string;
}

interface UserRole {
  user_id: string;
  role: "admin" | "user";
}

export default function Operadores() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Record<string, "admin" | "user">>({});
  const [loading, setLoading] = useState(true);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTel1, setEditTel1] = useState("");
  const [editTel2, setEditTel2] = useState("");
  const [editTel3, setEditTel3] = useState("");

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviting, setInviting] = useState(false);

  // Delete confirmation
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setProfiles((data as Profile[]) || []);
    }

    // Fetch roles
    const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");
    if (rolesData) {
      const map: Record<string, "admin" | "user"> = {};
      (rolesData as UserRole[]).forEach(r => { map[r.user_id] = r.role; });
      setRoles(map);
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

  const handleToggleActive = async (userId: string, active: boolean) => {
    const { data, error } = await supabase.functions.invoke("toggle-user-active", {
      body: { userId, active },
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: active ? "Usuário ativado" : "Usuário desativado" });
      fetchProfiles();
    }
  };

  const handleToggleRole = async (userId: string, currentRole: "admin" | "user") => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    const { error } = await supabase.functions.invoke("toggle-user-role", {
      body: { userId, role: newRole },
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Papel alterado para ${newRole}` });
      fetchProfiles();
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !invitePassword) {
      toast({ title: "Preencha e-mail e senha", variant: "destructive" });
      return;
    }
    setInviting(true);
    const { error } = await supabase.functions.invoke("invite-user", {
      body: { email: inviteEmail, fullName: inviteName, password: invitePassword },
    });
    if (error) {
      toast({ title: "Erro ao convidar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Usuário criado com sucesso!" });
      setShowInvite(false);
      setInviteEmail("");
      setInviteName("");
      setInvitePassword("");
      fetchProfiles();
    }
    setInviting(false);
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    setDeleting(true);
    const { error } = await supabase.functions.invoke("delete-user", {
      body: { userId: deleteUserId },
    });
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Usuário removido com sucesso!" });
      fetchProfiles();
    }
    setDeleteUserId(null);
    setDeleting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-primary" />
          <div>
            <h1 className="text-xl font-medium text-foreground">Operadores</h1>
            <p className="text-sm text-muted-foreground">{profiles.length} operador(es) cadastrado(s)</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowInvite(true)} className="bg-primary text-primary-foreground">
            <UserPlus size={16} className="mr-1" /> Convidar Operador
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Linha 1</TableHead>
              <TableHead>Linha 2</TableHead>
              <TableHead>Linha 3</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : profiles.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum operador encontrado.</TableCell></TableRow>
            ) : profiles.map(p => {
              const role = roles[p.id] || "user";
              return (
                <TableRow key={p.id} className={!p.active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <UserAvatar userId={p.id} fullName={p.full_name} avatarUrl={(p as any).avatar_url} size="sm" />
                      {p.full_name || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={role === "admin" ? "default" : "secondary"} className="text-xs">
                      {role === "admin" ? "Admin" : "Usuário"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.active ? "default" : "destructive"} className="text-xs">
                      {p.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{p.telefone1 || "—"}</TableCell>
                  <TableCell className="text-sm">{p.telefone2 || "—"}</TableCell>
                  <TableCell className="text-sm">{p.telefone3 || "—"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleToggleRole(p.id, role)}
                          className="p-2 text-muted-foreground hover:text-foreground"
                          title={role === "admin" ? "Remover admin" : "Tornar admin"}
                        >
                          {role === "admin" ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                        </button>
                        <button
                          onClick={() => handleToggleActive(p.id, !p.active)}
                          className={`p-2 ${p.active ? "text-muted-foreground hover:text-destructive" : "text-green-500 hover:text-green-400"}`}
                          title={p.active ? "Desativar" : "Ativar"}
                        >
                          <Switch checked={p.active} className="pointer-events-none" />
                        </button>
                      </>
                    )}
                    <button onClick={() => openEdit(p)} className="p-2 text-muted-foreground hover:text-foreground"><Pencil size={16} /></button>
                    {isAdmin && (
                      <button
                        onClick={() => setDeleteUserId(p.id)}
                        className="p-2 text-muted-foreground hover:text-destructive"
                        title="Remover acesso"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
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

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Convidar Novo Operador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome completo</label>
              <Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Nome do operador" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail</label>
              <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="operador@email.com" type="email" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Senha inicial</label>
              <Input value={invitePassword} onChange={e => setInvitePassword(e.target.value)} placeholder="Senha temporária" type="password" className="bg-secondary border-border" />
            </div>
            <p className="text-xs text-muted-foreground">O operador poderá alterar a senha depois do primeiro login.</p>
            <Button onClick={handleInvite} disabled={inviting} className="w-full bg-primary text-primary-foreground">
              <UserPlus size={16} className="mr-1" /> {inviting ? "Criando..." : "Criar Operador"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso do operador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O usuário será removido permanentemente do sistema e perderá todo o acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
