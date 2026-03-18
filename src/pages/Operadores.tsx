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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Pencil, Phone, Save, UserPlus, ShieldCheck, ShieldOff, Trash2, KeyRound, Mail, Eye, Copy, Calendar, Hash, CheckCircle, XCircle, Clock } from "lucide-react";
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
  status: string | null;
}

interface UserRole {
  user_id: string;
  role: "admin" | "user";
}

// Generate short ID based on name and email
function generateShortId(name: string | null, email: string | null): string {
  const base = `${name || ""}${email || ""}`.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!base) return "usr000";
  
  // Create a simple hash
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash) + base.charCodeAt(i);
    hash = hash & hash;
  }
  const hashStr = Math.abs(hash).toString(36).substring(0, 4);
  
  // Get first part of name or email
  const prefix = (name?.split(" ")[0]?.substring(0, 3) || email?.split("@")[0]?.substring(0, 3) || "usr").toLowerCase();
  
  return `${prefix}.${hashStr}`;
}

export default function Operadores() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Record<string, "admin" | "user">>({});
  const [loading, setLoading] = useState(true);
  
  // View profile modal
  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  const [showView, setShowView] = useState(false);
  
  // Edit mode in view modal
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTel1, setEditTel1] = useState("");
  const [editTel2, setEditTel2] = useState("");
  const [editTel3, setEditTel3] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Password change in view modal
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

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

  const openView = (p: Profile) => {
    setViewProfile(p);
    setEditName(p.full_name || "");
    setEditEmail(p.email || "");
    setEditTel1(p.telefone1 || "");
    setEditTel2(p.telefone2 || "");
    setEditTel3(p.telefone3 || "");
    setEditMode(false);
    setShowPasswordField(false);
    setNewPassword("");
    setShowView(true);
  };

  const handleSave = async () => {
    if (!viewProfile) return;
    setSaving(true);
    
    // Update profile
    const { error: profileError } = await supabase.from("profiles").update({
      full_name: editName || null,
      telefone1: editTel1 || null,
      telefone2: editTel2 || null,
      telefone3: editTel3 || null,
    }).eq("id", viewProfile.id);
    
    if (profileError) {
      toast({ title: "Erro ao salvar perfil", description: profileError.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    
    // Update email if changed and is admin
    if (isAdmin && editEmail !== viewProfile.email && editEmail) {
      const { error: emailError } = await supabase.functions.invoke("update-user-email", {
        body: { userId: viewProfile.id, newEmail: editEmail },
      });
      if (emailError) {
        toast({ title: "Erro ao atualizar e-mail", description: emailError.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }
    
    toast({ title: "Perfil atualizado!" });
    setEditMode(false);
    setSaving(false);
    fetchProfiles();
    
    // Update local state
    setViewProfile(prev => prev ? { ...prev, full_name: editName, email: editEmail, telefone1: editTel1, telefone2: editTel2, telefone3: editTel3 } : null);
  };

  const handleSavePassword = async () => {
    if (!viewProfile || !newPassword || newPassword.length < 6) {
      toast({ title: "Senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.functions.invoke("reset-user-password", {
      body: { userId: viewProfile.id, newPassword },
    });
    if (error) {
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha alterada com sucesso!" });
      setShowPasswordField(false);
      setNewPassword("");
    }
    setSavingPassword(false);
  };

  const handleToggleActive = async (userId: string, active: boolean) => {
    const { error } = await supabase.functions.invoke("toggle-user-active", {
      body: { userId, active },
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: active ? "Usuário ativado" : "Usuário desativado" });
      fetchProfiles();
      if (viewProfile?.id === userId) {
        setViewProfile(prev => prev ? { ...prev, active } : null);
      }
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
      if (viewProfile?.id === deleteUserId) {
        setShowView(false);
        setViewProfile(null);
      }
      fetchProfiles();
    }
    setDeleteUserId(null);
    setDeleting(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
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
              <TableHead>ID</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : profiles.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum operador encontrado.</TableCell></TableRow>
            ) : profiles.map(p => {
              const role = roles[p.id] || "user";
              const shortId = generateShortId(p.full_name, p.email);
              return (
                <TableRow key={p.id} className={`cursor-pointer hover:bg-muted/50 ${!p.active ? "opacity-50" : ""}`} onClick={() => openView(p)}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{shortId}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <UserAvatar userId={p.id} fullName={p.full_name} avatarUrl={p.avatar_url} size="sm" />
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
                  <TableCell className="text-right">
                    <button onClick={(e) => { e.stopPropagation(); openView(p); }} className="p-2 text-muted-foreground hover:text-foreground" title="Ver perfil">
                      <Eye size={16} />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* View/Edit Profile Dialog */}
      <Dialog open={showView} onOpenChange={setShowView}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Eye size={18} /> Perfil do Operador
            </DialogTitle>
          </DialogHeader>
          {viewProfile && (
            <div className="space-y-5">
              {/* Header with avatar and short ID */}
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <UserAvatar userId={viewProfile.id} fullName={viewProfile.full_name} avatarUrl={viewProfile.avatar_url} size="xl" />
                <div className="flex-1">
                  <p className="text-lg font-semibold text-foreground">{viewProfile.full_name || "Sem nome"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Hash size={12} className="text-muted-foreground" />
                    <span className="font-mono text-sm text-primary">{generateShortId(viewProfile.full_name, viewProfile.email)}</span>
                    <button onClick={() => copyToClipboard(generateShortId(viewProfile.full_name, viewProfile.email))} className="text-muted-foreground hover:text-foreground">
                      <Copy size={12} />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <Badge variant={roles[viewProfile.id] === "admin" ? "default" : "secondary"} className="text-xs">
                      {roles[viewProfile.id] === "admin" ? "Admin" : "Usuário"}
                    </Badge>
                    <Badge variant={viewProfile.active ? "default" : "destructive"} className="text-xs">
                      {viewProfile.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Info fields */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome completo</label>
                  {editMode ? (
                    <Input value={editName} onChange={e => setEditName(e.target.value)} className="bg-secondary border-border" />
                  ) : (
                    <p className="text-sm text-foreground">{viewProfile.full_name || "—"}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Mail size={12} /> E-mail
                  </label>
                  {editMode && isAdmin ? (
                    <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email" className="bg-secondary border-border" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-foreground">{viewProfile.email || "—"}</p>
                      {viewProfile.email && (
                        <button onClick={() => copyToClipboard(viewProfile.email!)} className="text-muted-foreground hover:text-foreground">
                          <Copy size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Phone size={12} /> Linha 1
                    </label>
                    {editMode ? (
                      <Input value={editTel1} onChange={e => setEditTel1(e.target.value)} placeholder="(34) 9..." className="bg-secondary border-border text-xs" />
                    ) : (
                      <p className="text-sm text-foreground">{viewProfile.telefone1 || "—"}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Phone size={12} /> Linha 2
                    </label>
                    {editMode ? (
                      <Input value={editTel2} onChange={e => setEditTel2(e.target.value)} placeholder="(34) 9..." className="bg-secondary border-border text-xs" />
                    ) : (
                      <p className="text-sm text-foreground">{viewProfile.telefone2 || "—"}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Phone size={12} /> Linha 3
                    </label>
                    {editMode ? (
                      <Input value={editTel3} onChange={e => setEditTel3(e.target.value)} placeholder="(34) 9..." className="bg-secondary border-border text-xs" />
                    ) : (
                      <p className="text-sm text-foreground">{viewProfile.telefone3 || "—"}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Calendar size={12} /> Cadastrado em
                  </label>
                  <p className="text-sm text-foreground">{formatDate(viewProfile.created_at)}</p>
                </div>
              </div>

              {/* Password section (admin only) */}
              {isAdmin && showPasswordField && (
                <div className="pt-3 border-t border-border space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <KeyRound size={12} /> Nova senha
                    </label>
                    <Input
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSavePassword} disabled={savingPassword || newPassword.length < 6} size="sm" className="bg-primary text-primary-foreground">
                      <KeyRound size={14} className="mr-1" /> {savingPassword ? "Salvando..." : "Salvar Senha"}
                    </Button>
                    <Button onClick={() => { setShowPasswordField(false); setNewPassword(""); }} variant="outline" size="sm">
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                {editMode ? (
                  <>
                    <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
                      <Save size={14} className="mr-1" /> {saving ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button onClick={() => setEditMode(false)} variant="outline">Cancelar</Button>
                  </>
                ) : (
                  <>
                    <Button onClick={() => setEditMode(true)} variant="outline">
                      <Pencil size={14} className="mr-1" /> Editar
                    </Button>
                    {isAdmin && (
                      <>
                        <Button onClick={() => setShowPasswordField(true)} variant="outline" disabled={showPasswordField}>
                          <KeyRound size={14} className="mr-1" /> Alterar Senha
                        </Button>
                        <Button
                          onClick={() => handleToggleRole(viewProfile.id, roles[viewProfile.id] || "user")}
                          variant="outline"
                        >
                          {roles[viewProfile.id] === "admin" ? <ShieldOff size={14} className="mr-1" /> : <ShieldCheck size={14} className="mr-1" />}
                          {roles[viewProfile.id] === "admin" ? "Remover Admin" : "Tornar Admin"}
                        </Button>
                        <Button
                          onClick={() => handleToggleActive(viewProfile.id, !viewProfile.active)}
                          variant={viewProfile.active ? "outline" : "default"}
                        >
                          {viewProfile.active ? "Desativar" : "Ativar"}
                        </Button>
                        <Button
                          onClick={() => setDeleteUserId(viewProfile.id)}
                          variant="destructive"
                        >
                          <Trash2 size={14} className="mr-1" /> Remover
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
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
