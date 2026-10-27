/**
 * Paridade automática: preview x PDF exportado.
 *
 * Compara, para uma amostra de ofícios:
 *  - número de páginas do preview x número de páginas do PDF;
 *  - margens (topo/esquerda/direita/rodapé) do texto renderizado x do PDF.
 *
 * Execução:
 *   PARITY_OFICIO_IDS="uuid1,uuid2" bunx playwright test e2e/preview-parity.spec.ts
 * Sem IDs, usa os ofícios mais recentes com conteúdo (PARITY_SAMPLE, padrão 5).
 */
import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { writeFileSync, mkdirSync } from "node:fs";

const PT_PER_PX = 72 / 96;
// A4 em pt: 595 x 842. Margens do Word usadas na exportação (2cm/1,34cm).
const TOLERANCIA_PT = 12; // ~0,42 cm — 5% da caixa útil
const AMOSTRA = Number(process.env.PARITY_SAMPLE || 5);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const SESSION = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON || "";
const STORAGE_KEY = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY || "";

async function listarOficios(): Promise<Array<{ id: string; numero: string }>> {
  const fixos = (process.env.PARITY_OFICIO_IDS || "").split(",").map((v) => v.trim()).filter(Boolean);
  if (fixos.length > 0) return fixos.map((id) => ({ id, numero: id }));
  // Sem Supabase configurado (ex.: CI) não há ofícios para auditar: o teste é pulado.
  if (!SUPABASE_URL) return [];

  const token = SESSION ? JSON.parse(SESSION).access_token : ANON;
  const url = `${SUPABASE_URL}/rest/v1/oficios?select=id,numero&conteudo=not.is.null&order=created_at.desc&limit=${AMOSTRA}`;
  const resp = await fetch(url, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!resp.ok) return [];
  return (await resp.json()) as Array<{ id: string; numero: string }>;
}

async function margensDoPdf(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
  const paginas: Array<{ top: number; bottom: number; left: number; right: number }> = [];

  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const { width, height } = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    // Ignora as faixas de cabeçalho/rodapé do Word (logos e número da página):
    // elas vivem na margem e não fazem parte da caixa útil comparada.
    const FAIXA_CHROME = 60;

    for (const item of content.items as Array<any>) {
      if (!item.str || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      if (y < FAIXA_CHROME || y > height - FAIXA_CHROME) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + (item.width || 0));
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + (item.height || 0));
    }

    if (minX === Infinity) continue;
    paginas.push({ top: height - maxY, bottom: minY, left: minX, right: width - maxX });
  }

  return paginas;
}

test.describe("paridade preview x PDF", () => {
  test.setTimeout(180_000);

  test("páginas e margens equivalentes", async ({ page }) => {
    const oficios = await listarOficios();
    test.skip(oficios.length === 0, "Nenhum ofício disponível para auditoria.");

    mkdirSync("reports/parity", { recursive: true });
    const relatorio: string[] = [];
    const falhas: string[] = [];

    await page.goto("/");
    if (STORAGE_KEY && SESSION) {
      await page.evaluate(
        ([key, value]) => window.localStorage.setItem(key as string, value as string),
        [STORAGE_KEY, SESSION],
      );
    }

    for (const oficio of oficios) {
      await page.goto(`/dev/parity?id=${oficio.id}`);
      await page.waitForSelector('[data-testid="parity-root"]', { timeout: 60_000 });
      await page.waitForFunction(() => document.querySelectorAll(".preview-pagina-a4").length > 0);
      await page.waitForTimeout(1500); // aguarda o reflow de paginação estabilizar

      const preview = await page.evaluate(() => {
        const pages = Array.from(document.querySelectorAll<HTMLElement>(".preview-pagina-a4"));
        return pages.map((el) => {
          const box = el.getBoundingClientRect();
          const corpo = el.querySelector<HTMLElement>(".oficio-preview-content-box");
          const style = corpo ? getComputedStyle(corpo) : null;
          return {
            top: style ? parseFloat(style.paddingTop) : 0,
            bottom: style ? parseFloat(style.paddingBottom) : 0,
            left: style ? parseFloat(style.paddingLeft) : 0,
            right: style ? parseFloat(style.paddingRight) : 0,
            overflow: corpo ? corpo.scrollHeight - corpo.clientHeight : 0,
            altura: box.height,
          };
        });
      });

      const base64 = await page.evaluate(async () => window.__parity!.buildPdfBase64());
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const slug = String(oficio.numero || oficio.id).replace(/[^a-zA-Z0-9-]+/g, "-");
      writeFileSync(`reports/parity/oficio-${slug}.pdf`, bytes);

      const pdfDoc = await PDFDocument.load(bytes);
      const paginasPdf = pdfDoc.getPageCount();
      const margensPdf = await margensDoPdf(bytes);

      relatorio.push(`Ofício ${oficio.numero}: preview=${preview.length} páginas, pdf=${paginasPdf} páginas`);

      if (preview.length !== paginasPdf) {
        falhas.push(`Ofício ${oficio.numero}: preview ${preview.length} páginas x PDF ${paginasPdf}`);
      }

      preview.forEach((p, index) => {
        if (p.overflow > 1) {
          falhas.push(`Ofício ${oficio.numero} pág. ${index + 1}: texto ultrapassa a caixa útil em ${p.overflow}px`);
        }
        const pdfPage = margensPdf[index];
        if (!pdfPage) return;
        const comparar = (nome: string, previewPx: number, pdfPt: number) => {
          const previewPt = previewPx * PT_PER_PX;
          const delta = Math.abs(previewPt - pdfPt);
          relatorio.push(`  pág.${index + 1} ${nome}: preview ${previewPt.toFixed(1)}pt x pdf ${pdfPt.toFixed(1)}pt`);
          if (delta > TOLERANCIA_PT) {
            falhas.push(`Ofício ${oficio.numero} pág. ${index + 1}: margem ${nome} difere ${delta.toFixed(1)}pt`);
          }
        };
        comparar("esquerda", preview[index].left, pdfPage.left);
        comparar("direita", preview[index].right, pdfPage.right);
        comparar("topo", preview[index].top, pdfPage.top);

        // O rodapé é uma margem mínima: o texto do PDF nunca pode descer abaixo
        // da margem reservada no preview (o inverso — página que termina antes —
        // é legítimo na última folha).
        const rodapePreviewPt = preview[index].bottom * PT_PER_PX;
        relatorio.push(`  pág.${index + 1} rodapé: preview ${rodapePreviewPt.toFixed(1)}pt x pdf ${pdfPage.bottom.toFixed(1)}pt`);
        if (pdfPage.bottom < rodapePreviewPt - TOLERANCIA_PT) {
          falhas.push(`Ofício ${oficio.numero} pág. ${index + 1}: texto do PDF invade a margem inferior (${pdfPage.bottom.toFixed(1)}pt < ${rodapePreviewPt.toFixed(1)}pt)`);
        }
      });
    }

    writeFileSync("reports/parity/relatorio.txt", relatorio.concat("", falhas).join("\n"));
    expect(falhas, falhas.join("\n")).toEqual([]);
  });
});
