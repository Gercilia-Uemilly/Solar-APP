import logoCamara from "@/assets/logo-camara-docx.jpeg";
import logoFabao from "@/assets/logo-fabao-docx.png";
import assinaturaImg from "@/assets/assinatura-fabao-clean.png";

interface PrintData {
  numero: string;
  destinatario: string;
  assunto: string;
  conteudo: string;
  bairro?: string;
  cargoDestinatario?: string;
}

// Convert an image URL (possibly Vite-hashed) to a base64 data URL
async function toDataUrl(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

export async function printOficio(data: PrintData) {
  const hoje = new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataFormatada = `Uberlândia, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;

  const numeroFormatado = data.numero
    ? (data.numero.includes("/") ? data.numero : `${data.numero}/${hoje.getFullYear()}`)
    : "___";

  let assuntoFmt = data.assunto || "___";
  if (data.bairro) assuntoFmt += ` – Bairro ${data.bairro}`;

  const paragraphs = data.conteudo
    .split("\n")
    .map(p => p.trim())
    .filter(Boolean)
    .filter(p => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i))
    .map(p => `<p style="text-indent:1.25cm;margin:0 0 10px 0;font-size:12pt;line-height:1.5;text-align:justify;">${p}</p>`)
    .join("");

  // Convert images to base64 so they work in the print window
  const [logoCamaraB64, logoFabaoB64, assinaturaB64] = await Promise.all([
    toDataUrl(logoCamara),
    toDataUrl(logoFabao),
    toDataUrl(assinaturaImg),
  ]);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ofício GVF nº ${numeroFormatado}</title>
  <style>
    @page {
      size: A4;
      margin: 30mm 20mm 25mm 30mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12pt;
      color: #000;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      position: relative;
      min-height: 100vh;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding: 0 20px;
    }
    .header img { height: 65px; width: auto; object-fit: contain; }
    .date { text-align: right; margin-bottom: 24px; margin-top: 10px; }
    .oficio-num { font-weight: bold; margin-bottom: 24px; }
    .dest { font-weight: bold; margin-bottom: 8px; }
    .assunto { font-weight: bold; margin-bottom: 30px; }
    .saudacao { margin-bottom: 30px; text-indent: 1.25cm; }
    .fechamento { text-indent: 1.25cm; margin-bottom: 30px; margin-top: 20px; }
    .assinatura {
      margin-top: 40px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .assinatura img {
      height: 80px;
      width: auto;
      object-fit: contain;
      margin-bottom: -8px;
      display: block;
      max-width: 80%;
    }
    .assinatura .linha { width: 300px; border-bottom: 1px solid #000; margin-bottom: 4px; }
    .assinatura .nome { font-weight: bold; margin: 0; }
    .assinatura .cargo { margin: 0; }
    .footer {
      margin-top: 30px;
      font-size: 8pt;
      color: #444;
      text-align: center;
      border-top: 1px solid #ccc;
      padding-top: 6px;
    }
    @media screen {
      body { background: #eee; display: flex; justify-content: center; padding: 20px; }
      .page { background: #fff; width: 210mm; padding: 30mm 20mm 20mm 30mm; box-shadow: 0 2px 20px rgba(0,0,0,0.15); }
    }
    @media print {
      body { background: #fff; }
      .page { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <img src="${logoCamaraB64}" alt="Câmara Municipal" />
      <img src="${logoFabaoB64}" alt="Vereador Fabão" />
    </div>

    <p class="date">${dataFormatada}</p>
    <p class="oficio-num">Ofício GVF n° ${numeroFormatado}</p>
    <p class="dest">DESTINATÁRIO: ${data.cargoDestinatario || "Ilmo(a). Sr(a)."} ${data.destinatario || "___"}</p>
    <p class="assunto">ASSUNTO: ${assuntoFmt}</p>
    <p class="saudacao">Excelentíssimo(a) Senhor(a) Secretário(a) Municipal,</p>

    <div class="corpo">${paragraphs}</div>

    <p class="fechamento">Atenciosamente,</p>

    <div class="assinatura">
      <img src="${assinaturaB64}" alt="Assinatura" />
      <div class="linha"></div>
      <p class="nome">FABÃO</p>
      <p class="cargo">Vereador</p>
    </div>

    <div class="footer">
      Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG
    </div>
  </div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
