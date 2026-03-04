export type DemandaTipo = "Solicitação" | "Reclamação" | "Denúncia" | "Sugestão" | "Informação" | "Outro";
export type DemandaStatus = "Pendente" | "Em Andamento" | "Concluída" | "Cancelada";
export type DemandaPrioridade = "Normal" | "Urgente";
export type DemandaOrigem = "WhatsApp Gabinete" | "WhatsApp Vereador" | "Requerimento" | "E-mail" | "Atendimento presencial" | "Outro";

export interface DemandaAnexo {
  id: string;
  nome: string;
  tipo: string; // mime type
  tamanho: number;
  url?: string; // storage URL after upload
  file?: File; // local file before upload
}

export interface Demanda {
  id: string;
  titulo: string;
  descricao: string;
  conteudo_html?: string;
  tipo: DemandaTipo;
  status: DemandaStatus;
  prioridade: DemandaPrioridade;
  solicitante: string;
  telefone_solicitante?: string;
  bairro?: string;
  secretaria?: string;
  origem?: DemandaOrigem;
  anexos?: DemandaAnexo[];
  criadoEm: string;
  atualizadoEm: string;
}

export type OficioStatus = "Rascunho" | "Gerado" | "Assinado" | "Enviado" | "Respondido" | "Arquivado";

export interface Oficio {
  id: string;
  numero?: string;
  assunto: string;
  destinatario: string;
  status: OficioStatus;
  criadoEm: string;
  conteudo?: string;
}

export interface Script {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string;
  tags: string[];
  favorito: boolean;
  criadoEm: string;
}
