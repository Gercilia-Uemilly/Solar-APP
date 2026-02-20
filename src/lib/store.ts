import { Demanda, Oficio, Script } from "@/types";

const DEMANDAS_KEY = "gabinete_demandas";
const OFICIOS_KEY = "gabinete_oficios";
const SCRIPTS_KEY = "gabinete_scripts";

// Sample scripts data
const defaultScripts: Script[] = [
  {
    id: "1",
    titulo: "Pedidos de ajuda - Versão 2",
    conteudo: "Poxa, eu gostaria muito de poder ajudar, mas infelizmente a lei eleitoral não me permite fazer doações de qualquer tipo 😓.\n\nMesmo que fosse possível, seria difícil atender a todos os pedidos que recebo diariamente.\nSó para você ter uma ideia, recebo cerca de 15 a 20 pedidos de ajuda todos os dias.\n\nMas olha, posso te ajudar de outras formas! 😊\nEstou aqui para ouvir o que você precisa e correr atrás de soluções com os órgãos responsáveis.",
    categoria: "Pedidos de Ajuda",
    tags: ["ajuda", "doação", "dinheiro", "lei eleitoral"],
    favorito: false,
    criadoEm: "2026-02-20",
  },
  {
    id: "2",
    titulo: "Centro de Iniciação ao Esporte (CIE)",
    conteudo: "O CIE é um espaço dedicado à iniciação e ao alto rendimento esportivo.\n\n✔️ Ginásio coberto com quadra poliesportiva\n✔️ Pista de atletismo de 100 metros\n✔️ Áreas para arremessos e saltos\n✔️ Vestiários e banheiros adaptados\n✔️ Arquibancada para 200 pessoas\n\nAs inscrições são gratuitas e devem ser feitas presencialmente no CIE.",
    categoria: "Esporte",
    tags: ["esporte", "CIE", "inscrição"],
    favorito: false,
    criadoEm: "2026-02-20",
  },
  {
    id: "3",
    titulo: "Reclamação de buraco na rua",
    conteudo: "Obrigado por nos informar sobre o problema! Vamos registrar sua demanda e encaminhá-la à Secretaria de Obras para verificação e reparo.\n\nPor favor, nos envie a localização exata (rua, número e bairro) e, se possível, uma foto do buraco para agilizar o processo.",
    categoria: "DMAE e CEMIG",
    tags: ["buraco", "rua", "obras"],
    favorito: true,
    criadoEm: "2026-02-20",
  },
  {
    id: "4",
    titulo: "Vaga em escola",
    conteudo: "Entendo sua preocupação com a vaga escolar. Vamos te ajudar!\n\nPreciso que me informe:\n📌 Nome completo da criança\n📌 Idade\n📌 Série desejada\n📌 Bairro de residência\n📌 Escolas de preferência\n\nCom essas informações, vou entrar em contato com a Secretaria de Educação para verificar a disponibilidade.",
    categoria: "Educação",
    tags: ["escola", "vaga", "educação"],
    favorito: true,
    criadoEm: "2026-02-20",
  },
];

const defaultOficios: Oficio[] = [
  { id: "1", assunto: "saude", destinatario: "saude", status: "Rascunho", criadoEm: "2026-02-20" },
  { id: "2", numero: "02/55", assunto: "saude", destinatario: "Sec. Obras", status: "Rascunho", criadoEm: "2026-02-20" },
  { id: "3", assunto: "", destinatario: "CEMIG", status: "Rascunho", criadoEm: "2026-02-20" },
  { id: "4", assunto: "vaga de escola", destinatario: "Sec. Educação", status: "Rascunho", criadoEm: "2026-02-20" },
];

function getItems<T>(key: string, defaults: T[]): T[] {
  const stored = localStorage.getItem(key);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(key, JSON.stringify(defaults));
  return defaults;
}

function setItems<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

export const store = {
  getDemandas: () => getItems<Demanda>(DEMANDAS_KEY, []),
  setDemandas: (d: Demanda[]) => setItems(DEMANDAS_KEY, d),
  addDemanda: (d: Demanda) => {
    const all = store.getDemandas();
    all.push(d);
    store.setDemandas(all);
  },
  updateDemanda: (d: Demanda) => {
    const all = store.getDemandas().map((x) => (x.id === d.id ? d : x));
    store.setDemandas(all);
  },
  deleteDemanda: (id: string) => {
    store.setDemandas(store.getDemandas().filter((x) => x.id !== id));
  },

  getOficios: () => getItems<Oficio>(OFICIOS_KEY, defaultOficios),
  setOficios: (o: Oficio[]) => setItems(OFICIOS_KEY, o),
  addOficio: (o: Oficio) => {
    const all = store.getOficios();
    all.push(o);
    store.setOficios(all);
  },
  deleteOficio: (id: string) => {
    store.setOficios(store.getOficios().filter((x) => x.id !== id));
  },

  getScripts: () => getItems<Script>(SCRIPTS_KEY, defaultScripts),
  setScripts: (s: Script[]) => setItems(SCRIPTS_KEY, s),
  addScript: (s: Script) => {
    const all = store.getScripts();
    all.push(s);
    store.setScripts(all);
  },
  deleteScript: (id: string) => {
    store.setScripts(store.getScripts().filter((x) => x.id !== id));
  },
  toggleFavorite: (id: string) => {
    const all = store.getScripts().map((x) =>
      x.id === id ? { ...x, favorito: !x.favorito } : x
    );
    store.setScripts(all);
  },
};
