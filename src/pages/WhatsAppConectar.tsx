import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Wifi, WifiOff, Unplug, Smartphone, Bot, CheckCircle2 } from "lucide-react";

export default function WhatsAppConectar() {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>("not_configured");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [connection, setConnection] = useState<any>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    if (status === "connecting") {
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
      if (data.connection) setConnection(data.connection);
    } catch (e) {
      console.error("Check status error:", e);
    } finally {
      setChecking(false);
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
          Integração via Z-API para receber e enviar mensagens com atendimento automático por IA.
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

      {/* Not configured */}
      {(status === "not_configured" || status === "disconnected") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuração Z-API</CardTitle>
            <CardDescription>
              As credenciais da Z-API (Instance ID e Token) são configuradas de forma segura no backend.
              Entre em contato com o administrador para configurar ou atualizar as credenciais.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-primary mt-0.5 flex-shrink-0" />
                <span>Webhook configurado automaticamente para receber mensagens</span>
              </div>
              <div className="flex items-start gap-2">
                <Bot size={16} className="text-primary mt-0.5 flex-shrink-0" />
                <span>Agente de IA responde automaticamente aos cidadãos</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-primary mt-0.5 flex-shrink-0" />
                <span>Demandas são registradas automaticamente no sistema</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connected */}
      {isConnected && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Wifi size={20} className="text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-foreground">WhatsApp conectado via Z-API</p>
                  <p className="text-sm text-muted-foreground">
                    Agente de IA ativo • Demandas registradas automaticamente
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

      {/* AI Agent Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot size={18} />
            Agente de Atendimento IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>O agente automático realiza as seguintes ações para cada mensagem recebida:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>Interpreta o problema relatado pelo cidadão</li>
            <li>Identifica endereço, bairro e secretaria responsável</li>
            <li>Registra automaticamente a demanda no sistema</li>
            <li>Responde ao cidadão com linguagem empática e natural</li>
            <li>Consulta histórico de conversas e demandas anteriores</li>
            <li>Utiliza a base de conhecimento do sistema</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
