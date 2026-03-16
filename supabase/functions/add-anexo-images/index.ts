import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await _sb.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const formData = await req.formData();
    const docxFile = formData.get("docx") as File | null;
    if (!docxFile) {
      return new Response(JSON.stringify({ error: "docx não enviado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Coletar imagens
    const images: { name: string; data: Uint8Array; type: string }[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("imagem_") && value instanceof File) {
        images.push({
          name: value.name,
          data: new Uint8Array(await value.arrayBuffer()),
          type: value.type,
        });
      }
    }

    if (images.length === 0) {
      // Sem imagens — retornar docx original
      const docxBytes = await docxFile.arrayBuffer();
      return new Response(docxBytes, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      });
    }

    // Processar: abrir o docx (ZIP), adicionar página de anexo com imagens
    const docxBytes = new Uint8Array(await docxFile.arrayBuffer());
    const resultBytes = await addAnexoToDocx(docxBytes, images);

    return new Response(resultBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="oficio_com_anexo.docx"`,
      },
    });

  } catch (e) {
    console.error("add-anexo-images error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Manipulação do DOCX (ZIP) ────────────────────────────────────────────────
async function addAnexoToDocx(
  docxBytes: Uint8Array,
  images: { name: string; data: Uint8Array; type: string }[]
): Promise<Uint8Array> {

  // Importar biblioteca de ZIP para Deno
  const { ZipReader, ZipWriter, BlobReader, BlobWriter, Uint8ArrayReader, Uint8ArrayWriter, TextReader, TextWriter }
    = await import("https://deno.land/x/zipjs@v2.7.52/index.js");

  // ── Ler arquivos do docx original ───────────────────────────────────────
  const zipReader = new ZipReader(new Uint8ArrayReader(docxBytes));
  const entries = await zipReader.getEntries();

  const fileMap = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (!entry.getData) continue;
    const writer = new Uint8ArrayWriter();
    const data = await entry.getData(writer);
    fileMap.set(entry.filename, data);
  }
  await zipReader.close();

  // ── Ler document.xml e rels ─────────────────────────────────────────────
  const docXml = new TextDecoder().decode(fileMap.get("word/document.xml")!);
  const relsXml = new TextDecoder().decode(fileMap.get("word/_rels/document.xml.rels")!);
  const contentTypesXml = new TextDecoder().decode(fileMap.get("[Content_Types].xml")!);

  const W  = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
  const PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture";
  const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";

  // ── Adicionar imagens ao zip e criar rels ────────────────────────────────
  let newRels = relsXml.replace("</Relationships>", "");
  let nextRid = 20; // IDs altos para não conflitar

  const imageRefs: { rId: string; cx: number; cy: number; idx: number }[] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const ext = img.type.includes("png") ? "png" : "jpeg";
    const mediaName = `word/media/anexo_img_${i + 1}.${ext}`;
    fileMap.set(mediaName, img.data);

    const rId = `rIdAnexo${nextRid}`;
    const mimeType = img.type.includes("png")
      ? "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
      : "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

    newRels += `<Relationship Id="${rId}" Type="${mimeType}" Target="media/anexo_img_${i + 1}.${ext}"/>`;
    nextRid++;

    // Tamanho: max 6.5cm largura para caber 2 por linha com gap
    // 1cm = 360000 EMU, 6.5cm = 2340000 EMU
    const maxCx = 2340000;
    const cx = maxCx;
    const cy = Math.round(maxCx * 0.75); // proporção 4:3 como fallback

    imageRefs.push({ rId, cx, cy, idx: i + 1 });
    nextRid++;
  }

  newRels += "</Relationships>";
  fileMap.set("word/_rels/document.xml.rels", new TextEncoder().encode(newRels));

  // ── Gerar XML do Anexo ─────────────────────────────────────────────────
  const makeImageXml = (rId: string, cx: number, cy: number, idx: number) => `
<w:p xmlns:w="${W}" xmlns:wp="${WP}" xmlns:a="${A_NS}" xmlns:pic="${PIC_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:pPr>
    <w:jc w:val="center"/>
    <w:spacing w:before="200" w:after="200"/>
    <w:keepLines/>
  </w:pPr>
  <w:r>
    <w:drawing>
      <wp:inline distT="0" distB="114300" distL="0" distR="0">
        <wp:extent cx="${cx}" cy="${cy}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="${idx + 100}" name="Imagem${idx}"/>
        <wp:cNvGraphicFramePr>
          <a:graphicFrameLocks xmlns:a="${A_NS}" noChangeAspect="1"/>
        </wp:cNvGraphicFramePr>
        <a:graphic xmlns:a="${A_NS}">
          <a:graphicData uri="${PIC_NS}">
            <pic:pic xmlns:pic="${PIC_NS}">
              <pic:nvPicPr>
                <pic:cNvPr id="${idx + 100}" name="Imagem${idx}"/>
                <pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="${rId}"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>`;

  // Build image paragraphs with proper spacing (no blank pages)
  const imageParas: string[] = [];
  for (const ref of imageRefs) {
    imageParas.push(makeImageXml(ref.rId, ref.cx, ref.cy, ref.idx));
  }

  // ── Inserir imagens no document.xml (sem page break forçado) ───────────
  const anexoBlock = imageParas.join("\n");

  // Inserir antes do </w:body>
  const newDocXml = docXml.replace("</w:body>", `${anexoBlock}</w:body>`);
  fileMap.set("word/document.xml", new TextEncoder().encode(newDocXml));

  // ── Atualizar Content_Types para novas extensões ─────────────────────────
  let newCT = contentTypesXml;
  if (!newCT.includes('Extension="jpeg"')) {
    newCT = newCT.replace("</Types>",
      '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>');
  }
  if (!newCT.includes('Extension="png"')) {
    newCT = newCT.replace("</Types>",
      '<Default Extension="png" ContentType="image/png"/></Types>');
  }
  fileMap.set("[Content_Types].xml", new TextEncoder().encode(newCT));

  // ── Reembalar o ZIP ──────────────────────────────────────────────────────
  const zipWriter = new ZipWriter(new Uint8ArrayWriter());
  for (const [filename, data] of fileMap.entries()) {
    await zipWriter.add(filename, new Uint8ArrayReader(data));
  }
  return await zipWriter.close();
}
