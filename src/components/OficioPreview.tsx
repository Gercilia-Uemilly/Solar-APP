import { forwardRef, useState } from "react";
import logoCamara from "@/assets/logo-camara-docx.jpeg";
import logoFabao from "@/assets/logo-fabao-docx.png";
import assinaturaFabao from "@/assets/assinatura-fabao-clean.png";
import type { FormatOptions } from "./PreviewFormatToolbar";
import { defaultFormatOptions } from "./PreviewFormatToolbar";
import OficioPreviewEditor from "./OficioPreviewEditor";

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
  initialConteudo?: string;
}

const OficioPreview = forwardRef<HTMLDivElement, Props>(
  ({ numero, destinatario, assunto, conteudo, bairro, logradouro, numeroEnd, cargoDestinatario, operadorNome, formatOptions, editable, onContentChange, initialConteudo }, ref) => {
    const fmt = formatOptions || defaultFormatOptions;
    const hoje = new Date();
    const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const dataFormatada = `Uberlândia, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;

    const assinaturaImg = assinaturaFabao;

    const isHtml = conteudo.startsWith("<");

    const paragraphs = isHtml ? [] : conteudo
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

    const operadorMarca = operadorNome ? operadorNome.split(' ')[0].toLowerCase() : '';

    const buildEditorContent = (text: string) => {
      if (text.startsWith("<")) return text;
      const paras = text.split("\n").map(p => p.trim()).filter(Boolean)
        .filter(p => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i));
      return paras.map(p => `<p>${p}</p>`).join("");
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
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "11pt",
          lineHeight: "1.5",
          color: "#000",
          backgroundColor: "#fff",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        {/* CABEÇALHO */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "24px",
          marginBottom: "0",
        }}>
          <img src={logoCamara} alt="Câmara Municipal de Uberlândia" style={{ height: "70px", width: "auto", objectFit: "contain" }} crossOrigin="anonymous" />
          <img src={logoFabao} alt="Vereador Fabão" style={{ height: "70px", width: "auto", objectFit: "contain" }} crossOrigin="anonymous" />
        </div>

        <div style={{ marginTop: "8px", marginBottom: "16px" }} />

        <p style={{ textAlign: "right", marginBottom: "1em", marginTop: "10px", fontSize: "11pt" }}>{dataFormatada}</p>

        <p style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: "16px", position: "relative" }}>
          Ofício GVF n° {numeroFormatado}
          <span style={{
            position: "absolute",
            right: 0,
            top: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            border: "1.5px solid #000",
            fontSize: "9pt",
            fontWeight: "normal",
          }}>1</span>
        </p>

        <p style={{ fontSize: "11pt", marginBottom: "0", fontWeight: "bold" }}>
          DESTINATÁRIO: {cargoDestinatario || "Ilmo(a). Sr(a). Secretário(a) Municipal"}{destinatario && !(cargoDestinatario || "").toLowerCase().includes(destinatario.toLowerCase().substring(0, 8)) ? ` ${destinatario}` : !cargoDestinatario && destinatario ? ` ${destinatario}` : ""}
        </p>

        <p style={{ fontSize: "11pt", marginBottom: "24px", fontWeight: "bold" }}>
          Assunto: {assuntoFormatado}
        </p>

        <p style={{ fontSize: "11pt", marginBottom: "30px", textIndent: "1.25cm" }}>
          {cargoDestinatario
            ? `Excelentíssimo(a) Senhor(a) ${cargoDestinatario.replace(/^Ilmo\(a\)\.\s*Sr\(a\)\.\s*/i, "").trim()},`
            : "Excelentíssimo(a) Senhor(a) Secretário(a) Municipal,"}
        </p>

        {/* CORPO */}
        {editable && onContentChange ? (
          <OficioPreviewEditor
            content={buildEditorContent(conteudo)}
            onChange={onContentChange}
          />
        ) : isHtml ? (
          <div
            style={{ textAlign: "justify", fontSize: "11pt", lineHeight: "1.5" }}
            dangerouslySetInnerHTML={{ __html: conteudo }}
          />
        ) : (
          <div style={{ textAlign: "justify" }}>
            {paragraphs.map((p, i) => (
              <p key={i} style={{
                textIndent: "1.25cm",
                marginBottom: "10px",
                fontSize: "11pt",
                lineHeight: "1.5",
              }}
                dangerouslySetInnerHTML={{ __html: p }}
              />
            ))}
          </div>
        )}

        {/* Fecho */}
        <p style={{ textIndent: "1.25cm", marginBottom: "30px", fontSize: "11pt" }}>
          Atenciosamente,
        </p>

        {/* ASSINATURA - block that should never break across pages */}
        <div style={{
          marginTop: "40px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          pageBreakInside: "avoid",
          breakInside: "avoid",
        }}>
          <img
            src={assinaturaImg}
            alt="Assinatura Fabão"
            style={{
              width: "227px",
              height: "auto",
              objectFit: "contain",
              marginBottom: "-8px",
              display: "block",
            }}
          />
          <div style={{ width: "200px", borderBottom: "1px solid #000", marginBottom: "4px" }} />
          <p style={{ fontSize: "11pt", marginBottom: "0", fontWeight: "bold" }}>FABÃO</p>
          <p style={{ fontSize: "11pt", marginTop: "0", marginBottom: "0" }}>Vereador</p>
        </div>

        {/* RODAPÉ */}
        <div style={{
          marginTop: "30px",
          fontSize: "8pt",
          color: "#444",
          textAlign: "center",
          borderTop: "none",
          paddingTop: "6px",
          paddingBottom: "6px",
          position: "relative",
        }}>
          Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG
          {operadorMarca && (
            <span style={{
              position: "absolute",
              right: 0,
              bottom: "2px",
              fontSize: "6pt",
              color: "rgba(200, 200, 200, 0.3)",
              userSelect: "none",
              pointerEvents: "none",
            }}>
              {operadorMarca}
            </span>
          )}
        </div>
      </div>
    );
  }
);

OficioPreview.displayName = "OficioPreview";
export default OficioPreview;
