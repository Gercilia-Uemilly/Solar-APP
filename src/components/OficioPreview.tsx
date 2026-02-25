import { forwardRef } from "react";
import logoCamara from "@/assets/logo-camara.png";
import logoFabao from "@/assets/logo-fabao.png";

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
      {/* Header: logos side by side, centered – NO separator line */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "24px", marginBottom: "20px", position: "relative", zIndex: 1 }}>
        <img src={logoCamara} alt="Câmara Municipal de Uberlândia" style={{ height: "auto", width: "auto", maxHeight: "70px", display: "block" }} />
        <img src={logoFabao} alt="Vereador Fabão" style={{ height: "auto", width: "auto", maxHeight: "45px", display: "block" }} />
      </div>

      {/* Date - right aligned */}
      <p style={{ textAlign: "right", marginBottom: "16px", fontSize: "12pt" }}>
        {dataFormatada}
      </p>

      {/* Numbering - bold */}
      <p style={{ marginBottom: "24px", fontWeight: "bold", fontSize: "12pt" }}>
        Ofício GVF n° {numero || "___"}{!numero?.includes("/") ? `/${hoje.getFullYear()}` : ""}
      </p>

      {/* Destinatário - bold label */}
      <p style={{ marginBottom: "4px", fontSize: "12pt", fontWeight: "bold" }}>
        DESTINATÁRIO: {cargoDestinatario || "Ilmo. Sr."} {destinatario || "___"}
      </p>

      {/* Assunto - bold label + bold content */}
      <p style={{ marginBottom: "24px", fontSize: "12pt", fontWeight: "bold" }}>
        ASSUNTO: {assunto || "___"}
      </p>

      {/* Greeting */}
      <p style={{ marginBottom: "16px", fontSize: "12pt" }}>
        Excelentíssimo Senhor Secretário,
      </p>

      {/* Body - justified with first-line indent of 1.25cm */}
      <div style={{ textAlign: "justify", position: "relative", zIndex: 1 }}>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ textIndent: "1.25cm", marginBottom: "10px", fontSize: "12pt" }}>
            {p}
          </p>
        ))}
      </div>

      {/* Closing - Atenciosamente */}
      <p style={{ textIndent: "1.25cm", marginTop: "16px", marginBottom: "32px", fontSize: "12pt" }}>
        Atenciosamente,
      </p>

      {/* Digital Signature block - matching official PDF */}
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

      {/* Footer - italic, NO top border */}
      <div
        style={{
          position: "absolute",
          bottom: "15mm",
          left: "30mm",
          right: "30mm",
          fontSize: "8pt",
          color: "#333",
          fontStyle: "italic",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG</span>
        <span style={{ display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>
          {multiPage && <span>Pág. 1</span>}
          {operadorNome && (
            <span style={{ fontSize: "5pt", color: "rgba(0,0,0,0.05)", fontFamily: "'Times New Roman', Times, serif" }}>
              {operadorNome}
            </span>
          )}
        </span>
      </div>
    </div>
  );
});

OficioPreview.displayName = "OficioPreview";
export default OficioPreview;