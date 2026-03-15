import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Wifi, WifiOff, QrCode, RefreshCw, Unplug, Smartphone } from "lucide-react";

export default function WhatsAppConectar() {
  const { user } = useAuth();
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [status, setStatus] = useState<string>("not_configured");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [connection, setConnection] = useState<any>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  // Poll status when connecting
  useEffect(() => {
    if (status === "connecting" || status === "qr_ready") {
      const interval = setInterval(checkStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [status]);

  const checkStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { action: "status" },
      });

      if (error) throw error;

      setStatus(data.status || "not_configured");
      if (data.connection) {
        setConnection(data.connection);
        setApiUrl(data.connection.api_url || "");
        setApiKey(data.connection.api_key || "");
        setInstanceName(data.connection.instance_name || "");
        if (data.connection.qr_code && data.status === "qr_ready") {
          setQrCode(data.connection.qr_code);
        }
      }
    } catch (e) {
      console.error("Check status error:", e);
    } finally {
      setChecking(false);
    }
  };

  const handleConnect = async () => {
    if (!apiUrl || !apiKey || !instanceName) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { action: "create", api_url: apiUrl.replace(/\/$/, ""), api_key: apiKey, instance_name: instanceName },
      });

      if (error) throw error;

      if (data.qr_code) {
        setQrCode(data.qr_code);
        setStatus("qr_ready");
      } else {
        setStatus("connecting");
      }

      toast({ title: "Instância criada! Escaneie o QR Code." });
    } catch (e: any) {
      toast({ title: "Erro ao conectar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshQR = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { action: "qrcode" },
      });

      if (error) throw error;
      if (data.qr_code) {
        setQrCode(data.qr_code);
        setStatus("qr_ready");
      }
    } catch (e: any) {
      toast({ title: "Erro ao atualizar QR", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { action: "disconnect" },
      });

      if (error) throw error;
      setStatus("disconnected");
      setQrCode(null);
      toast({ title: "WhatsApp desconectado" });
    } catch (e: any) {
      toast({ title: "Erro ao desconectar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    not_configured: { label: "Não configurado", color: "secondary", icon: WifiOff },
    disconnected: { label: "Desconectado", color: "destructive", icon: WifiOff },
    connecting: { label: "Conectando...", color: "outline", icon: Loader2 },
    qr_ready: { label: "Aguardando QR Code", color: "outline", icon: QrCode },
    connected: { label: "Conectado", color: "default", icon: Wifi },
    open: { label: "Conectado", color: "default", icon: Wifi },
  };

  const currentStatus = statusConfig[status] || statusConfig.disconnected;
  const StatusIcon = currentStatus.icon;
  const isConnected = status === "connected" || status === "open";

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Smartphone size={24} />
          Conectar WhatsApp
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conecte seu número de WhatsApp via Evolution API para receber e enviar mensagens.
        </p>
      </div>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Status da Conexão
            <Badge variant={currentStatus.color as any}>
              <StatusIcon size={12} className={status === "connecting" ? "animate-spin mr-1" : "mr-1"} />
              {currentStatus.label}
            </Badge>
          </CardTitle>
          {connection?.phone_number && (
            <CardDescription>Número: {connection.phone_number}</CardDescription>
          )}
        </CardHeader>
      </Card>

      {/* QR Code */}
      {(status === "qr_ready" || status === "connecting") && qrCode && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escaneie o QR Code</CardTitle>
            <CardDescription>
              Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="bg-white p-4 rounded-xl">
              <img
                src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code WhatsApp"
                className="w-64 h-64 object-contain"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleRefreshQR} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <RefreshCw size={14} className="mr-1" />}
              Atualizar QR Code
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connection Form */}
      {!isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuração da Evolution API</CardTitle>
            <CardDescription>
              Informe os dados da sua instância Evolution API para conectar o WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">URL da API</label>
              <Input
                placeholder="https://sua-evolution-api.com"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">API Key</label>
              <Input
                type="password"
                placeholder="Sua chave de API"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Nome da Instância</label>
              <Input
                placeholder="gabinete-fabao"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
              />
            </div>
            <Button onClick={handleConnect} disabled={loading} className="w-full">
              {loading ? <Loader2 size={14} className="animate-spin mr-2" /> : <QrCode size={14} className="mr-2" />}
              Conectar WhatsApp
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connected Actions */}
      {isConnected && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Wifi size={20} className="text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-foreground">WhatsApp conectado</p>
                  <p className="text-sm text-muted-foreground">
                    Instância: {connection?.instance_name}
                  </p>
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={loading}>
                <Unplug size={14} className="mr-1" />
                Desconectar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
