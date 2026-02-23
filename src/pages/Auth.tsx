import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import logoFabao from "@/assets/logo-fabao.png";

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(loginEmail, loginPassword);
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
      toast({ title: "Cadastro realizado!", description: "Verifique seu e-mail para confirmar a conta." });
    } catch (err: any) {
      toast({ title: "Erro ao cadastrar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <img src={logoFabao} alt="Logo Fabão" className="h-16 mx-auto mb-4" />
          <CardTitle className="text-foreground">Gabinete Vereador Fabão</CardTitle>
          <CardDescription className="text-muted-foreground">Sistema de Gestão de Ofícios</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="w-full bg-secondary">
              <TabsTrigger value="login" className="flex-1">Entrar</TabsTrigger>
              <TabsTrigger value="register" className="flex-1">Cadastrar</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <Input placeholder="E-mail" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className="bg-secondary border-border" />
                <Input placeholder="Senha" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className="bg-secondary border-border" />
                <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : null} Entrar
                </Button>
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
        </CardContent>
      </Card>
    </div>
  );
}
