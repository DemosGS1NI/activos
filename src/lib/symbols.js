import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateCode128SVG(code, opts = {}) {
  // create an SVG element and let JsBarcode render into it
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const options = Object.assign(
    {
      format: 'code128',
      width: 2,
      height: 80,
      displayValue: true,
      margin: 10,
    },
    opts
  );
  // JsBarcode mutates the element
  JsBarcode(svg, String(code || ''), options);
  // Ensure accessibility attributes
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Código: ${String(code)}`);
  return svg.outerHTML;
}

export async function generateQRCodeSVG(code, opts = {}) {
  const options = Object.assign(
    {
      type: 'svg',
      width: 300,
      margin: 4,
      errorCorrectionLevel: 'M',
    },
    opts
  );
  return new Promise((resolve, reject) => {
    QRCode.toString(String(code || ''), options, (err, svg) => {
      if (err) return reject(err);
      // `svg` is a string; add role/aria if missing
      if (!svg.includes('role=')) {
        // insert aria-label into the svg tag
        const aria = ` role="img" aria-label="QR: ${escapeHtml(String(code))}"`;
        svg = svg.replace(/^<svg(\s|>)/, `<svg${aria}$1`);
      }
      resolve(svg);
    });
  });
}

function buildWindowTemplate({ title, svg, code, filename }) {
  const safeTitle = escapeHtml(title || 'Símbolo');
  const safeCode = escapeHtml(code || '');
  const safeFile = escapeHtml(filename || 'symbol');
  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      html,body{height:100%;margin:0;font-family:Inter,ui-sans-serif,system-ui, -apple-system, 'Helvetica Neue', Arial}
      .wrap{height:100%;display:flex;flex-direction:column;gap:16px;align-items:center;justify-content:center;padding:20px}
      #symbol{display:flex;align-items:center;justify-content:center}
      .controls{position:fixed;top:12px;right:12px;display:flex;gap:8px}
      button{background:#0f172a;color:#fff;border:0;padding:8px 10px;border-radius:6px;cursor:pointer}
      @media print{.controls{display:none};body{margin:0}}
    </style>
  </head>
  <body>
    <div class="controls">
      <button id="print">Imprimir</button>
      <button id="download-svg">Descargar SVG</button>
      <button id="download-png">Descargar PNG</button>
      <button id="close">Cerrar</button>
    </div>
    <div class="wrap">
      <div id="symbol">${svg}</div>
      <div style="font-size:.95rem;color:#0f172a">${safeCode}</div>
    </div>
    <script>
      (function(){
        const svgEl = document.getElementById('symbol').querySelector('svg');
        document.getElementById('print').addEventListener('click', ()=> window.print());
        document.getElementById('close').addEventListener('click', ()=> window.close());
        document.getElementById('download-svg').addEventListener('click', ()=>{
          try{
            const svg = svgEl.outerHTML;
            const blob = new Blob([svg], {type:'image/svg+xml'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = '${safeFile}.svg'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
          }catch(e){alert('No fue posible descargar SVG');}
        });
        document.getElementById('download-png').addEventListener('click', ()=>{
          try{
            const svg = svgEl.outerHTML;
            const img = new Image();
            const svgBlob = new Blob([svg], {type:'image/svg+xml;charset=utf-8'});
            const url = URL.createObjectURL(svgBlob);
            img.onload = function(){
              const canvas = document.createElement('canvas');
              canvas.width = img.width * 2; // increase resolution
              canvas.height = img.height * 2;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0,0,canvas.width,canvas.height);
              ctx.drawImage(img,0,0,canvas.width,canvas.height);
              URL.revokeObjectURL(url);
              canvas.toBlob(function(blob){
                const u = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = u; a.download = '${safeFile}.png'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
              }, 'image/png');
            };
            img.onerror = function(){ alert('Error al convertir a PNG'); URL.revokeObjectURL(url); };
            img.src = url;
          }catch(e){alert('No fue posible descargar PNG');}
        });
      })();
    </script>
  </body>
</html>
`;
}

export async function openSymbolWindow({ type = 'qr', code = '', title, filename, options } = {}) {
  // Open a window synchronously to avoid popup blockers
  const w = window.open('', '_blank');
  if (!w) {
    alert('El navegador bloqueó la ventana emergente. Permite popups para esta página.');
    return;
  }
  // show temporary message
  try {
    w.document.title = 'Generando…';
    w.document.body.innerText = 'Generando símbolo…';
  } catch (e) {
    // ignore cross-origin write errors
  }

  try {
    let svg;
    if (type === 'code128') {
      svg = generateCode128SVG(code, options);
    } else {
      svg = await generateQRCodeSVG(code, options);
    }
    const html = buildWindowTemplate({ title: title || `${type.toUpperCase()} - ${code}`, svg, code, filename: filename || `asset-${code}` });
    // write the document
    w.document.open();
    w.document.write(html);
    w.document.close();
    // remove opener reference for security
    try { w.opener = null; } catch (_) {}
    w.focus();
  } catch (err) {
    try { w.document.body.innerText = 'Error generando símbolo'; } catch (_) {}
    console.error(err);
    alert('Error al generar el símbolo: ' + (err?.message || err));
  }
}

export default { generateCode128SVG, generateQRCodeSVG, openSymbolWindow };
