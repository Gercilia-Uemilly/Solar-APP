import { forwardRef, useMemo, useRef, useState, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import logoCamara from "@/assets/logo-camara-docx.jpeg";
import logoFabao from "@/assets/logo-fabao-docx.png";
import assinaturaFabao from "@/assets/assinatura-fabao-clean.png";
import type { FormatOptions } from "./PreviewFormatToolbar";
import { defaultFormatOptions } from "./PreviewFormatToolbar";
import TipTapOficioEditor from "./editor/TipTapOficioEditor";
import { cleanNumero, getDestinatario, getVocativo } from "@/lib/oficioUtils";

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
  vocativoOverride?: string;
  onVocativoChange?: (val: string) => void;
  fechamento?: string;
  onFechamentoChange?: (val: string) => void;
  onIncreaseFontSize?: () => void;
  onDecreaseFontSize?: () => void;
  dataGeracao?: string;
  initialConteudo?: string;
  anexoImageUrls?: string[];
  anexoDocuments?: AnexoDocumento[];
}

const PAGE_W_PX = 794;
const PAGE_H_PX = 1123;
const MARGIN_TOP = 113;
const MARGIN_BOT = 76;
const MARGIN_LEFT = 113;
const MARGIN_RIGHT = 76;
const CONTENT_H = PAGE_H_PX - MARGIN_TOP - MARGIN_BOT;
const CONTENT_W = PAGE_W_PX - MARGIN_LEFT - MARGIN_RIGHT;

function ImageGrid({ urls }: { urls: string[] }) {
  const count = urls.length;
  const qtdClass = count === 1 ? "qtd-1"
    : count === 2 ? "qtd-2"
    : count === 3 ? "qtd-3"
    : count === 4 ? "qtd-4"
    : count <= 6 ? `qtd-${count}`
    : "qtd-7plus";

  return (
    <div className={`grade-imagens ${qtdClass}`}>
      {urls.map((url, i) => (
        <img key={i} src={url} alt={`Anexo ${i + 1}`} loading="eager" />
      ))}
    </div>
  );
}

function splitHtmlIntoBlocks(html: string) {
  if (!html.trim()) return ["<p></p>"];

  const root = document.createElement("div");
  root.innerHTML = html;

  const blocks: string[] = [];
  const blockTags = new Set(["p", "ul", "ol", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "table", "figure"]);

  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) blocks.push(`<p>${text}</p>`);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (blockTags.has(tag)) {
      blocks.push(el.outerHTML);
      return;
    }

    if (tag === "div") {
      const childElements = Array.from(el.children);
      if (childElements.length > 0 && childElements.every((child) => blockTags.has(child.tagName.toLowerCase()))) {
        childElements.forEach((child) => blocks.push((child as HTMLElement).outerHTML));
      } else {
        blocks.push(el.outerHTML);
      }
      return;
    }

    if (tag === "img") {
      blocks.push(`<p>${el.outerHTML}</p>`);
      return;
    }

    blocks.push(`<p>${el.outerHTML}</p>`);
  });

  return blocks.length > 0 ? blocks : [html];
}

const OficioPreview = forwardRef<HTMLDivElement, Props>(
  ({ numero, destinatario, assunto, conteudo, cargoDestinatario, secretaria, formatOptions, editable, onContentChange, onAssuntoChange, onDestinatarioChange, onCargoDestinatarioChange, onNumeroChange, onDataChange, fechamento, onFechamentoChange, dataGeracao, anexoImageUrls, anexoDocuments, vocativoOverride, onVocativoChange }, ref) => {
    const rawFmt = formatOptions || defaultFormatOptions;
    const fmt = useMemo(() => ({
      ...rawFmt,
      fontSize: Math.min(rawFmt.fontSize, 14),
    }), [rawFmt]);

    const contentLength = (conteudo || "").replace(/<[^>]+>/g, "").length;
    const autoCalc = useMemo(() => {
      if (contentLength < 400) return { fontSize: 12, lineSpacing: 2.0 };
      if (contentLength < 600) return { fontSize: 11, lineSpacing: 1.83 };
      if (contentLength < 900) return { fontSize: 10.5, lineSpacing: 1.67 };
      if (contentLength < 1200) return { fontSize: 10, lineSpacing: 1.5 };
      if (contentLength < 1800) return { fontSize: 10, lineSpacing: 1.42 };
      return { fontSize: 10, lineSpacing: 1.33 };
    }, [contentLength]);

    const effectiveFontSize = fmt.fontSize && fmt.fontSize !== 10 ? Math.min(fmt.fontSize, 14) : autoCalc.fontSize;
    const effectiveLineSpacing = fmt.lineSpacing && fmt.lineSpacing !== 1.5 ? fmt.lineSpacing : autoCalc.lineSpacing;

    const numeroCleaned = cleanNumero(numero);
    const hoje = dataGeracao ? new Date(`${dataGeracao}T12:00:00`) : new Date();
    const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const defaultDataFormatada = `Uberlândia, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;
    const defaultNumeroFormatado = numeroCleaned
      ? (numeroCleaned.includes("/") ? numeroCleaned : `${numeroCleaned}/${hoje.getFullYear()}`)
      : "___";
    const defaultDestinatarioCompleto = destinatario || cargoDestinatario || (secretaria ? getDestinatario(secretaria) : "___");
    const defaultAssuntoFormatado = assunto || "___";
    const vocativoDefault = vocativoOverride || (secretaria ? getVocativo(secretaria) : "Excelentíssimo(a) Senhor(a) Secretário(a),");
    const [localVocativo, setLocalVocativo] = useState(vocativoDefault);
    const vocativoElRef = useRef<HTMLParagraphElement>(null);

    const initialFieldSyncDoneRef = useRef(false);
    const prevExternalValuesRef = useRef({
      numero: `Ofício GVF n° ${defaultNumeroFormatado}`,
      destinatario: defaultDestinatarioCompleto,
      assunto: defaultAssuntoFormatado,
      data: defaultDataFormatada,
    });
    const userEditedRef = useRef<Record<string, boolean>>({});

    const [localData, setLocalData] = useState(defaultDataFormatada);
    const [localNumero, setLocalNumero] = useState(`Ofício GVF n° ${defaultNumeroFormatado}`);
    const [localDestinatario, setLocalDestinatario] = useState(defaultDestinatarioCompleto);
    const [localAssunto, setLocalAssunto] = useState(defaultAssuntoFormatado);
    const [bodyPageSegments, setBodyPageSegments] = useState<string[]>([conteudo.startsWith("<") ? conteudo : "<p></p>"]);

    const destElRef = useRef<HTMLDivElement>(null);
    const assuntoElRef = useRef<HTMLDivElement>(null);
    const numeroElRef = useRef<HTMLDivElement>(null);
    const dataElRef = useRef<HTMLSpanElement>(null);

    const measureBodyRef = useRef<HTMLDivElement>(null);
    const measureFirstChromeRef = useRef<HTMLDivElement>(null);
    const measureContinuationChromeRef = useRef<HTMLDivElement>(null);
    const measureEndingRef = useRef<HTMLDivElement>(null);

    const buildEditorContent = useCallback((text: string) => {
      if (!text) return "<p></p>";
      if (text.startsWith("<")) return text;
      const paras = text
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean)
        .filter((p) => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i));
      return paras.length > 0 ? paras.map((p) => `<p>${p}</p>`).join("") : "<p></p>";
    }, []);

    useEffect(() => {
      const externalValues = {
        numero: `Ofício GVF n° ${defaultNumeroFormatado}`,
        destinatario: defaultDestinatarioCompleto,
        assunto: defaultAssuntoFormatado,
        data: defaultDataFormatada,
      };

      if (!initialFieldSyncDoneRef.current) {
        setLocalNumero(externalValues.numero);
        setLocalDestinatario(externalValues.destinatario);
        setLocalAssunto(externalValues.assunto);
        setLocalData(externalValues.data);
        setLocalVocativo(vocativoDefault);
        prevExternalValuesRef.current = externalValues;
        initialFieldSyncDoneRef.current = true;
        return;
      }

      const prev = prevExternalValuesRef.current;

      if (externalValues.data !== prev.data && !userEditedRef.current.data) setLocalData(externalValues.data);
      if (externalValues.numero !== prev.numero && !userEditedRef.current.numero) setLocalNumero(externalValues.numero);
      if (externalValues.destinatario !== prev.destinatario && !userEditedRef.current.destinatario) setLocalDestinatario(externalValues.destinatario);
      if (externalValues.assunto !== prev.assunto && !userEditedRef.current.assunto) setLocalAssunto(externalValues.assunto);

      prevExternalValuesRef.current = externalValues;
    }, [defaultNumeroFormatado, defaultDestinatarioCompleto, defaultAssuntoFormatado, defaultDataFormatada]);

    const syncDestinatario = useCallback((rawValue: string) => {
      userEditedRef.current.destinatario = true;
      const cleaned = rawValue.trim().replace(/^DESTINAT[AÁ]RIO:\s*/i, "").trim();
      setLocalDestinatario(cleaned);
      onCargoDestinatarioChange?.(cleaned);
      onDestinatarioChange?.(cleaned);
    }, [onCargoDestinatarioChange, onDestinatarioChange]);

    const syncAssunto = useCallback((rawValue: string) => {
      userEditedRef.current.assunto = true;
      const cleaned = rawValue.trim().replace(/^ASSUNTO:\s*/i, "").trim();
      setLocalAssunto(cleaned);
      onAssuntoChange?.(cleaned);
    }, [onAssuntoChange]);

    const syncNumero = useCallback((rawValue: string) => {
      userEditedRef.current.numero = true;
      setLocalNumero(rawValue);
      onNumeroChange?.(rawValue.trim());
    }, [onNumeroChange]);

    const syncVocativo = useCallback((rawValue: string) => {
      userEditedRef.current.vocativo = true;
      setLocalVocativo(rawValue);
      onVocativoChange?.(rawValue.trim());
    }, [onVocativoChange]);

    const editableStyle = editable ? {
      cursor: "text" as const,
      borderBottom: "1px dashed rgba(0,0,0,0.2)",
      outline: "none",
      minWidth: "40px",
    } : {};

    const initialDomSyncDone = useRef(false);
    useEffect(() => {
      if (initialDomSyncDone.current) return;
      if (destElRef.current) destElRef.current.textContent = localDestinatario;
      if (assuntoElRef.current) assuntoElRef.current.textContent = localAssunto;
      if (numeroElRef.current) numeroElRef.current.textContent = localNumero;
      if (dataElRef.current) dataElRef.current.textContent = localData;
      initialDomSyncDone.current = true;
    });

    useEffect(() => {
      if (destElRef.current && destElRef.current.textContent !== localDestinatario && !userEditedRef.current.destinatario) {
        destElRef.current.textContent = localDestinatario;
      }
    }, [localDestinatario]);

    useEffect(() => {
      if (assuntoElRef.current && assuntoElRef.current.textContent !== localAssunto && !userEditedRef.current.assunto) {
        assuntoElRef.current.textContent = localAssunto;
      }
    }, [localAssunto]);

    useEffect(() => {
      if (numeroElRef.current && numeroElRef.current.textContent !== localNumero && !userEditedRef.current.numero) {
        numeroElRef.current.textContent = localNumero;
      }
    }, [localNumero]);

    useEffect(() => {
      if (dataElRef.current && dataElRef.current.textContent !== localData && !userEditedRef.current.data) {
        dataElRef.current.textContent = localData;
      }
    }, [localData]);

    const imageChunks = useMemo(() => {
      if (!anexoImageUrls || anexoImageUrls.length === 0) return [];
      if (anexoImageUrls.length <= 6) return [anexoImageUrls];
      const chunks: string[][] = [];
      for (let i = 0; i < anexoImageUrls.length; i += 8) {
        chunks.push(anexoImageUrls.slice(i, i + 8));
      }
      return chunks;
    }, [anexoImageUrls]);

    const imagePages = imageChunks.length;

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

    const renderHeader = () => (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "24px", marginBottom: 0 }}>
        <img src={logoCamara} alt="Câmara Municipal de Uberlândia" style={{ height: "70px", width: "auto", objectFit: "contain" }} crossOrigin="anonymous" />
        <img src={logoFabao} alt="Vereador Fabão" style={{ height: "70px", width: "auto", objectFit: "contain" }} crossOrigin="anonymous" />
      </div>
    );

    const renderFirstPageIntro = () => (
      <>
        {renderHeader()}
        {!editable || !onDataChange ? (
          <p style={{ textAlign: "right", marginBottom: "24px", marginTop: "10px", fontSize: "11pt", lineHeight: "1.5" }}>{localData}</p>
        ) : (
          <p style={{ textAlign: "right", marginBottom: "24px", marginTop: "10px", fontSize: "11pt", lineHeight: "1.5" }}>
            <span
              ref={dataElRef}
              contentEditable
              suppressContentEditableWarning
              style={editableStyle}
              onBlur={(e) => {
                const val = e.currentTarget.textContent || "";
                userEditedRef.current.data = true;
                setLocalData(val);
                onDataChange(val);
              }}
            />
          </p>
        )}

        {!editable || !onNumeroChange ? (
          <p style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: "16px", marginTop: 0, lineHeight: "1.5" }}>Ofício GVF n° {defaultNumeroFormatado}</p>
        ) : (
          <div
            ref={numeroElRef}
            contentEditable
            suppressContentEditableWarning
            data-preview-field="numero"
            style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: "16px", marginTop: 0, lineHeight: "1.5", ...editableStyle }}
            onInput={(e) => syncNumero(e.currentTarget.textContent || "")}
            onBlur={(e) => syncNumero(e.currentTarget.textContent || "")}
          />
        )}

        {!editable || !onCargoDestinatarioChange ? (
          <p style={{ fontSize: "11pt", marginBottom: 0, marginTop: 0, lineHeight: "1.5", fontWeight: "bold" }}>
            <span style={{ textTransform: "uppercase" }}>DESTINATÁRIO:</span> {localDestinatario}
          </p>
        ) : (
          <div style={{ fontSize: "11pt", marginBottom: 0, marginTop: 0, lineHeight: "1.5", fontWeight: "bold", display: "flex", gap: "4px" }}>
            <span style={{ textTransform: "uppercase", flexShrink: 0 }}>DESTINATÁRIO:</span>
            <span
              ref={destElRef}
              contentEditable
              suppressContentEditableWarning
              data-preview-field="destinatario"
              style={{ ...editableStyle, flex: 1, minWidth: "40px" }}
              onInput={(e) => syncDestinatario(e.currentTarget.textContent || "")}
              onBlur={(e) => syncDestinatario(e.currentTarget.textContent || "")}
            />
          </div>
        )}

        {!editable || !onAssuntoChange ? (
          <p style={{ fontSize: "11pt", marginBottom: "24px", marginTop: 0, lineHeight: "1.5", fontWeight: "bold" }}>
            <span style={{ textTransform: "uppercase" }}>ASSUNTO:</span> {localAssunto}
          </p>
        ) : (
          <div style={{ fontSize: "11pt", marginBottom: "24px", marginTop: 0, lineHeight: "1.5", fontWeight: "bold", display: "flex", gap: "4px" }}>
            <span style={{ textTransform: "uppercase", flexShrink: 0 }}>ASSUNTO:</span>
            <span
              ref={assuntoElRef}
              contentEditable
              suppressContentEditableWarning
              data-preview-field="assunto"
              style={{ ...editableStyle, flex: 1, minWidth: "40px" }}
              onInput={(e) => syncAssunto(e.currentTarget.textContent || "")}
              onBlur={(e) => syncAssunto(e.currentTarget.textContent || "")}
            />
          </div>
        )}

        {editable ? (
          <p
            ref={vocativoElRef}
            contentEditable
            suppressContentEditableWarning
            data-preview-field="vocativo"
            style={{ fontSize: "11pt", marginBottom: "16px", marginTop: 0, textIndent: "1.25cm", textAlign: "left", lineHeight: "1.5", ...editableStyle }}
            onInput={(e) => syncVocativo(e.currentTarget.textContent || "")}
            onBlur={(e) => syncVocativo(e.currentTarget.textContent || "")}
          >
            {localVocativo}
          </p>
        ) : (
          <p style={{ fontSize: "11pt", marginBottom: "16px", marginTop: 0, textIndent: "1.25cm", textAlign: "left", lineHeight: "1.5" }}>{localVocativo}</p>
        )}
      </>
    );

    const renderContinuationChrome = () => renderHeader();

    const renderEnding = (readOnly = false) => (
      <>
        <p style={{ textIndent: "1.25cm", marginTop: "16px", marginBottom: "32px", fontSize: "11pt", lineHeight: "1.5" }}>
          {!readOnly && editable && onFechamentoChange ? (
            <span
              contentEditable
              suppressContentEditableWarning
              style={editableStyle}
              onBlur={(e) => onFechamentoChange(e.currentTarget.textContent || "")}
            >
              {fechamento || "Atenciosamente,"}
            </span>
          ) : (
            <>{fechamento || "Atenciosamente,"}</>
          )}
        </p>

        <div style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          pageBreakInside: "avoid",
          breakInside: "avoid",
          lineHeight: "1.0",
        }}>
          <img
            src={assinaturaFabao}
            alt="Assinatura Fabão"
            style={{ width: "227px", height: "auto", objectFit: "contain", marginBottom: 0, display: "block", boxShadow: "none", borderRadius: 0, padding: 0 }}
          />
          <p style={{ fontSize: "11pt", marginBottom: 0, marginTop: 0, fontWeight: "bold", lineHeight: "1.0" }}>FABÃO</p>
          <p style={{ fontSize: "11pt", marginTop: 0, marginBottom: 0, lineHeight: "1.0" }}>Vereador</p>
        </div>
      </>
    );

    useEffect(() => {
      const measureRoot = measureBodyRef.current;
      const firstChrome = measureFirstChromeRef.current;
      const continuationChrome = measureContinuationChromeRef.current;
      const ending = measureEndingRef.current;
      if (!measureRoot || !firstChrome || !continuationChrome || !ending) return;

      const fullHtml = buildEditorContent(conteudo);
      const blocks = splitHtmlIntoBlocks(fullHtml);
      const cache = new Map<string, number>();

      const measureBlockHeight = (html: string) => {
        const cacheKey = `${effectiveFontSize}|${effectiveLineSpacing}|${fmt.fontFamily}|${html}`;
        if (cache.has(cacheKey)) return cache.get(cacheKey) || 0;
        const wrapper = document.createElement("div");
        wrapper.innerHTML = html;
        measureRoot.appendChild(wrapper);
        const height = wrapper.offsetHeight;
        measureRoot.removeChild(wrapper);
        cache.set(cacheKey, height);
        return height;
      };

      const firstCap = Math.max(120, CONTENT_H - firstChrome.offsetHeight);
      const continuationCap = Math.max(120, CONTENT_H - continuationChrome.offsetHeight);
      const endingHeight = ending.offsetHeight;

      const nextPages: string[][] = [[]];
      const usedHeights: number[] = [0];

      blocks.forEach((block) => {
        const blockHeight = measureBlockHeight(block);
        const currentIndex = nextPages.length - 1;
        const currentCap = currentIndex === 0 ? firstCap : continuationCap;

        if (nextPages[currentIndex].length > 0 && usedHeights[currentIndex] + blockHeight > currentCap) {
          nextPages.push([block]);
          usedHeights.push(blockHeight);
        } else {
          nextPages[currentIndex].push(block);
          usedHeights[currentIndex] += blockHeight;
        }
      });

      let lastIndex = nextPages.length - 1;
      while (usedHeights[lastIndex] + endingHeight > (lastIndex === 0 ? firstCap : continuationCap) && nextPages[lastIndex].length > 0) {
        const overflowBlocks: string[] = [];
        let overflowHeight = 0;

        while (usedHeights[lastIndex] + endingHeight > (lastIndex === 0 ? firstCap : continuationCap) && nextPages[lastIndex].length > 1) {
          const moved = nextPages[lastIndex].pop();
          if (!moved) break;
          const movedHeight = measureBlockHeight(moved);
          overflowBlocks.unshift(moved);
          overflowHeight += movedHeight;
          usedHeights[lastIndex] -= movedHeight;
        }

        if (overflowBlocks.length === 0) {
          nextPages.push([]);
          usedHeights.push(0);
          lastIndex = nextPages.length - 1;
          break;
        }

        nextPages.push(overflowBlocks);
        usedHeights.push(overflowHeight);
        lastIndex = nextPages.length - 1;
      }

      const normalizedPages = nextPages.map((page) => page.join(""));
      const resolvedPages = normalizedPages.length > 0 ? normalizedPages : ["<p></p>"];

      setBodyPageSegments((prev) => {
        if (prev.length === resolvedPages.length && prev.every((segment, index) => segment === resolvedPages[index])) {
          return prev;
        }
        return resolvedPages;
      });
    }, [conteudo, buildEditorContent, effectiveFontSize, effectiveLineSpacing, fmt.fontFamily, localData, localNumero, localDestinatario, localAssunto, fechamento]);

    const handlePageContentChange = useCallback((pageIndex: number, newPageHtml: string) => {
      setBodyPageSegments((prev) => {
        const next = [...prev];
        next[pageIndex] = newPageHtml;
        onContentChange?.(next.join(""));
        return next;
      });
    }, [onContentChange]);

    const documentPageCount = Math.max(1, bodyPageSegments.length);
    const totalPagesForExport = documentPageCount + imagePages + pdfPagesFromDocuments;

    return (
      <>
        <style>{`
          .oficio-preview-page-body p,
          .oficio-preview-measure p {
            text-indent: 1.25cm;
            margin: 0;
            font-size: ${effectiveFontSize}pt;
            line-height: ${effectiveLineSpacing};
            text-align: justify;
          }
          .oficio-preview-page-body ul,
          .oficio-preview-page-body ol,
          .oficio-preview-measure ul,
          .oficio-preview-measure ol {
            padding-left: 2cm;
            margin: 0 0 10px 0;
            font-size: ${effectiveFontSize}pt;
            line-height: ${effectiveLineSpacing};
          }
          .oficio-preview-page-body img,
          .oficio-preview-measure img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 8px auto;
          }
        `}</style>

        <div aria-hidden style={{ position: "absolute", left: "-99999px", top: 0, visibility: "hidden", pointerEvents: "none", width: `${CONTENT_W}px`, fontFamily: `${fmt.fontFamily}, Arial, Helvetica, sans-serif`, fontSize: `${effectiveFontSize}pt`, lineHeight: String(effectiveLineSpacing), color: "#000" }}>
          <div ref={measureFirstChromeRef}>{renderFirstPageIntro()}</div>
          <div ref={measureContinuationChromeRef}>{renderContinuationChrome()}</div>
          <div ref={measureBodyRef} className="oficio-preview-measure" />
          <div ref={measureEndingRef}>{renderEnding(true)}</div>
        </div>

        <div ref={ref} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
          <div style={{ background: "#1B3A6B", color: "white", padding: "8px 16px", borderRadius: "6px", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px", fontFamily: "sans-serif" }}>
            📄 Este documento terá <strong>{totalPagesForExport}</strong> {totalPagesForExport === 1 ? "página" : "páginas"}
            {pdfPagesFromDocuments > 0 && <span style={{ opacity: 0.8, fontSize: "11px" }}>(inclui {pdfPagesFromDocuments} pág. de anexo PDF)</span>}
          </div>

          {bodyPageSegments.map((segment, pageIdx) => {
            const isLastDocumentPage = pageIdx === bodyPageSegments.length - 1;
            return (
              <div
                key={`doc-page-${pageIdx}`}
                className="preview-pagina-a4"
                style={{
                  width: `${PAGE_W_PX}px`,
                  height: `${PAGE_H_PX}px`,
                  background: "#fff",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  flexShrink: 0,
                  boxSizing: "border-box",
                  fontFamily: "Arial, sans-serif",
                  position: "relative",
                }}
              >
                <div style={{ position: "absolute", top: "40px", right: "40px", fontSize: "9pt", color: "#000", fontFamily: "Arial, sans-serif", zIndex: 3 }}>
                  {pageIdx + 1}
                </div>

                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    paddingTop: `${MARGIN_TOP}px`,
                    paddingRight: `${MARGIN_RIGHT}px`,
                    paddingBottom: `${MARGIN_BOT}px`,
                    paddingLeft: `${MARGIN_LEFT}px`,
                    boxSizing: "border-box",
                    fontFamily: `${fmt.fontFamily}, Arial, Helvetica, sans-serif`,
                    color: "#000",
                    overflow: "hidden",
                  }}
                >
                  {pageIdx === 0 ? renderFirstPageIntro() : renderContinuationChrome()}

                  <div className="oficio-preview-page-body" style={{ textAlign: "justify", fontSize: `${effectiveFontSize}pt`, lineHeight: String(effectiveLineSpacing) }}>
                    {editable ? (
                      <TipTapOficioEditor
                        content={segment || "<p></p>"}
                        onChange={(html) => handlePageContentChange(pageIdx, html)}
                        fontFamily={fmt.fontFamily}
                        fontSize={effectiveFontSize}
                        lineSpacing={effectiveLineSpacing}
                        showToolbar={pageIdx === 0}
                      />
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(segment || "<p></p>") }} />
                    )}
                  </div>

                  {isLastDocumentPage ? renderEnding(!editable) : null}
                </div>

                <div style={{ position: "absolute", left: `${MARGIN_LEFT}px`, right: `${MARGIN_RIGHT}px`, bottom: "22px", fontSize: "9pt", color: "#444", textAlign: "center", fontFamily: "Arial, Helvetica, sans-serif" }}>
                  Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG
                </div>
              </div>
            );
          })}

          {imageChunks.map((chunk, chunkIdx) => {
            const pageNum = documentPageCount + chunkIdx + 1;
            return (
              <div
                key={`img-page-${chunkIdx}`}
                className="preview-pagina-a4"
                style={{
                  width: `${PAGE_W_PX}px`,
                  height: `${PAGE_H_PX}px`,
                  background: "#fff",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  flexShrink: 0,
                  boxSizing: "border-box",
                  position: "relative",
                }}
              >
                <div style={{ position: "absolute", top: "40px", right: "40px", fontSize: "9pt", color: "#000", fontFamily: "Arial, sans-serif", zIndex: 2 }}>
                  {pageNum}
                </div>
                <div style={{ position: "absolute", inset: 0, paddingTop: `${MARGIN_TOP}px`, paddingRight: `${MARGIN_RIGHT}px`, paddingBottom: `${MARGIN_BOT}px`, paddingLeft: `${MARGIN_LEFT}px`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ImageGrid urls={chunk} />
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }
);

OficioPreview.displayName = "OficioPreview";
export default OficioPreview;
