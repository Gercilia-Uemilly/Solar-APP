import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoFabao from "@/assets/logo-fabao-oficial.svg";

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
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const secsLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
      toast({ title: "Muitas tentativas", description: `Aguarde ${secsLeft}s antes de tentar novamente.`, variant: "destructive" });
      return;
    }
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

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: perfil } = await supabase
          .from("profiles")
          .select("usa_2fa" as any)
          .eq("id", user.id)
          .single();
        const p = perfil as any;
        if (p?.usa_2fa) {
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
      const attempts = loginAttempts + 1;
      setLoginAttempts(attempts);
      if (attempts >= 5) {
        setLockoutUntil(Date.now() + 60_000);
        setLoginAttempts(0);
        toast({ title: "Conta bloqueada temporariamente", description: "Muitas tentativas. Aguarde 1 minuto.", variant: "destructive" });
      } else {
        toast({ title: "Erro ao entrar", description: err.message, variant: "destructive" });
      }
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, hsl(216 59% 26%) 0%, hsl(216 70% 13%) 100%)" }}>
      <div className="w-full max-w-[400px] bg-card rounded-lg p-10 shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-t-4 border-t-secondary">
        <div className="text-center mb-8">
          <img src={logoFabao} alt="Gabinete" className="h-16 mx-auto mb-5" />
          <h1 className="font-serif text-[22px] font-bold text-primary">
            Solar
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1 font-sans">
            Sistema de Gerenciamento de Mandato Parlamentar
          </p>
        </div>

        {showForgot ? (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground font-serif">Esqueci minha senha</h3>
            <p className="text-xs text-muted-foreground font-sans">Insira seu e-mail e enviaremos um link de recuperação.</p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <Input placeholder="Seu e-mail" type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required className="border-border focus:border-primary focus:ring-primary/10" />
              <Button type="submit" className="w-full" disabled={forgotLoading}>
                {forgotLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : null} Enviar link
              </Button>
            </form>
            <button onClick={() => setShowForgot(false)} className="text-xs text-primary hover:underline w-full text-center font-sans">← Voltar ao login</button>
          </div>
        ) : (
          <Tabs defaultValue="login">
            <TabsList className="w-full bg-muted">
              <TabsTrigger value="login" className="flex-1 font-sans font-semibold text-[14px]">Entrar</TabsTrigger>
              <TabsTrigger value="register" className="flex-1 font-sans font-semibold text-[14px]">Cadastrar</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-5">
                <div>
                  <label className="text-[13px] font-semibold text-foreground uppercase tracking-wide mb-1.5 block font-sans">Identificação</label>
                  <Input
                    placeholder="E-mail ou nome de usuário"
                    value={loginIdentifier}
                    onChange={e => setLoginIdentifier(e.target.value)}
                    required
                    className="border-border focus:border-primary focus:ring-primary/10"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-foreground uppercase tracking-wide mb-1.5 block font-sans">Senha</label>
                  <div className="relative">
                    <Input placeholder="Sua senha" type={showLoginPassword ? "text" : "password"} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className="border-border focus:border-primary focus:ring-primary/10 pr-10" />
                    <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full font-sans font-semibold text-[14px]" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : null} Entrar
                </Button>
                <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-primary hover:underline w-full text-center font-sans">Esqueci minha senha</button>
              </form>
            </TabsContent>
            <TabsContent value="register">
              <form onSubmit={handleSignUp} className="space-y-4 mt-5">
                <div>
                  <label className="text-[13px] font-semibold text-foreground uppercase tracking-wide mb-1.5 block font-sans">Nome completo</label>
                  <Input placeholder="Seu nome completo" value={regName} onChange={e => setRegName(e.target.value)} required className="border-border focus:border-primary focus:ring-primary/10" />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-foreground uppercase tracking-wide mb-1.5 block font-sans">E-mail</label>
                  <Input placeholder="seu@email.com" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required className="border-border focus:border-primary focus:ring-primary/10" />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-foreground uppercase tracking-wide mb-1.5 block font-sans">Senha</label>
                  <Input placeholder="Mínimo 6 caracteres" type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={6} className="border-border focus:border-primary focus:ring-primary/10" />
                </div>
                <Button type="submit" className="w-full font-sans font-semibold text-[14px]" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : null} Cadastrar
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
