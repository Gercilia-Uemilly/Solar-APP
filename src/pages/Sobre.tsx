import { Headphones, Library, FileText, Search, MessageSquare, BarChart3, Newspaper, Shield, Database, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import logoFabao from "@/assets/logo-fabao-oficial.svg";
import solarLabsIcon from "@/assets/solar-labs-icon.png";
import solarLabsHorizontal from "@/assets/solar-labs-horizontal.png";
import solarLabsDark from "@/assets/solar-labs-dark-bg.png";

const features = [
  { icon: Headphones, title: "Arquivamento de Falas", desc: "Armazene e organize áudios de posicionamentos, reuniões e falas do vereador com transcrição automática por IA." },
  { icon: Library, title: "Organização por Temas", desc: "Categorize automaticamente informações por tema (Saúde, Segurança, Mobilidade etc.) com tags geradas por IA." },
  { icon: Search, title: "Consulta Rápida", desc: "Busca inteligente permite à assessoria encontrar qualquer informação em segundos com filtros por data, tema e origem." },
  { icon: FileText, title: "Produção de Conteúdo", desc: "Gere ofícios, scripts de atendimento e respostas empáticas com auxílio de inteligência artificial." },
  { icon: Newspaper, title: "Resposta à Imprensa", desc: "Acesse rapidamente posicionamentos e dados organizados para responder a demandas da mídia." },
  { icon: MessageSquare, title: "Atendimento ao Cidadão", desc: "Scripts prontos e áudios de referência para operadores responderem demandas via WhatsApp de forma padronizada." },
  { icon: BarChart3, title: "Relatórios e Métricas", desc: "Acompanhe a produtividade do gabinete com relatórios de ofícios, demandas e atendimentos." },
  { icon: Shield, title: "Segurança e Controle", desc: "Sistema com controle de acesso por perfil (admin/operador), logs de atividade e dados protegidos." },
];

const organizes = [
  { icon: Headphones, label: "Áudios e falas do vereador" },
  { icon: Database, label: "Informações do mandato" },
  { icon: Users, label: "Demandas da população" },
  { icon: FileText, label: "Conteúdos políticos" },
  { icon: BarChart3, label: "Dados estratégicos" },
];

export default function Sobre() {
  return (
    <div className="space-y-10 max-w-4xl mx-auto pb-12">
      {/* Hero */}
      <div className="text-center space-y-4 pt-2">
        <img src={logoSolar} alt="Solar" className="w-20 h-20 mx-auto rounded-2xl object-contain" />
        <h1 className="text-3xl font-bold text-foreground">Sobre o Solar</h1>
        <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Plataforma de organização e inteligência para gabinetes parlamentares.
        </p>
      </div>

      {/* About */}
      <Card>
        <CardContent className="p-6 md:p-8 space-y-4">
          <h2 className="text-xl font-semibold text-foreground">O que é o Solar</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O <strong className="text-foreground">Solar</strong> é uma plataforma desenvolvida para organizar áudios, informações do mandato, 
            demandas da população, conteúdos políticos e dados estratégicos em uma base pesquisável e inteligente.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ele funciona como uma <strong className="text-foreground">central de inteligência do mandato</strong>, 
            centralizando informações que normalmente ficam espalhadas em WhatsApp, redes sociais e anotações pessoais — 
            permitindo que a equipe do gabinete acesse, compartilhe e produza conteúdo de forma rápida e eficiente.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Com recursos de IA integrados, o sistema automatiza a transcrição de áudios, categorização de temas, 
            geração de documentos oficiais e scripts de atendimento — tudo em um ambiente seguro e acessível 
            tanto no computador quanto no celular.
          </p>
        </CardContent>
      </Card>

      {/* What it organizes */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">O que o Solar organiza</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {organizes.map((item, i) => (
            <Card key={i} className="group hover:border-primary/30 transition-all">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <item.icon size={18} className="text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">{item.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Features grid */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">O que o Solar permite</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {features.map((f, i) => (
            <Card key={i} className="group hover:shadow-md transition-all hover:border-primary/30">
              <CardContent className="p-5 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <f.icon size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Desenvolvido por */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground text-center">Desenvolvido por</h2>
        <Card className="overflow-hidden">
          <CardContent className="p-6 md:p-8 flex flex-col items-center text-center space-y-4">
            <img src={solarLabsIcon} alt="Solar Labs" className="w-20 h-20 object-contain" />
            <div>
              <p className="text-lg font-bold text-foreground">Solar Labs</p>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed mt-2">
                Empresa especializada em desenvolvimento de tecnologia para gestão pública e inteligência de mandatos. 
                Criamos sistemas digitais que transformam a forma como gabinetes parlamentares organizam informações e atendem a população.
              </p>
            </div>
            {/* Logo versions showcase */}
            <div className="w-full pt-4 border-t border-border mt-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Identidade Visual</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col items-center gap-2">
                  <div className="bg-background border border-border rounded-xl p-4 w-full flex items-center justify-center min-h-[80px]">
                    <img src={solarLabsIcon} alt="Ícone Solar Labs" className="w-14 h-14 object-contain" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Ícone</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="bg-background border border-border rounded-xl p-4 w-full flex items-center justify-center min-h-[80px]">
                    <img src={solarLabsHorizontal} alt="Logo Horizontal" className="h-10 object-contain" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Horizontal</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="bg-foreground rounded-xl p-4 w-full flex items-center justify-center min-h-[80px]">
                    <img src={solarLabsDark} alt="Logo Fundo Escuro" className="h-10 object-contain" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Fundo escuro</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="text-center pt-4">
        <p className="text-xs text-muted-foreground">
          Solar · Gabinete Vereador Fabão · Câmara Municipal de Uberlândia
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Versão 1.0 · 2026 · Desenvolvido por Solar Labs
        </p>
      </div>
    </div>
  );
}
