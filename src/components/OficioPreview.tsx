import { forwardRef, useMemo, useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import logoCamara from "@/assets/logo-camara-docx.jpeg";
import logoFabao from "@/assets/logo-fabao-docx.png";
import assinaturaFabao from "@/assets/assinatura-fabao-clean.png";
import type { FormatOptions } from "./PreviewFormatToolbar";
import { defaultFormatOptions } from "./PreviewFormatToolbar";
import TipTapOficioEditor from "./editor/TipTapOficioEditor";
import { cleanNumero, getDestinatario, getVocativo, gerarEncerramentoDinamico, normalizarConteudoOficio } from "@/lib/oficioUtils";

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
// Folga de segurança: evita que arredondamentos de medição joguem a última
// linha do parágrafo para baixo da margem inferior na prévia.
const PAGE_SAFETY_PX = 18;

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
    // Ajuste automático baseado na altura REAL renderizada. Fontes, toolbar e o
    // ProseMirror podem ocupar alguns pixels a mais que o medidor isolado.
    const [paginationSafety, setPaginationSafety] = useState(PAGE_SAFETY_PX);
    // Track when content changes come from the editor (user editing) vs external
    const editorOriginatedChangeRef = useRef(false);
    const lastConteudoForPaginationRef = useRef(conteudo);

    const destElRef = useRef<HTMLDivElement>(null);
    const assuntoElRef = useRef<HTMLDivElement>(null);
    const numeroElRef = useRef<HTMLDivElement>(null);
    const dataElRef = useRef<HTMLSpanElement>(null);

    const measureBodyRef = useRef<HTMLDivElement>(null);
    const measureFirstChromeRef = useRef<HTMLDivElement>(null);
    const measureShellRef = useRef<HTMLDivElement>(null);
    const measureContinuationChromeRef = useRef<HTMLDivElement>(null);
    const measureEndingRef = useRef<HTMLDivElement>(null);

    const buildEditorContent = useCallback((text: string) => {
      const normalizedText = normalizarConteudoOficio(text || "");
      if (!normalizedText) return "<p></p>";
      if (normalizedText.startsWith("<")) return normalizedText;
      const paras = normalizedText
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
          <div style={{ fontSize: "11pt", marginBottom: "16px", marginTop: 0, textIndent: "1.25cm", textAlign: "left", lineHeight: "1.5" }}>
            <span
              contentEditable
              suppressContentEditableWarning
              data-preview-field="vocativo"
              style={{ ...editableStyle, minWidth: "200px", display: "inline-block" }}
              onBlur={(e) => {
                const val = (e.currentTarget.textContent || "").trim();
                if (val) {
                  setLocalVocativo(val);
                  onVocativoChange?.(val);
                }
              }}
            >
              {localVocativo}
            </span>
          </div>
        ) : (
          <p style={{ fontSize: "11pt", marginBottom: "16px", marginTop: 0, textIndent: "1.25cm", textAlign: "left", lineHeight: "1.5" }}>{localVocativo}</p>
        )}
      </>
    );

    // O cabeçalho do Word/PDF pertence à margem superior da seção e não reduz a
    // altura útil do corpo. Mantê-lo dentro do fluxo do preview fazia cada
    // continuação começar cerca de 70px abaixo da posição real da exportação.
    const renderContinuationChrome = () => null;

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

    const paginateHtml = useCallback((fullHtml: string) => {
      const measureRoot = measureBodyRef.current;
      const firstChrome = measureFirstChromeRef.current;
      const continuationChrome = measureContinuationChromeRef.current;
      const ending = measureEndingRef.current;
      if (!measureRoot || !firstChrome || !continuationChrome || !ending) return;

      // A régua oculta precisa ter EXATAMENTE a largura útil do corpo renderizado
      // na folha (o editor TipTap tem paddings próprios). Quando as larguras
      // divergem, o texto real fica mais alto que o medido, o preview transborda
      // e a folga de segurança cresce em todas as páginas — foi o que gerava o
      // corte do rodapé em uns ofícios e o espaço em branco enorme em outros.
      const realBody = document.querySelector<HTMLElement>(".oficio-preview-page-body");
      const realWidth = realBody?.clientWidth || 0;
      if (measureShellRef.current && realWidth > 100) {
        measureShellRef.current.style.width = `${realWidth}px`;
      }

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

      // Divide parágrafos longos no ponto exato que cabe na página. Antes, cada
      // <p> era tratado como um bloco indivisível; por isso um parágrafo alto
      // ficava escondido pelo overflow da folha em vez de continuar na próxima.
      const splitBlockToFit = (html: string, maxHeight: number): [string, string] | null => {
        const source = document.createElement("div");
        source.innerHTML = html;
        const block = source.firstElementChild as HTMLElement | null;
        if (!block || !["P", "DIV", "BLOCKQUOTE"].includes(block.tagName)) return null;

        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        const textNodes: Text[] = [];
        let totalLength = 0;
        let current = walker.nextNode();
        while (current) {
          const textNode = current as Text;
          textNodes.push(textNode);
          totalLength += textNode.data.length;
          current = walker.nextNode();
        }
        if (totalLength < 2) return null;

        const pointAt = (absoluteOffset: number) => {
          let traversed = 0;
          for (const node of textNodes) {
            const next = traversed + node.data.length;
            if (absoluteOffset <= next) return { node, offset: absoluteOffset - traversed };
            traversed = next;
          }
          const last = textNodes[textNodes.length - 1];
          return { node: last, offset: last.data.length };
        };

        const sliceBlock = (start: number, end: number) => {
          const range = document.createRange();
          const startPoint = pointAt(start);
          const endPoint = pointAt(end);
          range.setStart(startPoint.node, startPoint.offset);
          range.setEnd(endPoint.node, endPoint.offset);
          const clone = block.cloneNode(false) as HTMLElement;
          clone.appendChild(range.cloneContents());
          return clone.outerHTML;
        };

        // Fonte de verdade ÚNICA: altura REAL medida no container oculto com as
        // mesmas dimensões da folha exportada (A4, mesma fonte/tamanho/entrelinha
        // e mesma largura útil). Nada de heurística de frases/palavras — o corte
        // acontece exatamente no último limite de palavra cuja altura medida
        // ainda cabe na altura útil da página.
        const plainText = block.textContent || "";

        // Limites de quebra permitidos = início de cada palavra (como o Word faz).
        const boundaries: number[] = [];
        for (let i = 1; i < totalLength; i++) {
          if (/\s/.test(plainText[i - 1]) && !/\s/.test(plainText[i])) boundaries.push(i);
        }

        const fits = (offset: number) => measureBlockHeight(sliceBlock(0, offset)) <= maxHeight;

        let splitAt = 0;
        if (boundaries.length > 0) {
          let low = 0;
          let high = boundaries.length - 1;
          while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            if (fits(boundaries[middle])) {
              splitAt = boundaries[middle];
              low = middle + 1;
            } else {
              high = middle - 1;
            }
          }
        }

        // Sem nenhum limite de palavra que caiba (palavra única gigante):
        // corta no caractere exato medido.
        if (splitAt <= 0) {
          let low = 1;
          let high = totalLength - 1;
          while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            if (fits(middle)) {
              splitAt = middle;
              low = middle + 1;
            } else {
              high = middle - 1;
            }
          }
        }

        if (splitAt <= 0 || splitAt >= totalLength) return null;
        return [sliceBlock(0, splitAt), sliceBlock(splitAt, totalLength)];
      };

      // A barra de ferramentas do editor ocupa espaço REAL dentro da 1ª página.
      // Sem descontar isso, o texto ultrapassava a margem inferior na prévia.
      let toolbarHeight = 0;
      if (editable) {
        const editorEl = document.querySelector<HTMLElement>(
          ".oficio-preview-page-body .tiptap-oficio-editor"
        );
        const wrapper = editorEl?.parentElement;
        const maybeToolbar = wrapper?.firstElementChild as HTMLElement | undefined;
        if (maybeToolbar && !maybeToolbar.classList.contains("tiptap-oficio-editor")) {
          toolbarHeight = maybeToolbar.offsetHeight || 0;
        }
      }

      const firstCap = Math.max(120, CONTENT_H - firstChrome.offsetHeight - toolbarHeight - paginationSafety);
      const continuationCap = Math.max(120, CONTENT_H - continuationChrome.offsetHeight - paginationSafety);
      const endingHeight = ending.offsetHeight;

      const nextPages: string[][] = [[]];
      const usedHeights: number[] = [0];
      const pendingBlocks = [...blocks];

      while (pendingBlocks.length > 0) {
        const block = pendingBlocks.shift();
        if (!block) continue;
        const blockHeight = measureBlockHeight(block);
        const currentIndex = nextPages.length - 1;
        const currentCap = currentIndex === 0 ? firstCap : continuationCap;
        const availableHeight = currentCap - usedHeights[currentIndex];

        if (blockHeight <= availableHeight) {
          nextPages[currentIndex].push(block);
          usedHeights[currentIndex] += blockHeight;
          continue;
        }

        if (nextPages[currentIndex].length > 0) {
          nextPages.push([]);
          usedHeights.push(0);
          pendingBlocks.unshift(block);
          continue;
        }

        const split = splitBlockToFit(block, currentCap);
        if (split) {
          const [fittingPart, remainder] = split;
          nextPages[currentIndex].push(fittingPart);
          usedHeights[currentIndex] = measureBlockHeight(fittingPart);
          nextPages.push([]);
          usedHeights.push(0);
          pendingBlocks.unshift(remainder);
        } else {
          // Elementos indivisíveis (imagem/tabela) permanecem juntos.
          nextPages[currentIndex].push(block);
          usedHeights[currentIndex] += blockHeight;
        }
      }

      // Remove a página vazia criada após a última divisão exata.
      if (nextPages.length > 1 && nextPages[nextPages.length - 1].length === 0) {
        nextPages.pop();
        usedHeights.pop();
      }

      const lastIndex = nextPages.length - 1;
      const lastCap = lastIndex === 0 ? firstCap : continuationCap;
      if (usedHeights[lastIndex] + endingHeight > lastCap) {
        // Na exportação, "Atenciosamente" e a assinatura usam keepNext/keepLines:
        // quando não cabem, somente o bloco de encerramento vai para a próxima
        // página. Antes o preview retirava parágrafos inteiros já acomodados,
        // deixando um grande espaço em branco que não existia no PDF/Word.
        nextPages.push([]);
        usedHeights.push(0);
      }

      const normalizedPages = nextPages.map((page) => page.join(""));
      const resolvedPages = normalizedPages.length > 0 ? normalizedPages : ["<p></p>"];

      setBodyPageSegments((prev) => {
        if (prev.length === resolvedPages.length && prev.every((segment, index) => segment === resolvedPages[index])) {
          return prev;
        }
        return resolvedPages;
      });
    }, [editable, effectiveFontSize, effectiveLineSpacing, fmt.fontFamily, paginationSafety]);

    useEffect(() => {
      // If this conteudo change came from the editor (user typing), skip re-pagination
      // to prevent the loop: edit → onContentChange → conteudo prop changes → re-paginate → setContent → duplicate
      if (editorOriginatedChangeRef.current && conteudo === lastConteudoForPaginationRef.current) {
        editorOriginatedChangeRef.current = false;
        return;
      }
      editorOriginatedChangeRef.current = false;
      lastConteudoForPaginationRef.current = conteudo;

      paginateHtml(buildEditorContent(conteudo));
    }, [conteudo, buildEditorContent, paginateHtml, localData, localNumero, localDestinatario, localAssunto, fechamento]);

    // Reflow: após o usuário editar, reavalia se o texto ainda cabe na página
    // (evita parágrafo cortado abaixo da margem inferior).
    useEffect(() => {
      const timer = window.setTimeout(() => {
        paginateHtml(bodyPageSegments.join(""));
      }, 700);
      return () => window.clearTimeout(timer);
    }, [bodyPageSegments, paginateHtml]);

    // Confere as folhas prontas, antes de pintar na tela. Se qualquer conteúdo
    // ultrapassar a caixa útil, aumenta a reserva pela diferença observada e
    // pagina novamente. Isso elimina sobreposição mesmo com diferenças de fonte
    // ou zoom do navegador.
    useLayoutEffect(() => {
      const pages = Array.from(document.querySelectorAll<HTMLElement>(".oficio-preview-content-box"));
      let largestOverflow = 0;
      pages.forEach((page) => {
        largestOverflow = Math.max(largestOverflow, page.scrollHeight - page.clientHeight);
      });
      if (largestOverflow > 1) {
        setPaginationSafety((current) => Math.min(220, current + Math.ceil(largestOverflow) + 12));
      }
    }, [bodyPageSegments, effectiveFontSize, effectiveLineSpacing, localData, localNumero, localDestinatario, localAssunto, fechamento]);

    const handlePageContentChange = useCallback((pageIndex: number, newPageHtml: string) => {
      setBodyPageSegments((prev) => {
        // Skip if content hasn't actually changed for this page
        if (prev[pageIndex] === newPageHtml) return prev;
        const next = [...prev];
        next[pageIndex] = newPageHtml;
        const joined = next.join("");
        // Flag that this content change originated from the editor
        editorOriginatedChangeRef.current = true;
        lastConteudoForPaginationRef.current = joined;
        onContentChange?.(joined);
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

                <div style={{ position: "absolute", top: "34px", left: `${MARGIN_LEFT}px`, right: `${MARGIN_RIGHT}px`, zIndex: 2 }}>
                  {renderHeader()}
                </div>

                <div
                  className="oficio-preview-content-box"
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
                        syncContentWhileFocused
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
