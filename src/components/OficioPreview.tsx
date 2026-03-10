import { forwardRef } from "react";
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
  secretaria?: string;
  formatOptions?: FormatOptions;
  editable?: boolean;
  onContentChange?: (newContent: string) => void;
  onAssuntoChange?: (val: string) => void;
  onDestinatarioChange?: (val: string) => void;
  onCargoDestinatarioChange?: (val: string) => void;
  onNumeroChange?: (val: string) => void;
  onDataChange?: (val: string) => void;
  dataGeracao?: string;
  initialConteudo?: string;
}

/** Strip any "Ofício GVF n° " prefix that may already be in the numero string */
function cleanNumero(raw: string): string {
  return raw.replace(/^(Ofício GVF n°\s*)+/i, "").trim();
}

/** Extract vocativo from cargo string */
function buildVocativo(cargo?: string): string {
  if (!cargo) return "Excelentíssimo(a) Senhor(a) Secretário(a),";
  const cleaned = cargo
    .replace(/^Ilmo\(a\)\.\s*Sr\(a\)\.\s*/i, "")
    .replace(/\s*Municipal\b/i, "")
    .replace(/\s*da Secretaria.*$/i, "")
    .trim();
  return `Excelentíssimo(a) Senhor(a) ${cleaned},`;
}

const OficioPreview = forwardRef<HTMLDivElement, Props>(
  ({ numero, destinatario, assunto, conteudo, bairro, logradouro, numeroEnd, cargoDestinatario, operadorNome, secretaria, formatOptions, editable, onContentChange, onAssuntoChange, onDestinatarioChange, onCargoDestinatarioChange, onNumeroChange, onDataChange, dataGeracao, initialConteudo }, ref) => {
    const fmt = formatOptions || defaultFormatOptions;
    const hoje = dataGeracao ? new Date(dataGeracao + "T12:00:00") : new Date();
    const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const dataFormatada = `Uberlândia, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;

    const editableStyle = editable ? {
      cursor: "text" as const,
      borderBottom: "1px dashed rgba(0,0,0,0.2)",
      outline: "none",
      minWidth: "40px",
      display: "inline-block",
    } : {};

    const isHtml = conteudo.startsWith("<");

    const paragraphs = isHtml ? [] : conteudo
      .split("\n")
      .map(p => p.trim())
      .filter(Boolean)
      .filter(p => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i));

    // Clean numero — remove any "Ofício GVF n°" prefix already in the string
    const numeroCleaned = cleanNumero(numero);
    const numeroFormatado = numeroCleaned
      ? (numeroCleaned.includes("/") ? numeroCleaned : `${numeroCleaned}/${hoje.getFullYear()}`)
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

    const destinatarioCompleto = `${cargoDestinatario || "Ilmo(a). Sr(a). Secretário(a) Municipal"}${destinatario && !(cargoDestinatario || "").toLowerCase().includes(destinatario.toLowerCase().substring(0, 8)) ? ` ${destinatario}` : !cargoDestinatario && destinatario ? ` ${destinatario}` : ""}`;

    const vocativo = buildVocativo(cargoDestinatario);

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

        {/* Nº de página — canto superior direito */}
        <div style={{
          position: "absolute",
          top: "30mm",
          right: "20mm",
          fontSize: "9pt",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}>1</div>

        {/* DATA — after: 240 (~16px) */}
        {editable && onDataChange ? (
          <p style={{ textAlign: "right", marginBottom: "16px", marginTop: "10px", fontSize: "11pt", lineHeight: "1.5" }}>
            <span contentEditable suppressContentEditableWarning style={editableStyle} onBlur={e => onDataChange(e.currentTarget.textContent || "")}>{dataFormatada}</span>
          </p>
        ) : (
          <p style={{ textAlign: "right", marginBottom: "16px", marginTop: "10px", fontSize: "11pt", lineHeight: "1.5" }}>{dataFormatada}</p>
        )}

        {/* OFÍCIO GVF n° — NEGRITO, after: 240 */}
        <p style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: "16px", marginTop: "0", lineHeight: "1.5" }}>
          {editable && onNumeroChange ? (
            <span contentEditable suppressContentEditableWarning style={editableStyle} onBlur={e => onNumeroChange(e.currentTarget.textContent || "")}>
              Ofício GVF n° {numeroFormatado}
            </span>
          ) : (
            <>Ofício GVF n° {numeroFormatado}</>
          )}
        </p>

        {/* DESTINATÁRIO — after: 0, "DESTINATÁRIO:" em NEGRITO */}
        <p style={{ fontSize: "11pt", marginBottom: "0", marginTop: "0", lineHeight: "1.5" }}>
          <span style={{ fontWeight: "bold" }}>DESTINATÁRIO: </span>
          {editable && onCargoDestinatarioChange ? (
            <span contentEditable suppressContentEditableWarning style={editableStyle} onBlur={e => onCargoDestinatarioChange(e.currentTarget.textContent || "")}>{destinatarioCompleto}</span>
          ) : (
            <span>{destinatarioCompleto}</span>
          )}
        </p>

        {/* ASSUNTO — after: 240, "Assunto:" em NEGRITO */}
        <p style={{ fontSize: "11pt", marginBottom: "16px", marginTop: "0", lineHeight: "1.5" }}>
          <span style={{ fontWeight: "bold" }}>Assunto: </span>
          {editable && onAssuntoChange ? (
            <span contentEditable suppressContentEditableWarning style={editableStyle} onBlur={e => onAssuntoChange(e.currentTarget.textContent || "")}>{assuntoFormatado}</span>
          ) : (
            <span>{assuntoFormatado}</span>
          )}
        </p>

        {/* VOCATIVO — ESQUERDA com recuo 1.25cm, after: 240 */}
        <p style={{ fontSize: "11pt", marginBottom: "16px", marginTop: "0", textIndent: "1.25cm", textAlign: "left", lineHeight: "1.5" }}>
          {vocativo}
        </p>

        {/* CORPO — after:0, before:0, line:1.5, justificado, recuo 1.25cm */}
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
                marginBottom: "0",
                marginTop: "0",
                fontSize: "11pt",
                lineHeight: "1.5",
              }}
                dangerouslySetInnerHTML={{ __html: p }}
              />
            ))}
          </div>
        )}

        {/* PARÁGRAFOS FINAIS FIXOS */}
        <p style={{
          textIndent: "1.25cm",
          marginBottom: "0",
          marginTop: "0",
          fontSize: "11pt",
          lineHeight: "1.5",
          textAlign: "justify",
        }}>
          {`Espero que a ${secretaria || "Secretaria"} considere favoravelmente nosso pedido e nos informe sobre a viabilidade de atendimento, bem como acerca da previsão para execução.`}
        </p>
        <p style={{
          textIndent: "1.25cm",
          marginBottom: "0",
          marginTop: "0",
          fontSize: "11pt",
          lineHeight: "1.5",
          textAlign: "justify",
        }}>
          Na certeza de contar com o vosso pronto atendimento, desde já agradeço.
        </p>

        {/* ATENCIOSAMENTE — before: 240 (16px), after: 480 (32px), recuo 1.25cm */}
        <p style={{ textIndent: "1.25cm", marginTop: "16px", marginBottom: "32px", fontSize: "11pt", lineHeight: "1.5" }}>
          Atenciosamente,
        </p>

        {/* BLOCO ASSINATURA — centralizado, line-height SIMPLES, pageBreakInside avoid */}
        <div style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          pageBreakInside: "avoid",
          breakInside: "avoid",
          lineHeight: "1.0",
        }}>
          {/* Imagem assinatura */}
          <img
            src={assinaturaFabao}
            alt="Assinatura Fabão"
            style={{
              width: "227px",
              height: "auto",
              objectFit: "contain",
              marginBottom: "0",
              display: "block",
            }}
          />
          {/* Linha da assinatura — 8cm, centralizada, 1px preto */}
          <div style={{
            width: "8cm",
            borderTop: "1px solid #000000",
            margin: "0 auto 4px auto",
            display: "block",
          }} />
          <p style={{ fontSize: "11pt", marginBottom: "0", marginTop: "0", fontWeight: "bold", lineHeight: "1.0" }}>FABÃO</p>
          <p style={{ fontSize: "11pt", marginTop: "0", marginBottom: "0", lineHeight: "1.0" }}>Vereador</p>
        </div>

        {/* RODAPÉ */}
        <div style={{
          marginTop: "80px",
          fontSize: "9pt",
          color: "#444",
          textAlign: "center",
          borderTop: "1px solid #999",
          paddingTop: "6px",
          paddingBottom: "6px",
          position: "relative",
          fontFamily: "Arial, Helvetica, sans-serif",
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
