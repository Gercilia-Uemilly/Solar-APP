import { Shield, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft size={16} /> Voltar
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <Shield className="text-primary" size={28} />
          <h1 className="text-3xl font-bold">Política de Privacidade</h1>
        </div>

        <p className="text-sm text-muted-foreground mb-8">Última atualização: 11 de março de 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Introdução</h2>
            <p>
              O <strong>Solar IA</strong> é uma plataforma de gestão de documentos oficiais (ofícios) desenvolvida para uso interno do gabinete do Vereador Fabão. 
              Esta política descreve quais dados coletamos, como os utilizamos e como protegemos sua privacidade.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Dados que coletamos</h2>
            <p>Coletamos os seguintes dados dos operadores autorizados:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Dados de cadastro:</strong> nome completo, endereço de e-mail e senha (criptografada).</li>
              <li><strong>Dados de perfil:</strong> foto de avatar e números de telefone de trabalho.</li>
              <li><strong>Dados de sessão:</strong> endereço IP e agente do navegador para fins de segurança.</li>
              <li><strong>Documentos gerados:</strong> ofícios, textos, metadados de solicitantes e informações de protocolo.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Integração com o Google Drive</h2>
            <p>
              O Solar IA oferece integração opcional com o <strong>Google Drive</strong> para permitir o upload automático de documentos gerados. 
              Ao conectar sua conta Google, solicitamos acesso aos seguintes escopos:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong><code>drive.file</code></strong> — Permite criar e gerenciar <em>apenas</em> os arquivos criados pelo Solar IA no Google Drive. 
                O aplicativo <strong>não acessa, lê ou modifica</strong> nenhum outro arquivo existente no seu Drive.
              </li>
              <li>
                <strong><code>userinfo.email</code></strong> — Permite identificar o endereço de e-mail da conta Google conectada para exibição no perfil do operador.
              </li>
            </ul>
            <p>
              Os tokens de acesso OAuth são armazenados de forma segura no banco de dados e são vinculados exclusivamente ao operador que realizou a autorização. 
              Cada operador conecta sua própria conta Google individualmente.
            </p>
            <p>
              Você pode desconectar sua conta Google a qualquer momento nas <strong>Configurações</strong> do aplicativo, o que revogará imediatamente o acesso do Solar IA ao seu Google Drive.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Como usamos os dados</h2>
            <p>Os dados coletados são utilizados exclusivamente para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Geração, gestão e arquivamento de documentos oficiais.</li>
              <li>Upload automático de ofícios para o Google Drive do operador.</li>
              <li>Controle de acesso e auditoria interna de operações.</li>
              <li>Geração de relatórios de produtividade para a administração.</li>
            </ul>
            <p><strong>Não vendemos, compartilhamos ou transferimos</strong> dados pessoais ou documentos para terceiros.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Armazenamento e segurança</h2>
            <p>
              Todos os dados são armazenados em servidores seguros com criptografia em trânsito (TLS/SSL) e em repouso. 
              O acesso ao banco de dados é restrito por políticas de segurança em nível de linha (RLS), garantindo que cada operador acesse apenas seus próprios dados sensíveis.
            </p>
            <p>
              Tokens OAuth do Google são armazenados de forma criptografada e nunca são expostos no código-fonte ou em logs do aplicativo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Retenção de dados</h2>
            <p>
              Os dados de documentos são retidos enquanto forem necessários para fins de registro e auditoria do gabinete. 
              Dados de perfil de operadores são removidos quando a conta é desativada ou excluída por um administrador.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Seus direitos</h2>
            <p>Como operador do sistema, você tem direito a:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Acessar e corrigir seus dados pessoais nas Configurações.</li>
              <li>Desconectar sua conta Google a qualquer momento.</li>
              <li>Solicitar a exclusão dos seus dados pessoais ao administrador do sistema.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Contato</h2>
            <p>
              Para dúvidas sobre esta política ou sobre o tratamento dos seus dados, entre em contato com o administrador do sistema 
              através do canal de suporte interno do aplicativo.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Solar IA — Gabinete Vereador Fabão. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
}
