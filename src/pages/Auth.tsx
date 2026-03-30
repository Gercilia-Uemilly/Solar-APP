import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoSolar from "@/assets/logo-solar.png";

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let email = loginIdentifier;
      if (!loginIdentifier.includes("@")) {
        const { data, error } = await supabase.rpc("get_email_by_username", { _username: loginIdentifier });
        if (error || !data) throw new Error("Usuário não encontrado");
        email = data;
      }
      const { status } = await signIn(email, loginPassword);
      if (status === "pendente") {
        navigate("/aguardando-aprovacao");
        return;
      }
      if (status === "bloqueado") {
        toast({ title: "Acesso bloqueado", description: "Entre em contato com o administrador.", variant: "destructive" });
        return;
      }

      // Check 2FA via Email OTP
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: perfil } = await supabase
          .from("profiles")
          .select("usa_2fa" as any)
          .eq("id", user.id)
          .single();
        const p = perfil as any;
        if (p?.usa_2fa) {
          // Sign out current session, then send email OTP
          await supabase.auth.signOut();
          const { error: otpError } = await supabase.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: false },
          });
          if (!otpError) {
            sessionStorage.setItem("2fa_email", email);
            navigate("/verificar-sms");
            const [local, domain] = email.split("@");
            const masked = local.length > 2 ? local.slice(0, 2) + "***" : local + "***";
            toast({ title: `Código enviado para ${masked}@${domain}` });
            return;
          }
        }
      }
    } catch (err: any) {
      toast({ title: "Erro ao entrar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp(regEmail, regPassword, regName);
      toast({ title: "Cadastro realizado!", description: "Seu acesso será liberado após aprovação do administrador." });
    } catch (err: any) {
      toast({ title: "Erro ao cadastrar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada para redefinir a senha." });
      setShowForgot(false);
      setForgotEmail("");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <img src={logoSolar} alt="Solar" className="h-20 mx-auto mb-4" />
          <CardTitle className="text-foreground">Solar</CardTitle>
          <CardDescription className="text-muted-foreground">Sistema de Gerenciamento de Mandato</CardDescription>
        </CardHeader>
        <CardContent>
          {showForgot ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground">Esqueci minha senha</h3>
              <p className="text-xs text-muted-foreground">Insira seu e-mail e enviaremos um link de recuperação.</p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <Input placeholder="Seu e-mail" type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required className="bg-secondary border-border" />
                <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={forgotLoading}>
                  {forgotLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : null} Enviar link
                </Button>
              </form>
              <button onClick={() => setShowForgot(false)} className="text-xs text-primary hover:underline w-full text-center">← Voltar ao login</button>
            </div>
          ) : (
            <Tabs defaultValue="login">
              <TabsList className="w-full bg-secondary">
                <TabsTrigger value="login" className="flex-1">Entrar</TabsTrigger>
                <TabsTrigger value="register" className="flex-1">Cadastrar</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <Input 
                    placeholder="E-mail ou nome de usuário" 
                    value={loginIdentifier} 
                    onChange={e => setLoginIdentifier(e.target.value)} 
                    required 
                    className="bg-secondary border-border" 
                  />
                  <Input placeholder="Senha" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className="bg-secondary border-border" />
                  <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : null} Entrar
                  </Button>
                  <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-primary hover:underline w-full text-center">Esqueci minha senha</button>
                </form>
              </TabsContent>
              <TabsContent value="register">
                <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                  <Input placeholder="Nome completo" value={regName} onChange={e => setRegName(e.target.value)} required className="bg-secondary border-border" />
                  <Input placeholder="E-mail" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required className="bg-secondary border-border" />
                  <Input placeholder="Senha (mínimo 6 caracteres)" type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={6} className="bg-secondary border-border" />
                  <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : null} Cadastrar
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
