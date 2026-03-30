import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";
import logoFabao from "@/assets/logo-fabao-oficial.svg";

export default function AguardandoAprovacao() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <img src={logoFabao} alt="Gabinete" className="h-16 mx-auto" />
        <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
          <Clock size={40} className="text-amber-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Cadastro em análise</h1>
          <p className="text-sm text-muted-foreground">
            Seu acesso está aguardando aprovação do administrador.
          </p>
          <p className="text-sm text-muted-foreground">
            Você receberá acesso em breve. Em caso de urgência, entre em contato diretamente com o gabinete.
          </p>
        </div>
        <Button variant="outline" onClick={() => signOut()} className="gap-2">
          <LogOut size={16} /> Sair
        </Button>
      </div>
    </div>
  );
}
