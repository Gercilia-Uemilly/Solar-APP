import { forwardRef, useMemo } from "react";
import logoCamara from "@/assets/logo-camara-docx.jpeg";
import logoFabao from "@/assets/logo-fabao-docx.png";
import assinaturaFabao from "@/assets/assinatura-fabao-clean.png";
import type { FormatOptions } from "./PreviewFormatToolbar";
import { defaultFormatOptions } from "./PreviewFormatToolbar";
import OficioPreviewEditor from "./OficioPreviewEditor";

type AnexoDocumento = {
  nome: string;
  tipo: string;
};

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
  onIncreaseFontSize?: () => void;
  onDecreaseFontSize?: () => void;
  dataGeracao?: string;
  initialConteudo?: string;
  anexoImageUrls?: string[];
  anexoDocuments?: AnexoDocumento[];
}

import { cleanNumero, buildVocativo } from "@/lib/oficioUtils";

const OficioPreview = forwardRef<HTMLDivElement, Props>(
  ({ numero, destinatario, assunto, conteudo, bairro, logradouro, numeroEnd, cargoDestinatario, operadorNome, secretaria, formatOptions, editable, onContentChange, onAssuntoChange, onDestinatarioChange, onCargoDestinatarioChange, onNumeroChange, onDataChange, onIncreaseFontSize, onDecreaseFontSize, dataGeracao, initialConteudo, anexoImageUrls, anexoDocuments }, ref) => {
    const rawFmt = formatOptions || defaultFormatOptions;
    // Cap font size at 12pt max
    const fmt = useMemo(() => ({
      ...rawFmt,
      fontSize: Math.min(rawFmt.fontSize, 12),
    }), [rawFmt]);

    // Auto-adjust font and spacing to fill page (max 12pt)
    const contentLength = (conteudo || "").replace(/<[^>]+>/g, "").length;
    const autoFontSize = useMemo(() => {
      if (contentLength < 400) return 12;
      if (contentLength < 700) return 12;
      if (contentLength < 1200) return 11;
      if (contentLength < 1800) return 10;
      return 9;
    }, [contentLength]);
    const autoLineSpacing = useMemo(() => {
      if (contentLength < 400) return 2.0;
      if (contentLength < 700) return 1.75;
      if (contentLength < 1200) return 1.5;
      return 1.33;
    }, [contentLength]);

    const effectiveFontSize = Math.min(autoFontSize, 12);
    const effectiveLineSpacing = autoLineSpacing;

    const hoje = dataGeracao ? new Date(dataGeracao + "T12:00:00") : new Date();
    const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const dataFormatada = `Uberlândia, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;

    const editableStyle = editable ? {
      cursor: "text" as const,
      borderBottom: "1px dashed rgba(0,0,0,0.2)",
      outline: "none",
      minWidth: "40px",
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

    // Assunto formatting — simply use assunto as-is. 
    // The bairro is already included in the AI-generated assunto or set by the user.
    // Do NOT append bairro again to avoid duplication.
    const assuntoFormatado = assunto || "___";

    

    const destinatarioCompleto = cargoDestinatario || `Ilmo(a). Sr(a). Secretário(a) Municipal${destinatario ? ` de ${destinatario}` : ""}`;

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
          minHeight: "297mm",
          paddingTop: "30mm",
          paddingRight: "20mm",
          paddingBottom: "20mm",
          paddingLeft: "30mm",
          fontFamily: `${fmt.fontFamily}, Arial, Helvetica, sans-serif`,
          fontSize: `${effectiveFontSize}pt`,
          lineHeight: String(effectiveLineSpacing),
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
          fontFamily: `${fmt.fontFamily}, Arial, Helvetica, sans-serif`,
        }}>1</div>

        {/* DATA — after: 240 (~16px) */}
        {editable && onDataChange ? (
          <p style={{ textAlign: "right", marginBottom: "24px", marginTop: "10px", fontSize: "11pt", lineHeight: "1.5" }}>
            <span contentEditable suppressContentEditableWarning style={editableStyle} onBlur={e => onDataChange(e.currentTarget.textContent || "")}>{dataFormatada}</span>
          </p>
        ) : (
          <p style={{ textAlign: "right", marginBottom: "24px", marginTop: "10px", fontSize: "11pt", lineHeight: "1.5" }}>{dataFormatada}</p>
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

        {/* DESTINATÁRIO — bold completo */}
        <p style={{ fontSize: "11pt", marginBottom: "0", marginTop: "0", lineHeight: "1.5", fontWeight: "bold" }}>
          <span>DESTINATÁRIO: </span>
          {editable && onCargoDestinatarioChange ? (
            <span contentEditable suppressContentEditableWarning style={editableStyle} onBlur={e => onCargoDestinatarioChange(e.currentTarget.textContent || "")}>{destinatarioCompleto}</span>
          ) : (
            <span>{destinatarioCompleto}</span>
          )}
        </p>

        {/* ASSUNTO — after: 240, NEGRITO completo, "Assunto:" com A maiúscula */}
        <p style={{ fontSize: "11pt", marginBottom: "24px", marginTop: "0", lineHeight: "1.5", fontWeight: "bold" }}>
          <span>Assunto: </span>
          {editable && onAssuntoChange ? (
            <span contentEditable suppressContentEditableWarning style={editableStyle} onBlur={e => onAssuntoChange(e.currentTarget.textContent || "")}>{assuntoFormatado}</span>
          ) : (
            <span>{assuntoFormatado}</span>
          )}
        </p>

        {/* VOCATIVO — ESQUERDA com recuo 1.25cm, after: 240, NEGRITO */}
        <p style={{ fontSize: "11pt", marginBottom: "16px", marginTop: "0", textIndent: "1.25cm", textAlign: "left", lineHeight: "1.5", fontWeight: "normal" }}>
          {vocativo}
        </p>

        {/* CORPO — after:0, before:0, line:fmt, justificado, recuo 1.25cm */}
        {editable && onContentChange ? (
          <OficioPreviewEditor
            content={buildEditorContent(conteudo)}
            onChange={onContentChange}
            fontFamily={fmt.fontFamily}
            fontSize={effectiveFontSize}
            lineSpacing={effectiveLineSpacing}
          />
        ) : isHtml ? (
          <div
            style={{ textAlign: "justify", fontSize: `${effectiveFontSize}pt`, lineHeight: String(effectiveLineSpacing) }}
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
          border: "none",
          borderTop: "none",
          borderBottom: "none",
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
              border: "0 none transparent",
              borderWidth: "0",
              borderStyle: "none",
              borderColor: "transparent",
              outline: "0 none transparent",
              boxShadow: "none",
              borderRadius: "0",
              padding: "0",
            }}
          />
          <p style={{ fontSize: "11pt", marginBottom: "0", marginTop: "0", fontWeight: "bold", lineHeight: "1.0", border: "none" }}>FABÃO</p>
          <p style={{ fontSize: "11pt", marginTop: "0", marginBottom: "0", lineHeight: "1.0", border: "none" }}>Vereador</p>
        </div>

        {/* ANEXO DE IMAGENS */}
        {anexoImageUrls && anexoImageUrls.length > 0 && (() => {
          const count = anexoImageUrls.length;
          const gridClass = count === 1 ? "grid-1" : count === 2 ? "grid-2" : count === 3 ? "grid-3" : "grid-4";

          // For 3 images: 1 big on top, 2 side-by-side below
          if (count === 3) {
            return (
              <div style={{ marginTop: "20px", pageBreakInside: "avoid", breakInside: "avoid" }}>
                <div className="anexo-imagens grid-1">
                  <div className="imagem-item">
                    <img src={anexoImageUrls[0]} alt="Anexo 1" style={{ width: "100%", height: "auto", display: "block" }} loading="eager" />
                  </div>
                </div>
                <div className="anexo-imagens grid-3-bottom" style={{ marginTop: "10px" }}>
                  {anexoImageUrls.slice(1).map((url, i) => (
                    <div key={i} className="imagem-item">
                      <img src={url} alt={`Anexo ${i + 2}`} style={{ width: "100%", height: "auto", display: "block" }} loading="eager" />
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          // For 5+ images: groups of 4 per "page block"
          if (count > 4) {
            const chunks: string[][] = [];
            for (let i = 0; i < count; i += 4) {
              chunks.push(anexoImageUrls.slice(i, i + 4));
            }
            return (
              <div style={{ marginTop: "20px" }}>
                {chunks.map((chunk, ci) => {
                  const chunkGrid = chunk.length === 1 ? "grid-1" : chunk.length === 2 ? "grid-2" : chunk.length === 3 ? "grid-3" : "grid-4";
                  return (
                    <div key={ci} className={`anexo-imagens ${chunkGrid}`} style={{ marginTop: ci > 0 ? "10px" : "0", pageBreakInside: "avoid", breakInside: "avoid" }}>
                      {chunk.map((url, i) => (
                        <div key={i} className="imagem-item">
                          <img src={url} alt={`Anexo ${ci * 4 + i + 1}`} style={{ width: "100%", height: "auto", display: "block" }} loading="eager" />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          }

          return (
            <div style={{ marginTop: "20px", pageBreakInside: "avoid", breakInside: "avoid" }}>
              <div className={`anexo-imagens ${gridClass}`}>
                {anexoImageUrls.map((url, i) => (
                  <div key={i} className="imagem-item">
                    <img src={url} alt={`Anexo ${i + 1}`} style={{ width: "100%", height: "auto", display: "block" }} loading="eager" />
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ANEXO DE DOCUMENTOS */}
        {anexoDocuments && anexoDocuments.length > 0 && (
          <div style={{ marginTop: "20px", pageBreakInside: "avoid" }}>
            <p style={{ margin: 0, fontSize: "10pt", fontWeight: "bold", lineHeight: "1.4" }}>
              Documentos anexados
            </p>
            <ul style={{ margin: "8px 0 0", paddingLeft: "20px", fontSize: "10pt", lineHeight: "1.5" }}>
              {anexoDocuments.map((doc, i) => {
                const label = doc.tipo.includes("pdf") ? "PDF" : "Arquivo";
                return (
                  <li key={`${doc.nome}-${i}`}>
                    {label}: {doc.nome}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* RODAPÉ */}
        <div style={{
          marginTop: "80px",
          fontSize: "9pt",
          color: "#444",
          textAlign: "center",
          paddingTop: "6px",
          paddingBottom: "6px",
          position: "relative",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}>
          Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG
        </div>
      </div>
    );
  }
);

OficioPreview.displayName = "OficioPreview";
export default OficioPreview;
