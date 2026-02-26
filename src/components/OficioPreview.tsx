import { forwardRef } from "react";
import logoCamara from "@/assets/logo-camara-docx.jpeg";
import logoFabao from "@/assets/logo-fabao-docx.png";
import assinaturaFabaoImg from "@/assets/assinatura-fabao.png";

interface Props {
  numero: string;
  destinatario: string;
  assunto: string;
  conteudo: string;
  bairro?: string;
  cargoDestinatario?: string;
  operadorNome?: string;
}

const OficioPreview = forwardRef<HTMLDivElement, Props>(
  ({ numero, destinatario, assunto, conteudo, bairro, cargoDestinatario }, ref) => {
    const hoje = new Date();
    const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const dataFormatada = `Uberlândia, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;

    const paragraphs = conteudo
      .split("\n")
      .map(p => p.trim())
      .filter(Boolean);

    const numeroFormatado = numero
      ? (numero.includes("/") ? numero : `${numero}/${hoje.getFullYear()}`)
      : "___";

    return (
      <div
        ref={ref}
        style={{
          width: "210mm",
          minHeight: "297mm",
          paddingTop: "11mm",
          paddingRight: "17mm",
          paddingBottom: "15mm",
          paddingLeft: "22mm",
          fontFamily: "'Times New Roman', Times, serif",
          fontSize: "12pt",
          lineHeight: "1.5",
          color: "#000",
          backgroundColor: "#fff",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        {/* CABEÇALHO: logos alinhadas igual ao original */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "14px",
        }}>
          <img
            src={logoCamara}
            alt="Câmara Municipal de Uberlândia"
            style={{ height: "65px", width: "auto", objectFit: "contain" }}
            crossOrigin="anonymous"
          />
          <img
            src={logoFabao}
            alt="Vereador Fabão"
            style={{ height: "65px", width: "auto", objectFit: "contain" }}
            crossOrigin="anonymous"
          />
        </div>

        {/* DATA - alinhada à direita */}
        <p style={{ textAlign: "right", marginBottom: "20px", marginTop: "10px" }}>
          {dataFormatada}
        </p>

        {/* NÚMERO */}
        <p style={{ fontWeight: "bold", fontSize: "12pt", marginBottom: "16px" }}>
          Ofício GVF n° {numeroFormatado}
        </p>

        {/* DESTINATÁRIO */}
        <p style={{ fontWeight: "bold", fontSize: "12pt", marginBottom: "6px" }}>
          DESTINATÁRIO: {cargoDestinatario || "Ilmo(a). Sr(a)."} {destinatario || "___"}
        </p>

        {/* ASSUNTO */}
        <p style={{ fontWeight: "bold", fontSize: "12pt", marginBottom: "4px" }}>
          ASSUNTO: {assunto || "___"}
        </p>

        {/* BAIRRO (linha abaixo do assunto, recuada) */}
        {bairro && (
          <p style={{ fontWeight: "bold", fontSize: "12pt", marginBottom: "20px", marginLeft: "80px" }}>
            {bairro}
          </p>
        )}

        {/* CORPO */}
        <div style={{ textAlign: "justify", marginTop: bairro ? "0" : "20px" }}>
          {paragraphs.map((p, i) => (
            <p key={i} style={{
              textIndent: "1.25cm",
              marginBottom: "10px",
              fontSize: "12pt",
              lineHeight: "1.5",
            }}>
              {p}
            </p>
          ))}
        </div>

        {/* ASSINATURA DIGITAL */}
        <div style={{ marginTop: "50px", display: "flex", justifyContent: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "flex-start", gap: "0" }}>
            {/* Nome certificado - lado esquerdo */}
            <div style={{
              fontSize: "10pt",
              textAlign: "left",
              color: "#000",
              paddingRight: "14px",
              lineHeight: "1.4",
              minWidth: "130px",
            }}>
              <div>FABIO DIAS</div>
              <div>ZAVITOSKI:275000</div>
              <div>05 806</div>
            </div>
            {/* Dados digitais - lado direito com borda esquerda */}
            <div style={{
              fontSize: "9pt",
              textAlign: "left",
              color: "#000",
              borderLeft: "1px solid #666",
              paddingLeft: "14px",
              lineHeight: "1.5",
              backgroundColor: "#FFD8D8",
              padding: "4px 10px",
            }}>
              <div>Assinado de forma digital</div>
              <div>por FABIO DIAS QUEIROZ</div>
              <div>ZAVITOSKI:27500005806</div>
              <div><em>Dados:</em> {hoje.getFullYear()}.{String(hoje.getMonth()+1).padStart(2,"0")}.{String(hoje.getDate()).padStart(2,"0")} {String(hoje.getHours()).padStart(2,"0")}:{String(hoje.getMinutes()).padStart(2,"0")}:{String(hoje.getSeconds()).padStart(2,"0")}</div>
              <div>-03'00'</div>
            </div>
          </div>
        </div>

        {/* Linha + FABÃO + Vereador */}
        <div style={{ textAlign: "center", marginTop: "10px" }}>
          <div style={{ width: "280px", borderBottom: "1px solid #000", margin: "0 auto 10px auto" }} />
          <p style={{ fontSize: "12pt", marginBottom: "2px", fontWeight: "bold" }}>FABÃO</p>
          <p style={{ fontSize: "12pt" }}>Vereador</p>
        </div>

        {/* RODAPÉ */}
        <div style={{
          position: "absolute",
          bottom: "8mm",
          left: "22mm",
          right: "17mm",
          fontSize: "8pt",
          color: "#444",
          textAlign: "center",
          borderTop: "1px solid #ccc",
          paddingTop: "4px",
        }}>
          Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG
        </div>
      </div>
    );
  }
);

OficioPreview.displayName = "OficioPreview";
export default OficioPreview;