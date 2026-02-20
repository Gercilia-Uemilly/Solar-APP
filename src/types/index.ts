export type DemandaTipo = "Solicitação" | "Reclamação" | "Denúncia" | "Sugestão" | "Informação" | "Outro";
export type DemandaStatus = "Pendente" | "Em Andamento" | "Concluída" | "Cancelada";
export type DemandaPrioridade = "Normal" | "Urgente";

export interface Demanda {
  id: string;
  titulo: string;
  descricao: string;
  tipo: DemandaTipo;
  status: DemandaStatus;
  prioridade: DemandaPrioridade;
  solicitante: string;
  bairro?: string;
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
