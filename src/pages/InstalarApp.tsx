import { useEffect, useState } from "react";
import { Smartphone, Download, Share2, Plus, Apple, Chrome, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstalarApp() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform("ios");
    else if (/android/.test(ua)) setPlatform("android");
    else setPlatform("desktop");

    // Detect if already installed
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone) {
      setInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      toast.success("Aplicativo instalado com sucesso!");
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      toast.info("Use o menu do navegador para instalar (Compartilhar → Adicionar à Tela de Início)");
      return;
    }
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      toast.success("Instalando o Solar...");
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary">
          <Smartphone size={32} strokeWidth={1.5} />
        </div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Instalar o Solar no celular</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Tenha o Solar como um aplicativo na tela inicial do seu celular ou computador. Funciona offline,
          abre rápido e parece um app nativo.
        </p>
      </div>

      {installed ? (
        <Card className="p-6 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-500" size={24} />
            <div>
              <p className="font-semibold text-foreground">Aplicativo já instalado</p>
              <p className="text-sm text-muted-foreground">Você está usando o Solar como aplicativo.</p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold text-foreground">Instalação automática</p>
              <p className="text-sm text-muted-foreground">
                Funciona em Chrome, Edge e Android. No iPhone, siga as instruções abaixo.
              </p>
            </div>
            <Button onClick={handleInstall} size="lg" className="gap-2">
              <Download size={18} />
              Instalar agora
            </Button>
          </div>
        </Card>
      )}

      {/* iOS */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Apple size={20} className="text-foreground" />
          <h2 className="text-lg font-semibold text-foreground">No iPhone / iPad (Safari)</h2>
        </div>
        <ol className="space-y-3 text-sm text-foreground">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
            <span>Abra <strong>solar-ia.lovable.app</strong> no <strong>Safari</strong> (não funciona no Chrome do iPhone).</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
            <span className="flex items-center gap-1.5 flex-wrap">
              Toque no botão <Share2 size={14} className="inline" /> <strong>Compartilhar</strong> (na barra inferior).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</span>
            <span className="flex items-center gap-1.5 flex-wrap">
              Role e toque em <Plus size={14} className="inline" /> <strong>Adicionar à Tela de Início</strong>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">4</span>
            <span>Confirme em <strong>Adicionar</strong>. O ícone do Solar aparecerá na tela inicial.</span>
          </li>
        </ol>
      </Card>

      {/* Android */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Chrome size={20} className="text-foreground" />
          <h2 className="text-lg font-semibold text-foreground">No Android (Chrome)</h2>
        </div>
        <ol className="space-y-3 text-sm text-foreground">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
            <span>Abra <strong>solar-ia.lovable.app</strong> no <strong>Chrome</strong>.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
            <span>Toque no botão <strong>Instalar agora</strong> no topo desta página, ou use o menu (⋮) do Chrome → <strong>Instalar aplicativo</strong>.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</span>
            <span>Confirme em <strong>Instalar</strong>. O Solar aparecerá entre seus aplicativos.</span>
          </li>
        </ol>
      </Card>

      <Card className="p-4 bg-muted/30">
        <p className="text-xs text-muted-foreground">
          <strong>Dica:</strong> a instalação só funciona quando você acessa pelo endereço público
          (<code className="text-foreground">solar-ia.lovable.app</code>), não pelo editor da Lovable.
        </p>
      </Card>
    </div>
  );
}
