import { forwardRef, useCallback, useRef } from "react";
import logoCamara from "@/assets/logo-camara-docx.jpeg";
import logoFabao from "@/assets/logo-fabao-docx.png";
import assinaturaFabaoImg from "@/assets/assinatura-fabao.png";
import type { FormatOptions } from "./PreviewFormatToolbar";
import { defaultFormatOptions } from "./PreviewFormatToolbar";

interface Props {
  numero: string;
  destinatario: string;
  assunto: string;
  conteudo: string;
  bairro?: string;
  logradouro?: string;
  numeroEnd?: string;
  cargoDestinatario?: string;
  operadorNome?: string;
  formatOptions?: FormatOptions;
  editable?: boolean;
  onContentChange?: (newContent: string) => void;
}

const OficioPreview = forwardRef<HTMLDivElement, Props>(
  ({ numero, destinatario, assunto, conteudo, bairro, logradouro, numeroEnd, cargoDestinatario, formatOptions, editable, onContentChange }, ref) => {
    const bodyRef = useRef<HTMLDivElement>(null);
    
    const fmt = formatOptions || defaultFormatOptions;
    const hoje = new Date();
    const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const dataFormatada = `Uberlândia, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;

    const paragraphs = conteudo
      .split("\n")
      .map(p => p.trim())
      .filter(Boolean)
      .filter(p => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i));

    const numeroFormatado = numero
      ? (numero.includes("/") ? numero : `${numero}/${hoje.getFullYear()}`)
      : "___";

    let assuntoFormatado = assunto || "___";
    const bairroFormatado = bairro ? `Bairro ${bairro}` : "";
    if (logradouro && numeroEnd && bairroFormatado) {
      assuntoFormatado = `${assunto} – ${logradouro}, nº ${numeroEnd} – ${bairroFormatado}`;
    } else if (logradouro && bairroFormatado) {
      assuntoFormatado = `${assunto} – ${logradouro} – ${bairroFormatado}`;
    } else if (logradouro && numeroEnd) {
      assuntoFormatado = `${assunto} – ${logradouro}, nº ${numeroEnd}`;
    } else if (logradouro) {
      assuntoFormatado = `${assunto} – ${logradouro}`;
    } else if (bairroFormatado) {
      assuntoFormatado = `${assunto} – ${bairroFormatado}`;
    }

    const cargoSaudacao = (cargoDestinatario || "Secretário(a)").replace(/^Ilmo\(a\)\.\s*Sr\(a\)\.\s*/i, "");

    const bodyStyle: React.CSSProperties = {
      fontWeight: fmt.bold ? "bold" : "normal",
      fontStyle: fmt.italic ? "italic" : "normal",
      textDecoration: fmt.underline ? "underline" : "none",
    };

    return (
      <div
        ref={ref}
        style={{
          width: "210mm",
          paddingTop: "30mm",
          paddingRight: "20mm",
          paddingBottom: "20mm",
          paddingLeft: "30mm",
          fontFamily: `${fmt.fontFamily}, Helvetica, sans-serif`,
          fontSize: `${fmt.fontSize}pt`,
          lineHeight: String(fmt.lineSpacing),
          color: "#000",
          backgroundColor: "#fff",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        {/* CABEÇALHO */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
          padding: "0 20px",
        }}>
          <img src={logoCamara} alt="Câmara Municipal de Uberlândia" style={{ height: "65px", width: "auto", objectFit: "contain" }} crossOrigin="anonymous" />
          <img src={logoFabao} alt="Vereador Fabão" style={{ height: "65px", width: "auto", objectFit: "contain" }} crossOrigin="anonymous" />
        </div>

        <p style={{ textAlign: "right", marginBottom: "24px", marginTop: "10px" }}>{dataFormatada}</p>

        <p style={{ fontWeight: "bold", fontSize: `${fmt.fontSize}pt`, marginBottom: "24px" }}>
          Ofício GVF n° {numeroFormatado}
        </p>

        <p style={{ fontWeight: "bold", fontSize: `${fmt.fontSize}pt`, marginBottom: "8px" }}>
          DESTINATÁRIO: {cargoDestinatario || "Ilmo(a). Sr(a)."} {destinatario || "___"}
        </p>

        <p style={{ fontWeight: "bold", fontSize: `${fmt.fontSize}pt`, marginBottom: "30px" }}>
          ASSUNTO: {assuntoFormatado}
        </p>

        <p style={{ fontSize: `${fmt.fontSize}pt`, marginBottom: "30px", textIndent: "1.25cm" }}>
          Excelentíssimo(a) Senhor(a) Secretário(a) Municipal,
        </p>

        {/* CORPO */}
        <div
          ref={bodyRef}
          style={{ textAlign: fmt.textAlign, cursor: editable ? "text" : undefined, outline: "none" }}
          contentEditable={editable}
          suppressContentEditableWarning
          onBlur={() => {
            if (editable && onContentChange && bodyRef.current) {
              const paragraphs = Array.from(bodyRef.current.querySelectorAll("p"))
                .map(p => p.textContent?.trim() || "")
                .filter(Boolean);
              onContentChange(paragraphs.join("\n"));
            }
          }}
        >
          {paragraphs.map((p, i) => (
            <p key={i} style={{
              textIndent: "1.25cm",
              marginBottom: "10px",
              fontSize: `${fmt.fontSize}pt`,
              lineHeight: String(fmt.lineSpacing),
              ...bodyStyle,
              outline: "none",
            }}>
              {p}
            </p>
          ))}
        </div>

        <p style={{ textIndent: "1.25cm", marginTop: "20px", fontSize: `${fmt.fontSize}pt` }}>
          Atenciosamente,
        </p>

        {/* ASSINATURA */}
        <div style={{ marginTop: "30px", textAlign: "center" }}>
          <img
            src={assinaturaFabaoImg}
            alt="Assinatura Fabão"
            style={{
              height: `${fmt.signatureHeight}px`,
              width: "auto",
              objectFit: "contain",
              marginBottom: "-10px",
              display: "inline-block",
              filter: "contrast(1.3) saturate(1.4)",
            }}
          />
          <div style={{ width: "300px", borderBottom: "1px solid #000", margin: "0 auto 8px auto" }} />
          <p style={{ fontSize: `${fmt.fontSize}pt`, marginBottom: "2px", fontWeight: "bold", letterSpacing: "1px" }}>FABÃO</p>
          <p style={{ fontSize: `${fmt.fontSize - 1}pt` }}>Vereador</p>
        </div>

        {/* RODAPÉ */}
        <div style={{
          marginTop: "30px",
          fontSize: "8pt",
          color: "#444",
          textAlign: "center",
          borderTop: "1px solid #ccc",
          paddingTop: "6px",
          paddingBottom: "6px",
        }}>
          Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG
        </div>
      </div>
    );
  }
);

OficioPreview.displayName = "OficioPreview";
export default OficioPreview;
