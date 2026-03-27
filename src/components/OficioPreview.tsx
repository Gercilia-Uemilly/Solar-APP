import { forwardRef, useMemo, useRef, useState, useEffect, useCallback } from "react";
import logoCamara from "@/assets/logo-camara-docx.jpeg";
import logoFabao from "@/assets/logo-fabao-docx.png";
import assinaturaFabao from "@/assets/assinatura-fabao-clean.png";
import type { FormatOptions } from "./PreviewFormatToolbar";
import { defaultFormatOptions } from "./PreviewFormatToolbar";
import OficioPreviewEditor from "./OficioPreviewEditor";

type AnexoDocumento = {
  nome: string;
  tipo: string;
  paginas?: number;
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

// A4 at 96dpi
const PAGE_W_PX = 794;
const PAGE_H_PX = 1123;
// Margins: top 3cm=113px, bottom 2cm=76px, left 3cm=113px, right 2cm=76px
const MARGIN_TOP = 113;
const MARGIN_BOT = 76;
const MARGIN_LEFT = 113;
const MARGIN_RIGHT = 76;
const CONTENT_H = PAGE_H_PX - MARGIN_TOP - MARGIN_BOT;

/** Render image grid for a chunk of images */
function ImageGrid({ urls }: { urls: string[] }) {
  const count = urls.length;
  const totalClass = `total-${Math.min(count, 4)}`;
  return (
    <div className={`preview-imagens-grid ${totalClass}`}>
      {urls.map((url, i) => (
        <img key={i} src={url} alt={`Anexo ${i + 1}`} loading="eager" />
      ))}
    </div>
  );
}

const OficioPreview = forwardRef<HTMLDivElement, Props>(
  ({ numero, destinatario, assunto, conteudo, bairro, logradouro, numeroEnd, cargoDestinatario, operadorNome, secretaria, formatOptions, editable, onContentChange, onAssuntoChange, onDestinatarioChange, onCargoDestinatarioChange, onNumeroChange, onDataChange, onIncreaseFontSize, onDecreaseFontSize, dataGeracao, initialConteudo, anexoImageUrls, anexoDocuments }, ref) => {
    const rawFmt = formatOptions || defaultFormatOptions;
    const fmt = useMemo(() => ({
      ...rawFmt,
      fontSize: Math.min(rawFmt.fontSize, 12),
    }), [rawFmt]);

    const contentLength = (conteudo || "").replace(/<[^>]+>/g, "").length;
    const autoCalc = useMemo(() => {
      if (contentLength < 400) return { fontSize: 13, lineSpacing: 2.0 };
      if (contentLength < 600) return { fontSize: 12, lineSpacing: 1.83 };
      if (contentLength < 900) return { fontSize: 11.5, lineSpacing: 1.67 };
      if (contentLength < 1200) return { fontSize: 11, lineSpacing: 1.5 };
      if (contentLength < 1800) return { fontSize: 10.5, lineSpacing: 1.42 };
      return { fontSize: 10, lineSpacing: 1.33 };
    }, [contentLength]);

    const effectiveFontSize = fmt.fontSize && fmt.fontSize !== 11 ? Math.min(fmt.fontSize, 12) : autoCalc.fontSize;
    const effectiveLineSpacing = fmt.lineSpacing && fmt.lineSpacing !== 1.5 ? fmt.lineSpacing : autoCalc.lineSpacing;

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
      .split("\n").map(p => p.trim()).filter(Boolean)
      .filter(p => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i));

    const numeroCleaned = cleanNumero(numero);
    const numeroFormatado = numeroCleaned
      ? (numeroCleaned.includes("/") ? numeroCleaned : `${numeroCleaned}/${hoje.getFullYear()}`)
      : "___";

    const assuntoFormatado = assunto || "___";
    const destinatarioCompleto = cargoDestinatario || `Ilmo(a). Sr(a). Secretário(a) Municipal${destinatario ? ` de ${destinatario}` : ""}`;
    const vocativo = buildVocativo(cargoDestinatario);

    const buildEditorContent = (text: string) => {
      if (text.startsWith("<")) return text;
      const paras = text.split("\n").map(p => p.trim()).filter(Boolean)
        .filter(p => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i));
      return paras.map(p => `<p>${p}</p>`).join("");
    };

    // Image chunks (groups of 4)
    const imageChunks = useMemo(() => {
      if (!anexoImageUrls || anexoImageUrls.length === 0) return [];
      const chunks: string[][] = [];
      for (let i = 0; i < anexoImageUrls.length; i += 4) {
        chunks.push(anexoImageUrls.slice(i, i + 4));
      }
      return chunks;
    }, [anexoImageUrls]);

    const pdfPagesFromDocuments = useMemo(() => {
      if (!anexoDocuments || anexoDocuments.length === 0) return 0;
      return anexoDocuments.reduce((acc, doc) => {
        const tipo = (doc.tipo || "").toLowerCase();
        const nome = (doc.nome || "").toLowerCase();
        const isPdf = tipo.includes("pdf") || nome.endsWith(".pdf");
        if (!isPdf) return acc;

        const paginas = typeof doc.paginas === "number" && Number.isFinite(doc.paginas)
          ? Math.max(1, Math.floor(doc.paginas))
          : 1;

        return acc + paginas;
      }, 0);
    }, [anexoDocuments]);

    // ── Page calculation ─────────────────────────────────────────
    const contentRef = useRef<HTMLDivElement>(null);
    const [totalPages, setTotalPages] = useState(1);

    const recalcPages = useCallback(() => {
      if (!contentRef.current) return;
      // scrollHeight includes padding, so subtract margins to get pure content height
      const scrollH = contentRef.current.scrollHeight;
      const contentH = scrollH - MARGIN_TOP - MARGIN_BOT;
      setTotalPages(Math.max(1, Math.ceil(contentH / CONTENT_H)));
    }, []);

    const totalPagesForExport = totalPages + pdfPagesFromDocuments;

    useEffect(() => {
      recalcPages();
      const timer = setInterval(recalcPages, 500);
      return () => clearInterval(timer);
    }, [recalcPages, conteudo, anexoImageUrls, anexoDocuments]);

    // ── Shared document content renderer ─────────────────────────
    const renderDocumentContent = (isHidden: boolean) => (
      <>
        {/* CABEÇALHO */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "24px", marginBottom: "0" }}>
          <img src={logoCamara} alt="Câmara Municipal de Uberlândia" style={{ height: "70px", width: "auto", objectFit: "contain" }} crossOrigin="anonymous" />
          <img src={logoFabao} alt="Vereador Fabão" style={{ height: "70px", width: "auto", objectFit: "contain" }} crossOrigin="anonymous" />
        </div>

        {/* DATA */}
        {!isHidden && editable && onDataChange ? (
          <p style={{ textAlign: "right", marginBottom: "24px", marginTop: "10px", fontSize: "11pt", lineHeight: "1.5" }}>
            <span contentEditable suppressContentEditableWarning style={editableStyle} onBlur={e => onDataChange(e.currentTarget.textContent || "")}>{dataFormatada}</span>
          </p>
        ) : (
          <p style={{ textAlign: "right", marginBottom: "24px", marginTop: "10px", fontSize: "11pt", lineHeight: "1.5" }}>{dataFormatada}</p>
        )}

        {/* OFÍCIO GVF n° */}
        <p style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: "16px", marginTop: "0", lineHeight: "1.5" }}>
          {!isHidden && editable && onNumeroChange ? (
            <span contentEditable suppressContentEditableWarning style={editableStyle} onBlur={e => onNumeroChange(e.currentTarget.textContent || "")}>
              Ofício GVF n° {numeroFormatado}
            </span>
          ) : (
            <>Ofício GVF n° {numeroFormatado}</>
          )}
        </p>

        {/* DESTINATÁRIO */}
        <p style={{ fontSize: "11pt", marginBottom: "0", marginTop: "0", lineHeight: "1.5", fontWeight: "bold" }}>
          <span>DESTINATÁRIO: </span>
          {!isHidden && editable && onCargoDestinatarioChange ? (
            <span contentEditable suppressContentEditableWarning style={editableStyle} onBlur={e => onCargoDestinatarioChange(e.currentTarget.textContent || "")}>{destinatarioCompleto}</span>
          ) : (
            <span>{destinatarioCompleto}</span>
          )}
        </p>

        {/* ASSUNTO */}
        <p style={{ fontSize: "11pt", marginBottom: "24px", marginTop: "0", lineHeight: "1.5", fontWeight: "bold" }}>
          <span>Assunto: </span>
          {!isHidden && editable && onAssuntoChange ? (
            <span contentEditable suppressContentEditableWarning style={editableStyle} onBlur={e => onAssuntoChange(e.currentTarget.textContent || "")}>{assuntoFormatado}</span>
          ) : (
            <span>{assuntoFormatado}</span>
          )}
        </p>

        {/* VOCATIVO */}
        <p style={{ fontSize: "11pt", marginBottom: "16px", marginTop: "0", textIndent: "1.25cm", textAlign: "left", lineHeight: "1.5", fontWeight: "normal" }}>
          {vocativo}
        </p>

        {/* CORPO */}
        {!isHidden && editable && onContentChange ? (
          <OficioPreviewEditor
            content={buildEditorContent(conteudo)}
            onChange={onContentChange}
            fontFamily={fmt.fontFamily}
            fontSize={effectiveFontSize}
            lineSpacing={effectiveLineSpacing}
            onIncreaseFontSize={onIncreaseFontSize}
            onDecreaseFontSize={onDecreaseFontSize}
          />
        ) : isHtml ? (
          <div
            style={{ textAlign: "justify", fontSize: `${effectiveFontSize}pt`, lineHeight: String(effectiveLineSpacing) }}
            dangerouslySetInnerHTML={{ __html: conteudo }}
          />
        ) : (
          <div style={{ textAlign: "justify" }}>
            {paragraphs.map((p, i) => (
              <p key={i} style={{ textIndent: "1.25cm", marginBottom: "0", marginTop: "0", fontSize: "11pt", lineHeight: "1.5" }}
                dangerouslySetInnerHTML={{ __html: p }}
              />
            ))}
          </div>
        )}

        {/* ATENCIOSAMENTE */}
        <p style={{ textIndent: "1.25cm", marginTop: "16px", marginBottom: "32px", fontSize: "11pt", lineHeight: "1.5" }}>
          Atenciosamente,
        </p>

        {/* BLOCO ASSINATURA */}
        <div style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          pageBreakInside: "avoid",
          breakInside: "avoid",
          lineHeight: "1.0",
          border: "none",
        }}>
          <img
            src={assinaturaFabao}
            alt="Assinatura Fabão"
            style={{
              width: "227px", height: "auto", objectFit: "contain",
              marginBottom: "0", display: "block",
              border: "0 none transparent", outline: "0 none transparent",
              boxShadow: "none", borderRadius: "0", padding: "0",
            }}
          />
          <p style={{ fontSize: "11pt", marginBottom: "0", marginTop: "0", fontWeight: "bold", lineHeight: "1.0", border: "none" }}>FABÃO</p>
          <p style={{ fontSize: "11pt", marginTop: "0", marginBottom: "0", lineHeight: "1.0", border: "none" }}>Vereador</p>
        </div>

        {/* ANEXO DE IMAGENS — máx 4 por grupo, tamanhos controlados */}
        {imageChunks.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            {imageChunks.map((chunk, ci) => (
              <div key={ci} style={{ marginTop: ci > 0 ? "16px" : "0", pageBreakInside: "avoid", breakInside: "avoid" }}>
                <ImageGrid urls={chunk} />
              </div>
            ))}
          </div>
        )}

        {/* ANEXO DE DOCUMENTOS */}
        {anexoDocuments && anexoDocuments.length > 0 && (
          <div style={{ marginTop: "20px", pageBreakInside: "avoid" }}>
            <p style={{ margin: 0, fontSize: "10pt", fontWeight: "bold", lineHeight: "1.4" }}>
              Documentos anexados
            </p>
            <ul style={{ margin: "8px 0 0", paddingLeft: "20px", fontSize: "10pt", lineHeight: "1.5" }}>
              {anexoDocuments.map((doc, i) => {
                const label = doc.tipo.includes("pdf") ? "PDF" : "Arquivo";
                return <li key={`${doc.nome}-${i}`}>{label}: {doc.nome}</li>;
              })}
            </ul>
          </div>
        )}

        {/* RODAPÉ */}
        <div style={{
          marginTop: "80px", fontSize: "9pt", color: "#444",
          textAlign: "center", paddingTop: "6px", paddingBottom: "6px",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}>
          Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG
        </div>
      </>
    );

    return (
      <div ref={ref} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
        {/* Page count indicator */}
        <div style={{ textAlign: "center", fontSize: "12px", color: "#666" }}>
          📄 {totalPagesForExport === 1 ? "Documento terá 1 página" : `Documento terá ${totalPagesForExport} páginas`}
          {pdfPagesFromDocuments > 0 ? ` (inclui ${pdfPagesFromDocuments} página${pdfPagesFromDocuments > 1 ? "s" : ""} de anexo PDF)` : ""}
        </div>

        {/* Hidden measurement removed — we measure the visible first page's content div directly */}

        {/* ── Visible paginated preview ─────────────────────────────── */}
        {Array.from({ length: totalPages }, (_, pageIdx) => (
          <div key={pageIdx} style={{ position: "relative" }}>
            {/* Page separator label */}
            {pageIdx > 0 && (
              <div style={{
                borderTop: "2px dashed #aaa",
                margin: "0 0 8px 0",
                textAlign: "center",
                fontSize: "11px",
                color: "#aaa",
                paddingTop: "4px",
              }}>
                ── Página {pageIdx + 1} ──
              </div>
            )}
            <div
              style={{
                width: `${PAGE_W_PX}px`,
                height: `${PAGE_H_PX}px`,
                background: "#fff",
                boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                borderRadius: "4px",
                position: "relative",
                overflow: "hidden",
                flexShrink: 0,
                boxSizing: "border-box",
                fontFamily: "Arial, sans-serif",
                fontSize: "11pt",
                lineHeight: "1.5",
              }}
            >
              {/* Page number label */}
              <div style={{
                position: "absolute",
                top: "40px",
                right: "40px",
                fontSize: "9pt",
                color: "#999",
                fontFamily: "Arial, sans-serif",
                zIndex: 2,
              }}>
                Página {pageIdx + 1} de {totalPagesForExport}
              </div>

              {/* Content window — shifts up for each page */}
              <div
                ref={pageIdx === 0 ? contentRef : undefined}
                style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                paddingTop: `${MARGIN_TOP}px`,
                paddingRight: `${MARGIN_RIGHT}px`,
                paddingBottom: `${MARGIN_BOT}px`,
                paddingLeft: `${MARGIN_LEFT}px`,
                boxSizing: "border-box",
                fontFamily: `${fmt.fontFamily}, Arial, Helvetica, sans-serif`,
                fontSize: `${effectiveFontSize}pt`,
                lineHeight: String(effectiveLineSpacing),
                color: "#000",
                transform: `translateY(-${pageIdx * CONTENT_H}px)`,
              }}>
                {renderDocumentContent(false)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
);

OficioPreview.displayName = "OficioPreview";
export default OficioPreview;
