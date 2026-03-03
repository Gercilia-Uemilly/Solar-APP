import { forwardRef, useCallback, useRef, useEffect, useState } from "react";
import logoCamara from "@/assets/logo-camara-docx.jpeg";
import logoFabao from "@/assets/logo-fabao-docx.png";
import assinaturaFabaoImg from "@/assets/assinatura-fabao-clean.png";
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

function EditableBody({ conteudo, fmt, bodyStyle, onContentChange }: {
  conteudo: string;
  fmt: FormatOptions;
  bodyStyle: React.CSSProperties;
  onContentChange?: (newContent: string) => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const isUserEditing = useRef(false);

  // Build HTML from conteudo
  const buildHtml = (text: string) => {
    const paras = text.split("\n").map(p => p.trim()).filter(Boolean)
      .filter(p => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i));
    return paras.map(p =>
      `<p style="text-indent:1.25cm;margin-bottom:10px;font-size:${fmt.fontSize}pt;line-height:${fmt.lineSpacing}">${p}</p>`
    ).join("");
  };

  // Set initial content and update only when conteudo changes externally
  useEffect(() => {
    if (divRef.current && !isUserEditing.current) {
      divRef.current.innerHTML = buildHtml(conteudo);
    }
  }, [conteudo]);

  const syncContent = () => {
    if (divRef.current && onContentChange) {
      const paragraphs = Array.from(divRef.current.querySelectorAll("p"))
        .map(p => p.textContent?.trim() || "");
      // Also get any raw text nodes
      const text = paragraphs.filter(Boolean).join("\n") || divRef.current.innerText?.trim() || "";
      isUserEditing.current = true;
      onContentChange(text);
      // Reset flag after React re-render cycle
      requestAnimationFrame(() => { isUserEditing.current = false; });
    }
  };

  return (
    <div
      ref={divRef}
      contentEditable
      suppressContentEditableWarning
      onInput={syncContent}
      onFocus={() => { isUserEditing.current = true; }}
      onBlur={() => {
        syncContent();
        isUserEditing.current = false;
      }}
      style={{
        textAlign: fmt.textAlign,
        cursor: "text",
        outline: "none",
        minHeight: "50px",
        ...bodyStyle,
      }}
    />
  );
}

const OficioPreview = forwardRef<HTMLDivElement, Props>(
  ({ numero, destinatario, assunto, conteudo, bairro, logradouro, numeroEnd, cargoDestinatario, formatOptions, editable, onContentChange }, ref) => {
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
          Assunto: {assuntoFormatado}
        </p>

        <p style={{ fontSize: `${fmt.fontSize}pt`, marginBottom: "30px", textIndent: "1.25cm" }}>
          Excelentíssimo(a) Senhor(a) Secretário(a) Municipal,
        </p>

        {/* CORPO */}
        {editable ? (
          <EditableBody
            conteudo={conteudo}
            fmt={fmt}
            bodyStyle={bodyStyle}
            onContentChange={onContentChange}
          />
        ) : (
          <div style={{ textAlign: fmt.textAlign }}>
            {paragraphs.map((p, i) => (
              <p key={i} style={{
                textIndent: "1.25cm",
                marginBottom: "10px",
                fontSize: `${fmt.fontSize}pt`,
                lineHeight: String(fmt.lineSpacing),
                ...bodyStyle,
              }}>
                {p}
              </p>
            ))}
          </div>
        )}

        {/* Espaço antes do fechamento */}

        {/* ATENCIOSAMENTE + ASSINATURA (página 2) */}
        <p style={{ textIndent: "1.25cm", marginBottom: "30px", fontSize: `${fmt.fontSize}pt` }}>
          Atenciosamente,
        </p>

        <div style={{ marginTop: "40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <img
            src={assinaturaFabaoImg}
            alt="Assinatura Fabão"
            style={{
              height: `${fmt.signatureHeight}px`,
              width: "auto",
              objectFit: "contain",
              marginBottom: "-8px",
              display: "block",
              maxWidth: "80%",
            }}
          />
          <div style={{ width: "300px", borderBottom: "1px solid #000", marginBottom: "4px" }} />
          <p style={{ fontSize: `${fmt.fontSize}pt`, marginBottom: "0", fontWeight: "bold" }}>FABÃO</p>
          <p style={{ fontSize: `${fmt.fontSize}pt`, marginTop: "0" }}>Vereador</p>
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
