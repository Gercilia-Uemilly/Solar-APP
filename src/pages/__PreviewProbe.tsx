import OficioPreview from "@/components/OficioPreview";

const LONGO = Array.from({ length: 6 })
  .map(
    (_, i) =>
      `<p>Parágrafo ${i + 1}: Os moradores relatam que a via apresenta buracos de grandes proporções, com acúmulo de água e risco constante de acidentes, situação já comunicada anteriormente ao órgão competente sem qualquer providência efetiva até o presente momento, o que tem gerado prejuízos materiais aos veículos e insegurança aos pedestres que utilizam diariamente o local para deslocamento. Diante disso, solicita-se a adoção das medidas cabíveis para a completa recuperação do pavimento asfáltico do trecho indicado, bem como a realização de vistoria técnica no local.</p>`
  )
  .join("");

export default function PreviewProbe() {
  return (
    <div style={{ padding: 20 }}>
      <OficioPreview
        numero="1234/2026"
        destinatario="Secretário Municipal de Obras"
        assunto="Recuperação de pavimento asfáltico"
        conteudo={LONGO}
        dataGeracao="2026-08-06"
      />
    </div>
  );
}
