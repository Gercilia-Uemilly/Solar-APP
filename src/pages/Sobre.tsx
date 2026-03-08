import { Library, Headphones, FileText, Search, MessageSquare, BarChart3, Newspaper, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import logoSolar from "@/assets/logo-solar.png";

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

export default function Sobre() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center space-y-4">
        <img src={logoSolar} alt="Solar" className="w-20 h-20 mx-auto rounded-2xl object-contain" />
        <h1 className="text-3xl font-bold text-foreground">Solar</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Sistema de inteligência e organização de informações para gabinetes parlamentares.
        </p>
      </div>

      {/* Mission */}
      <Card>
        <CardContent className="p-6 md:p-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">Sobre o Sistema</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O <strong className="text-foreground">Solar</strong> é uma plataforma desenvolvida para organizar áudios, informações, 
            demandas da população e conteúdos políticos em uma base pesquisável e inteligente. 
            Ele funciona como uma <strong className="text-foreground">central de inteligência do mandato</strong>, 
            permitindo que a equipe do gabinete acesse, compartilhe e produza conteúdo de forma rápida e eficiente.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">
            Com recursos de IA integrados, o sistema automatiza a transcrição de áudios, categorização de temas, 
            geração de documentos oficiais e scripts de atendimento — tudo em um ambiente seguro e acessível 
            tanto no computador quanto no celular.
          </p>
        </CardContent>
      </Card>

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

      {/* Footer */}
      <div className="text-center pb-8">
        <p className="text-xs text-muted-foreground">
          Solar · Gabinete Vereador Fabão · Câmara Municipal de Uberlândia
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Versão 1.0 · 2026
        </p>
      </div>
    </div>
  );
}
