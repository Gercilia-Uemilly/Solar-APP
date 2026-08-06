import OficioPreview from "@/components/OficioPreview";

const frase = (i: number) =>
  `Trecho ${i} do relato dos moradores sobre a via com buracos, acúmulo de água e risco de acidentes no bairro indicado, conforme registros enviados ao gabinete. Diante disso, solicita-se providências imediatas do órgão competente.`;

const cenarios: Record<string, string> = {
  // parágrafo único gigante
  a: `<p>${Array.from({ length: 90 }).map((_, i) => frase(i + 1)).join(" ")}</p>`,
  // texto corrido sem pontuação (pior caso)
  b: `<p>${Array.from({ length: 900 }).map((_, i) => `palavra${i}`).join(" ")}</p>`,
  // muitos parágrafos médios + negrito e lista
  c: Array.from({ length: 30 })
    .map((_, i) => `<p><strong>Item ${i + 1}:</strong> ${frase(i + 1)}</p>`)
    .join("") + `<ul>${Array.from({ length: 20 }).map((_, i) => `<li>Ponto ${i + 1} da vistoria solicitada pelos moradores da região.</li>`).join("")}</ul>`,
};

export default function PreviewProbe() {
  const key = new URLSearchParams(window.location.search).get("c") || "a";
  return (
    <div style={{ padding: 20 }}>
      <OficioPreview
        numero="1234/2026"
        destinatario="Secretário Municipal de Obras"
        assunto="Recuperação de pavimento asfáltico"
        conteudo={cenarios[key] || cenarios.a}
        dataGeracao="2026-08-06"
      />
    </div>
  );
}
