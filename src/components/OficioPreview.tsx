import { forwardRef } from "react";
import logoCamara from "@/assets/logo-camara.png";
import logoFabao from "@/assets/logo-fabao.png";

interface Props {
  numero: string;
  destinatario: string;
  assunto: string;
  conteudo: string;
  cargoDestinatario?: string;
}

const OficioPreview = forwardRef<HTMLDivElement, Props>(({ numero, destinatario, assunto, conteudo, cargoDestinatario }, ref) => {
  const hoje = new Date();
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const dataFormatada = `Uberlândia, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;

  const paragraphs = conteudo
    .split("\n")
    .map(p => p.trim())
    .filter(Boolean);

  // Estimate if content spans multiple pages (rough heuristic)
  const multiPage = paragraphs.length > 12 || conteudo.length > 2000;

  return (
    <div
      ref={ref}
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "20mm 30mm 30mm 30mm",
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: "12pt",
        lineHeight: "1.8",
        color: "#000",
        backgroundColor: "#fff",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {/* Header: logos side by side, centered */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "48px", marginBottom: "8px" }}>
        <img src={logoCamara} alt="Câmara Municipal de Uberlândia" style={{ height: "64px", objectFit: "contain" }} />
        <img src={logoFabao} alt="Vereador Fabão" style={{ height: "64px", objectFit: "contain" }} />
      </div>

      {/* Separator - thin black line */}
      <hr style={{ border: "none", borderTop: "1px solid #000", margin: "8px 0 24px 0" }} />

      {/* Date - right aligned */}
      <p style={{ textAlign: "right", marginBottom: "8px", fontSize: "12pt" }}>
        {dataFormatada}
      </p>

      {/* Numbering */}
      <p style={{ marginBottom: "24px", fontWeight: "bold", fontSize: "12pt" }}>
        Ofício GVF n° {numero || "___"}/2026
      </p>

      {/* Destinatário */}
      <p style={{ marginBottom: "4px", fontSize: "12pt" }}>
        <strong>DESTINATÁRIO:</strong> {cargoDestinatario || "Ilmo(a). Sr(a)."} {destinatario || "___"}
      </p>

      {/* Assunto */}
      <p style={{ marginBottom: "24px", fontSize: "12pt" }}>
        <strong>ASSUNTO:</strong> {assunto || "___"}
      </p>

      {/* Greeting */}
      <p style={{ marginBottom: "16px", fontSize: "12pt" }}>
        Excelentíssimo(a) Senhor(a),
      </p>

      {/* Body - justified with first-line indent of 1.25cm */}
      <div style={{ textAlign: "justify" }}>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ textIndent: "1.25cm", marginBottom: "10px", fontSize: "12pt" }}>
            {p}
          </p>
        ))}
      </div>

      {/* Closing */}
      <p style={{ textIndent: "1.25cm", marginTop: "24px", marginBottom: "48px", textAlign: "justify", fontSize: "12pt" }}>
        Na certeza de contar com o vosso pronto atendimento, desde já agradeço.
      </p>

      {/* Signature - centered */}
      <div style={{ textAlign: "center", marginTop: "48px" }}>
        <p style={{ marginBottom: "4px", fontSize: "12pt" }}>____________________________</p>
        <p style={{ fontWeight: "bold", fontSize: "12pt" }}>FABÃO</p>
        <p style={{ fontSize: "12pt" }}>Vereador</p>
      </div>

      {/* Footer with address and optional page number */}
      <div
        style={{
          position: "absolute",
          bottom: "15mm",
          left: "30mm",
          right: "30mm",
          borderTop: "1px solid #000",
          paddingTop: "6px",
          fontSize: "8pt",
          color: "#333",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Gabinete Vereador Fabão – Câmara Municipal de Uberlândia – Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, Bairro Santa Mônica, CEP: 38408-144, Uberlândia-MG</span>
        {multiPage && <span style={{ marginLeft: "16px", whiteSpace: "nowrap" }}>Pág. 1</span>}
      </div>
    </div>
  );
});

OficioPreview.displayName = "OficioPreview";
export default OficioPreview;
