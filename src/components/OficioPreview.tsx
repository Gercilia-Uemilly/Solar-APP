import { forwardRef } from "react";
import logoCamara from "@/assets/logo-camara.png";
import logoFabao from "@/assets/logo-fabao.png";

interface Props {
  numero: string;
  destinatario: string;
  assunto: string;
  conteudo: string;
}

const OficioPreview = forwardRef<HTMLDivElement, Props>(({ numero, destinatario, assunto, conteudo }, ref) => {
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

  // Split content into paragraphs
  const paragraphs = conteudo
    .split("\n")
    .map(p => p.trim())
    .filter(Boolean);

  return (
    <div
      ref={ref}
      className="bg-white text-black mx-auto shadow-lg"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "20mm 25mm 25mm 25mm",
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: "12pt",
        lineHeight: "1.5",
        position: "relative",
      }}
    >
      {/* Header: logos side by side */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "40px", marginBottom: "12px" }}>
        <img src={logoCamara} alt="Câmara Municipal de Uberlândia" style={{ height: "70px", objectFit: "contain" }} />
        <img src={logoFabao} alt="Vereador Fabão" style={{ height: "70px", objectFit: "contain" }} />
      </div>

      {/* Separator */}
      <hr style={{ border: "none", borderTop: "2px solid #000", margin: "8px 0 20px 0" }} />

      {/* Date - right aligned */}
      <p style={{ textAlign: "right", marginBottom: "16px" }}>
        Uberlândia, {hoje}.
      </p>

      {/* Numbering */}
      <p style={{ marginBottom: "24px", fontWeight: "bold" }}>
        Ofício GVF n° {numero || "___"}/2026
      </p>

      {/* Destinatário */}
      <p style={{ marginBottom: "4px" }}>
        <strong>DESTINATÁRIO:</strong> Ilmo(a). Sr(a). {destinatario || "___"}
      </p>

      {/* Assunto */}
      <p style={{ marginBottom: "24px" }}>
        <strong>ASSUNTO:</strong> {assunto || "___"}
      </p>

      {/* Greeting */}
      <p style={{ marginBottom: "16px" }}>
        Excelentíssimo(a) Senhor(a),
      </p>

      {/* Body - justified with first-line indent */}
      <div style={{ textAlign: "justify" }}>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ textIndent: "1.25cm", marginBottom: "12px" }}>
            {p}
          </p>
        ))}
      </div>

      {/* Closing */}
      <p style={{ textIndent: "1.25cm", marginTop: "24px", marginBottom: "40px", textAlign: "justify" }}>
        Na certeza de contar com o vosso pronto atendimento, desde já agradeço.
      </p>

      {/* Signature - centered */}
      <div style={{ textAlign: "center", marginTop: "48px" }}>
        <p style={{ marginBottom: "4px" }}>____________________________</p>
        <p style={{ fontWeight: "bold" }}>FABÃO</p>
        <p>Vereador</p>
      </div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: "15mm",
          left: "25mm",
          right: "25mm",
          borderTop: "1px solid #999",
          paddingTop: "8px",
          fontSize: "8pt",
          textAlign: "center",
          color: "#666",
        }}
      >
        Gabinete Vereador Fabão – Câmara Municipal de Uberlândia – Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, Bairro Santa Mônica, CEP: 38408-144, Uberlândia-MG
      </div>
    </div>
  );
});

OficioPreview.displayName = "OficioPreview";
export default OficioPreview;
