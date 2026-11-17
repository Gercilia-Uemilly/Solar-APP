/**
 * Em Uberlândia o operador precisa escolher a secretaria antes de gerar ou salvar o ofício.
 * Sem isso, a IA adivinhava pelas palavras da demanda e caía em "Serviços Urbanos" (ex.: ofício 2268).
 * Em outras cidades o órgão continua opcional (a IA sugere pelo assunto).
 */
export function faltaSecretaria(outraCidade: boolean, secretaria: string | null | undefined): boolean {
  if (outraCidade) return false;
  return !(secretaria || "").trim();
}

export const AVISO_SECRETARIA = {
  title: "Selecione a secretaria",
  description: "Escolha a secretaria na aba Dados antes de continuar.",
};
