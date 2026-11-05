import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Uberlândia segue 100% pelo SECRETARIAS_CONFIG (oficioUtils.ts); as outras cidades vêm de orgaos_publicos. */
export const CIDADE_PADRAO = "Uberlândia";

export interface OrgaoCidade {
  id: string;
  nome: string;
  sigla: string | null;
  esfera: string;
  email: string | null;
  telefone: string | null;
  situacao: string;
  destinatario: string | null;
  vocativo: string | null;
  tratamento_situacao: string | null;
}

/** Chave do SECRETARIAS_CONFIG (o que a IA devolve) -> categoria do roteamento */
const CATEGORIA_POR_SECRETARIA: Record<string, string> = {
  "Serviços Urbanos": "infraestrutura",
  "Infraestrutura": "infraestrutura",
  "Trânsito e Transportes (SETTRAN)": "transito",
  "DMAE": "agua_esgoto",
  "Saúde": "saude",
  "Educação": "educacao",
  "Desenvolvimento Social": "assistencia_social",
  "Gestão Ambiental e Sustentabilidade": "meio_ambiente",
  "Habitação": "moradia",
  "Segurança Integrada": "seguranca",
  "Planejamento Urbano": "planejamento",
  "Finanças": "tributos",
  "Agronegócio": "rural",
  "Desenvolvimento Econômico e Inovação": "emprego",
  "Cultura e Turismo": "esporte_cultura",
  "Procuradoria-Geral do Município": "juridico",
  "Comunicação": "comunicacao",
};

export const categoriaDaSecretaria = (chave: string): string | null => CATEGORIA_POR_SECRETARIA[chave] || null;

/** Aviso amarelo: e-mail faltando, órgão "conferir" ou tratamento ainda não conferido */
export const avisosOrgao = (o: OrgaoCidade): string[] => {
  const avisos: string[] = [];
  if (!o.email || o.situacao === "sem_email") avisos.push("sem e-mail");
  if (o.situacao === "conferir" || o.situacao === "email_com_erro") avisos.push("dados do órgão para conferir");
  if (o.tratamento_situacao !== "ok") avisos.push("destinatário e vocativo para conferir");
  return avisos;
};

export const destinatarioOrgao = (o: OrgaoCidade, cidade: string): string =>
  o.destinatario || `Ilmo(a). Sr(a). Responsável pelo(a) ${o.nome} – ${cidade}/MG`;

export const vocativoOrgao = (o: OrgaoCidade): string => o.vocativo || "Prezado(a) Senhor(a),";

const ARTIGO_O = /^(Departamento|Instituto|PROCON|Ministério|Batalhão|Hospital|SAE|Serviço|Conselho|Fundo|Protocolo|Gabinete|Núcleo|Centro)/i;

/** Nome do órgão com a cidade, para o parágrafo de encaminhamento ("...apreciação da Secretaria ... de Araguari") */
export const nomeOrgaoComCidade = (o: OrgaoCidade, cidade: string): string => {
  const nome = o.nome.replace(/\s*\([^)]*\)/g, "").trim();
  return nome.toLowerCase().includes(cidade.toLowerCase()) ? nome : `${nome} de ${cidade}`;
};

export const encerramentoOrgao = (o: OrgaoCidade, cidade: string): string => {
  const nome = nomeOrgaoComCidade(o, cidade);
  const artigo = ARTIGO_O.test(nome) ? "o" : "a";
  return `Assim, encaminha-se o presente para apreciação d${artigo} ${nome}, solicitando-se a análise do pleito e a manifestação quanto à sua viabilidade, bem como a indicação de eventual previsão para execução do serviço.`;
};

/** Troca o parágrafo de encaminhamento que a IA escreveu (pensado para Uberlândia) pelo do órgão escolhido */
export const trocarEncerramento = (html: string, o: OrgaoCidade, cidade: string): string =>
  html.replace(/Assim, encaminha-se o presente para apreciação[^<]*?execução do serviço\./, encerramentoOrgao(o, cidade));

export function useOrgaosCidade(cidade: string) {
  const [cidades, setCidades] = useState<string[]>([CIDADE_PADRAO]);
  const [orgaos, setOrgaos] = useState<OrgaoCidade[]>([]);
  const [roteamento, setRoteamento] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("cidades").select("nome").order("nome").then(({ data, error }) => {
      if (error) { console.error("Erro ao carregar cidades:", error); return; }
      const nomes = (data || []).map((c: any) => c.nome as string).filter((n) => n !== CIDADE_PADRAO);
      setCidades([CIDADE_PADRAO, ...nomes]);
    });
  }, []);

  useEffect(() => {
    if (!cidade || cidade === CIDADE_PADRAO) { setOrgaos([]); setRoteamento({}); return; }
    let cancelado = false;
    setLoading(true);
    (async () => {
      try {
        const { data: c, error: e1 } = await supabase.from("cidades").select("id").eq("nome", cidade).maybeSingle();
        if (e1 || !c) throw e1 || new Error(`Cidade não encontrada: ${cidade}`);
        const [{ data: os, error: e2 }, { data: rs, error: e3 }] = await Promise.all([
          supabase.from("orgaos_publicos").select("*").eq("cidade_id", (c as any).id).eq("ativo", true).order("esfera").order("nome"),
          supabase.from("roteamento").select("categoria, orgao_destino_id").eq("cidade_id", (c as any).id),
        ]);
        if (e2 || e3) throw e2 || e3;
        if (cancelado) return;
        setOrgaos((os || []) as unknown as OrgaoCidade[]);
        setRoteamento(Object.fromEntries((rs || []).filter((r: any) => r.orgao_destino_id).map((r: any) => [r.categoria, r.orgao_destino_id])));
      } catch (e) {
        console.error("Erro ao carregar órgãos da cidade:", e);
        if (!cancelado) { setOrgaos([]); setRoteamento({}); }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [cidade]);

  return { cidades, orgaos, roteamento, loading };
}
