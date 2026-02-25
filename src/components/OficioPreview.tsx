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
      {/* Header oficial */}
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

      {/* Body - justified, first-line indent 1.25cm, 1.5 line spacing */}
      <div style={{ textAlign: "justify" }}>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ textIndent: "1.25cm", marginBottom: "10px", fontSize: "12pt", lineHeight: "1.5" }}>
            {p}
          </p>
        ))}
      </div>

      {/* Digital signature block - matching official template */}
      <div style={{ textAlign: "center", marginTop: "40px" }}>
        {/* Certificate text block side by side */}
        <div style={{
          display: "inline-flex",
          alignItems: "flex-start",
          gap: "0",
          marginBottom: "4px",
        }}>
          <div style={{
            fontSize: "11pt",
            textAlign: "left",
            color: "#000",
            paddingRight: "12px",
            lineHeight: "1.4",
          }}>
            <div>FABIO DIAS</div>
            <div>ZAVITOSKI:275000</div>
            <div>05 806</div>
          </div>
          <div style={{
            fontSize: "9pt",
            textAlign: "left",
            color: "#000",
            borderLeft: "1px solid #999",
            paddingLeft: "12px",
            lineHeight: "1.4",
          }}>
            <div>Assinado de forma digital</div>
            <div>por FABIO DIAS QUEIROZ</div>
            <div>ZAVITOSKI:27500005806</div>
            <div><em>Dados:</em> {hoje.getFullYear()}.{String(hoje.getMonth() + 1).padStart(2, '0')}.{String(hoje.getDate()).padStart(2, '0')} {String(hoje.getHours()).padStart(2, '0')}:{String(hoje.getMinutes()).padStart(2, '0')}:{String(hoje.getSeconds()).padStart(2, '0')}</div>
            <div>-03'00'</div>
          </div>
        </div>

        {/* Signature line */}
        <div style={{ width: "280px", borderBottom: "1px solid #000", margin: "8px auto 12px auto" }} />
        <p style={{ fontSize: "12pt", marginBottom: "2px" }}>FABÃO</p>
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
