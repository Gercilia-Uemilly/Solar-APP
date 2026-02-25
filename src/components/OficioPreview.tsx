import { forwardRef } from "react";
import oficioHeaderOficial from "@/assets/oficio-header-oficial.png";

interface Props {
  numero: string;
  destinatario: string;
  assunto: string;
  conteudo: string;
  cargoDestinatario?: string;
  operadorNome?: string;
}

const OficioPreview = forwardRef<HTMLDivElement, Props>(({ numero, destinatario, assunto, conteudo, cargoDestinatario, operadorNome }, ref) => {
  const hoje = new Date();
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const dataFormatada = `Uberlândia, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;

  const paragraphs = conteudo
    .split("\n")
    .map(p => p.trim())
    .filter(Boolean);

  return (
    <div
      ref={ref}
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "30mm 20mm 20mm 30mm",
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: "12pt",
        lineHeight: "1.5",
        color: "#000",
        backgroundColor: "#fff",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {/* Header oficial - centered, compact, original proportions */}
      <div style={{ textAlign: "center", marginBottom: "16px" }}>
        <img
          src={oficioHeaderOficial}
          alt="Cabeçalho oficial do Gabinete"
          style={{
            display: "inline-block",
            width: "500px",
            maxWidth: "100%",
            height: "auto",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Date - right aligned */}
      <p style={{ textAlign: "right", marginBottom: "24px", fontSize: "12pt" }}>
        {dataFormatada}
      </p>

      {/* Number - left, bold */}
      <p style={{ marginBottom: "20px", fontWeight: "bold", fontSize: "12pt" }}>
        Ofício GVF n° {numero || "___"}{!numero?.includes("/") ? `/${hoje.getFullYear()}` : ""}
      </p>

      {/* Destinatário - bold */}
      <p style={{ marginBottom: "4px", fontSize: "12pt", fontWeight: "bold" }}>
        DESTINATÁRIO: {cargoDestinatario || "Ilmo(a). Sr(a)."} {destinatario || "___"}
      </p>

      {/* Assunto - bold */}
      <p style={{ marginBottom: "24px", fontSize: "12pt", fontWeight: "bold" }}>
        ASSUNTO: {assunto || "___"}
      </p>

      {/* Greeting */}
      <p style={{ marginBottom: "16px", fontSize: "12pt" }}>
        Excelentíssimo(a) Senhor(a) Secretário(a),
      </p>

      {/* Body - justified, first-line indent 1.25cm, 1.5 line spacing */}
      <div style={{ textAlign: "justify" }}>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ textIndent: "1.25cm", marginBottom: "10px", fontSize: "12pt", lineHeight: "1.5" }}>
            {p}
          </p>
        ))}
      </div>

      {/* Closing */}
      <p style={{ textIndent: "1.25cm", marginTop: "16px", marginBottom: "8px", fontSize: "12pt" }}>
        Na certeza de contar com o vosso pronto atendimento, desde já agradeço.
      </p>

      {/* Atenciosamente */}
      <p style={{ textIndent: "1.25cm", marginBottom: "48px", fontSize: "12pt" }}>
        Atenciosamente,
      </p>

      {/* Signature - simple line + name + title (matching official PDF) */}
      <div style={{ textAlign: "center", marginTop: "24px" }}>
        <div style={{ width: "240px", borderBottom: "1px solid #000", margin: "0 auto 12px auto" }} />
        <p style={{ fontWeight: "bold", fontSize: "12pt", marginBottom: "2px" }}>FABÃO</p>
        <p style={{ fontSize: "12pt" }}>Vereador</p>
      </div>

      {/* Footer - address centered at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: "10mm",
          left: "30mm",
          right: "20mm",
          fontSize: "8pt",
          color: "#333",
          textAlign: "center",
        }}
      >
        <span>Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG</span>
      </div>
    </div>
  );
});

OficioPreview.displayName = "OficioPreview";
export default OficioPreview;
