import { forwardRef, useCallback, useRef, useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import logoCamara from "@/assets/logo-camara-docx.jpeg";
import logoFabao from "@/assets/logo-fabao-docx.png";
import assinaturaFabao1 from "@/assets/assinatura-fabao-clean.png";
import assinaturaFabao2 from "@/assets/assinatura-fabao.png";
import type { FormatOptions } from "./PreviewFormatToolbar";
import { defaultFormatOptions } from "./PreviewFormatToolbar";

const SIGNATURES = [assinaturaFabao1, assinaturaFabao2];

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

function EditableBody({ conteudo, fmt, onContentChange, initialConteudo }: {
  conteudo: string;
  fmt: FormatOptions;
  onContentChange?: (newContent: string) => void;
  initialConteudo: string;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const isUserEditing = useRef(false);

  const isHtml = (text: string) => text.startsWith("<");

  const buildHtml = (text: string) => {
    if (isHtml(text)) return text;
    const paras = text.split("\n").map(p => p.trim()).filter(Boolean)
      .filter(p => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i));
    return paras.map(p =>
      `<p style="text-indent:1.25cm;margin-bottom:10px;font-size:11pt;line-height:1.5">${p}</p>`
    ).join("");
  };

  useEffect(() => {
    if (divRef.current && !isUserEditing.current) {
      divRef.current.innerHTML = buildHtml(conteudo);
    }
  }, [conteudo]);

  const syncContent = () => {
    if (divRef.current && onContentChange) {
      const html = divRef.current.innerHTML;
      isUserEditing.current = true;
      onContentChange(html);
      requestAnimationFrame(() => { isUserEditing.current = false; });
    }
  };

  const handleUndo = () => {
    if (onContentChange) {
      isUserEditing.current = false;
      onContentChange(initialConteudo);
      if (divRef.current) {
        divRef.current.innerHTML = buildHtml(initialConteudo);
      }
    }
  };

  const hasChanges = conteudo !== initialConteudo;

  return (
    <div>
      {hasChanges && (
        <div className="flex justify-end mb-2 print:hidden">
          <button
            onClick={handleUndo}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            title="Desfazer todas as edições"
          >
            <Undo2 size={12} /> Desfazer edições
          </button>
        </div>
      )}
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
          textAlign: "justify",
          cursor: "text",
          outline: "none",
          minHeight: "50px",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "11pt",
          lineHeight: "1.5",
          color: "#000",
        }}
      />
    </div>
  );
}

const OficioPreview = forwardRef<HTMLDivElement, Props>(
  ({ numero, destinatario, assunto, conteudo, bairro, logradouro, numeroEnd, cargoDestinatario, operadorNome, formatOptions, editable, onContentChange, initialConteudo }, ref) => {
    const fmt = formatOptions || defaultFormatOptions;
    const hoje = new Date();
    const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const dataFormatada = `Uberlândia, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;

    // Random signature (stable per render cycle)
    const [signatureIdx] = useState(() => Math.floor(Math.random() * SIGNATURES.length));
    const assinaturaImg = SIGNATURES[signatureIdx];

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

    // Operator watermark
    const operadorMarca = operadorNome ? operadorNome.split(' ')[0].toLowerCase() : '';

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
        {/* CABEÇALHO - logos centralizados */}
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

        {/* Linha separadora fina */}
        <div style={{ borderBottom: "1px solid #000", marginTop: "8px", marginBottom: "16px" }} />

        {/* Data alinhada à direita */}
        <p style={{ textAlign: "right", marginBottom: "24px", marginTop: "10px", fontSize: "11pt" }}>{dataFormatada}</p>

        <p style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: "24px" }}>
          Ofício GVF n° {numeroFormatado}
        </p>

        <p style={{ fontSize: "11pt", marginBottom: "8px" }}>
          <strong>DESTINATÁRIO:</strong> {cargoDestinatario || "Ilmo(a). Sr(a)."} {destinatario || "___"}
        </p>

        <p style={{ fontSize: "11pt", marginBottom: "30px" }}>
          <strong>Assunto:</strong> {assuntoFormatado}
        </p>

        <p style={{ fontSize: "11pt", marginBottom: "30px", textIndent: "1.25cm" }}>
          Excelentíssimo(a) Senhor(a) Secretário(a) Municipal,
        </p>

        {/* CORPO */}
        {editable ? (
          <EditableBody
            conteudo={conteudo}
            fmt={fmt}
            onContentChange={onContentChange}
            initialConteudo={initialConteudo || conteudo}
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
              }}>
                {p}
              </p>
            ))}
          </div>
        )}

        {/* Fecho */}
        <p style={{ textIndent: "1.25cm", marginBottom: "30px", fontSize: "11pt" }}>
          Atenciosamente,
        </p>

        {/* ASSINATURA */}
        <div style={{ marginTop: "40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <img
            src={assinaturaImg}
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
          <p style={{ fontSize: "11pt", marginBottom: "0", fontWeight: "bold" }}>FABÃO</p>
          <p style={{ fontSize: "11pt", marginTop: "0" }}>Vereador</p>
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
          position: "relative",
        }}>
          Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG
          {/* Marca d'água do operador */}
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
