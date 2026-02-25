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

  const pageStyle: React.CSSProperties = {
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
  };

  const headerBlock = (
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
  );

  const footerBlock = (pageNum: number) => (
    <div
      style={{
        position: "absolute",
        bottom: "10mm",
        left: "30mm",
        right: "20mm",
        fontSize: "8pt",
        color: "#333",
        fontStyle: "italic",
        textAlign: "center",
      }}
    >
      <div>Pág. {pageNum}</div>
    </div>
  );

  return (
    <div ref={ref}>
      {/* PAGE 1 - Main content */}
      <div style={pageStyle}>
        {headerBlock}

        {/* Date - right aligned */}
        <p style={{ textAlign: "right", marginBottom: "24px", fontSize: "12pt" }}>
          {dataFormatada}
        </p>

        {/* Number - left, bold */}
        <p style={{ marginBottom: "20px", fontWeight: "bold", fontSize: "12pt" }}>
          Ofício GVF n° {numero || "___"}{!numero?.includes("/") ? `/${hoje.getFullYear()}` : ""}
        </p>

        {/* Destinatário */}
        <p style={{ marginBottom: "4px", fontSize: "12pt", fontWeight: "bold" }}>
          DESTINATÁRIO: {cargoDestinatario || "Ilmo. Sr."} {destinatario || "___"}
        </p>

        {/* Assunto */}
        <p style={{ marginBottom: "24px", fontSize: "12pt", fontWeight: "bold" }}>
          ASSUNTO: {assunto || "___"}
        </p>

        {/* Greeting */}
        <p style={{ marginBottom: "16px", fontSize: "12pt" }}>
          Excelentíssimo Senhor Secretário,
        </p>

        {/* Body - justified, first-line indent, 1.5 line spacing */}
        <div style={{ textAlign: "justify" }}>
          {paragraphs.map((p, i) => (
            <p key={i} style={{ textIndent: "1.25cm", marginBottom: "10px", fontSize: "12pt", lineHeight: "1.5" }}>
              {p}
            </p>
          ))}
        </div>

        {/* Closing */}
        <p style={{ textIndent: "1.25cm", marginTop: "16px", marginBottom: "32px", fontSize: "12pt" }}>
          Atenciosamente,
        </p>

        {/* Digital Signature block */}
        <div style={{ textAlign: "center", marginTop: "32px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <span style={{ fontSize: "9pt", fontFamily: "'Courier New', monospace", lineHeight: "1.3" }}>
              FABIO DIAS QUEIROZ<br />ZAVITOSKI:27500005<br />806
            </span>
            <div style={{ border: "1px solid #999", padding: "4px 6px", fontSize: "7pt", fontFamily: "'Courier New', monospace", lineHeight: "1.3", textAlign: "left", color: "#333" }}>
              Assinado de forma digital<br />
              por FABIO DIAS QUEIROZ<br />
              ZAVITOSKI:27500005806<br />
              Dados: {new Date().toISOString().split("T")[0].replace(/-/g, ".")} {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}<br />
              -03'00'
            </div>
          </div>
          <p style={{ fontWeight: "bold", fontSize: "12pt", marginBottom: "4px" }}>FABÃO</p>
          <p style={{ fontSize: "12pt" }}>Vereador</p>
        </div>

        {footerBlock(1)}
      </div>

      {/* PAGE 2 - Final institutional page */}
      <div style={{ ...pageStyle, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", pageBreakBefore: "always" }}>
        {headerBlock}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", width: "100%" }}>
          <p style={{ fontWeight: "bold", fontSize: "14pt", marginBottom: "4px" }}>FABÃO</p>
          <p style={{ fontSize: "12pt", marginBottom: "32px" }}>Vereador</p>
          <p style={{ fontSize: "9pt", color: "#333", fontStyle: "italic", maxWidth: "80%" }}>
            Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia - MG
          </p>
        </div>

        {footerBlock(2)}
      </div>
    </div>
  );
});

OficioPreview.displayName = "OficioPreview";
export default OficioPreview;
