import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, ShieldCheck, Mail } from "lucide-react";
import logoSolar from "@/assets/logo-solar.png";

export default function VerificarEmail() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [email, setEmail] = useState("");
  const [emailMasked, setEmailMasked] = useState("");
  const [tentativas, setTentativas] = useState(0);
  const [bloqueadoAte, setBloqueadoAte] = useState<Date | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const pendingEmail = sessionStorage.getItem("2fa_email");
    if (!pendingEmail) {
      navigate("/login");
      return;
    }
    setEmail(pendingEmail);
    // Mask email: ge***@gmail.com
    const [local, domain] = pendingEmail.split("@");
    const masked = local.length > 2
      ? local.slice(0, 2) + "***"
      : local + "***";
    setEmailMasked(`${masked}@${domain}`);

    // Start cooldown
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [navigate]);

  const verificarCodigo = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (error) {
        toast({ title: "Código inválido ou expirado", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      // Check profile approval
      if (data.user) {
        const { data: perfil } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", data.user.id)
          .single();
        if (perfil?.status !== "aprovado") {
          navigate("/aguardando-aprovacao");
          return;
        }
      }

      sessionStorage.removeItem("2fa_email");
      toast({ title: "✅ Acesso liberado!" });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const reenviarCodigo = async () => {
    if (cooldown > 0) return;

    // Rate limit: 3 attempts, then block 15 min
    if (tentativas >= 3 && bloqueadoAte) {
      const agora = new Date();
      if (agora < bloqueadoAte) {
        const minutos = Math.ceil((bloqueadoAte.getTime() - agora.getTime()) / 60000);
        toast({ title: `Aguarde ${minutos} min para reenviar`, variant: "destructive" });
        return;
      }
      // Reset after block expires
      setTentativas(0);
      setBloqueadoAte(null);
    }

    try {
      await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      const novasTentativas = tentativas + 1;
      setTentativas(novasTentativas);
      if (novasTentativas >= 3) {
        setBloqueadoAte(new Date(Date.now() + 15 * 60 * 1000));
      }

      toast({ title: "Novo código enviado!" });
      setCooldown(60);
      cooldownRef.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      toast({ title: "Erro ao reenviar", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-card border-border">
        <CardHeader className="text-center">
          <img src={logoSolar} alt="Solar" className="h-16 mx-auto mb-2" />
          <ShieldCheck size={32} className="mx-auto text-primary mb-2" />
          <CardTitle className="text-foreground">Verificação de Segurança</CardTitle>
          <CardDescription className="text-muted-foreground">
            <Mail size={14} className="inline mr-1" />
            Enviamos um código para: <strong>{emailMasked}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            onClick={verificarCodigo}
            disabled={loading || code.length !== 6}
            className="w-full bg-primary text-primary-foreground"
          >
            {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
            ✅ Verificar
          </Button>

          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground">Válido por 10 minutos</p>
            <p className="text-xs text-muted-foreground">Não recebeu o código?</p>
            <button
              onClick={reenviarCodigo}
              disabled={cooldown > 0}
              className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar código"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
