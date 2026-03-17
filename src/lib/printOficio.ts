import logoCamara from "@/assets/logo-camara-docx.jpeg";
import logoFabao from "@/assets/logo-fabao-docx.png";
import assinaturaImg from "@/assets/assinatura-1.png";

interface PrintData {
  numero: string;
  destinatario: string;
  assunto: string;
  conteudo: string;
  bairro?: string;
  cargoDestinatario?: string;
  dataGeracao?: string;
  operadorNome?: string;
  operadorEmail?: string;
  telefone?: string;
  secretaria?: string;
}

import { cleanNumero, buildVocativo, formatDateOficio, extrairBairro } from "@/lib/oficioUtils";

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
...
  const [logoCamaraB64, logoFabaoB64, assinaturaB64] = await Promise.all([
    toDataUrl(logoCamara),
    toDataUrl(logoFabao),
    toDataUrl(assinaturaImg),
  ]);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ofício nº ${numeroFormatado}</title>
  <style>
    @page {
      size: A4;
      margin: 30mm 20mm 20mm 30mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      color: #000;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      position: relative;
      min-height: 100vh;
    }
    .page-number {
      position: fixed;
      top: 10mm;
      right: 10mm;
      font-size: 9pt;
      font-family: Arial, Helvetica, sans-serif;
    }
    .header {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 24px;
      margin-bottom: 0;
    }
    .header img { height: 70px; width: auto; object-fit: contain; }
    .date { text-align: right; margin-bottom: 24px; margin-top: 10px; font-size: 11pt; line-height: 1.5; }
    .oficio-num { font-weight: bold; margin-bottom: 16px; font-size: 11pt; line-height: 1.5; }
    .dest { margin-bottom: 0; font-size: 11pt; line-height: 1.5; font-weight: bold; }
    .assunto { margin-bottom: 24px; font-size: 11pt; line-height: 1.5; font-weight: bold; }
    .vocativo { margin-bottom: 16px; margin-top: 0; text-indent: 1.25cm; font-size: 11pt; text-align: left; line-height: 1.5; }
    .fechamento { text-indent: 1.25cm; margin-top: 16px; margin-bottom: 32px; font-size: 11pt; line-height: 1.5; }
    .assinatura {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      page-break-inside: avoid;
      break-inside: avoid;
      line-height: 1.0;
    }
    .assinatura img {
      width: 227px;
      height: auto;
      object-fit: contain;
      margin-bottom: 0;
      display: block;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
    }
    .linha-assinatura {
      display: none;
    }
    .assinatura .nome { font-weight: bold; margin: 0; line-height: 1.0; font-size: 11pt; }
    .assinatura .cargo { margin: 0; line-height: 1.0; font-size: 11pt; }
    .footer {
      margin-top: 80px;
      font-size: 9pt;
      color: #444;
      text-align: center;
      padding-top: 6px;
    }
    .anexo-imagens {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-top: 20px;
    }
    .imagem-item {
      width: 45%;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .imagem-item img {
      width: 100%;
      height: auto;
      display: block;
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
    <div class="page-number">1</div>
    <div class="header">
      <img src="${logoCamaraB64}" alt="Câmara Municipal" />
      <img src="${logoFabaoB64}" alt="Vereador Fabão" />
    </div>

    <p class="date">${dataFormatada}</p>
    <p class="oficio-num">Ofício GVF n° ${numeroFormatado}</p>
    <p class="dest"><span class="dest-label">DESTINATÁRIO: </span>${destinatarioCompleto}</p>
    <p class="assunto">Assunto: ${assuntoFmt}</p>
    <p class="vocativo">${vocativo}</p>

    <div class="corpo">${bodyHtml}</div>

    <p class="fechamento">Atenciosamente,</p>

    <div class="assinatura">
      <img src="${assinaturaB64}" alt="Assinatura" />
      
      <p class="nome">FABÃO</p>
      <p class="cargo">Vereador</p>
    </div>

    <div class="footer">
      Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG
    </div>
  </div>
  <script>
    window.onload = async function() {
      await Promise.all(
        Array.from(document.images)
          .filter(function(img) { return !img.complete; })
          .map(function(img) {
            return new Promise(function(resolve) {
              img.onload = img.onerror = resolve;
            });
          })
      );
      window.print();
    };
  </script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
