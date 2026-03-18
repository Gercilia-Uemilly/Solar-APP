import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, ShieldCheck } from "lucide-react";
import logoSolar from "@/assets/logo-solar.png";

export default function VerificarSMS() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [celularMasked, setCelularMasked] = useState("");
  const [celular, setCelular] = useState("");
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Get phone from sessionStorage (set during login)
    const phone = sessionStorage.getItem("2fa_celular");
    if (!phone) {
      navigate("/login");
      return;
    }
    setCelular(phone);
    setCelularMasked("****" + phone.slice(-4));

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
      const { error } = await supabase.auth.verifyOtp({
        phone: celular,
        token: code,
        type: "sms",
      });
      if (error) {
        toast({ title: "Código inválido ou expirado", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      sessionStorage.removeItem("2fa_celular");
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
    try {
      await supabase.auth.signInWithOtp({ phone: celular });
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
          <CardTitle className="text-foreground">Verificação em duas etapas</CardTitle>
          <CardDescription className="text-muted-foreground">
            Digite o código enviado por SMS para o número {celularMasked}
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

          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Não recebeu o código?</p>
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
