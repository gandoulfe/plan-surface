import { S }                         from './state.js';
import { PDFJS_WORKER }              from './config.js';
import { dist, fmtArea, fmtLength, esc } from './geo.js';

// ── File loading ──────────────────────────────────────────────────────────────
export async function loadPDF(file) {
  const url = URL.createObjectURL(file);
  try {
    const pdf      = await pdfjsLib.getDocument({ url, workerSrc: PDFJS_WORKER }).promise;
    const page     = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const off      = document.createElement('canvas');
    off.width = viewport.width; off.height = viewport.height;
    await page.render({ canvasContext: off.getContext('2d'), viewport }).promise;
    S.image = off; S.imageW = viewport.width; S.imageH = viewport.height;
  } finally { URL.revokeObjectURL(url); }
}

export async function loadImg(file) {
  const url = URL.createObjectURL(file);
  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => { S.image = img; S.imageW = img.naturalWidth; S.imageH = img.naturalHeight; URL.revokeObjectURL(url); resolve(); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image invalide')); };
    img.src = url;
  });
}

// ── Export / Import ───────────────────────────────────────────────────────────
export function exportData() {
  const payload = { version: 1, scale: S.scale, nextId: S.nextId, nextMeasId: S.nextMeasId, polygons: S.polygons, measurements: S.measurements };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  Object.assign(document.createElement('a'), { href: url, download: 'calcul-surface.json' }).click();
  URL.revokeObjectURL(url);
}

// Returns true on success, false on failure
export async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.version !== 1) { alert('Format de fichier incompatible.'); return false; }
    S.scale        = data.scale        ?? null;
    S.polygons     = data.polygons     ?? [];
    S.measurements = data.measurements ?? [];
    S.nextId       = data.nextId       ?? S.nextId;
    S.nextMeasId   = data.nextMeasId   ?? S.nextMeasId;
    return true;
  } catch (err) {
    alert('Impossible d\'importer : ' + err.message);
    return false;
  }
}

// ── Print ─────────────────────────────────────────────────────────────────────
export function printView(canvas) {
  const dataUrl = canvas.toDataURL('image/png');

  const polyRows = S.polygons.map(p =>
    `<tr>
      <td><span style="color:${p.color};font-size:18px">&#9632;</span></td>
      <td>${esc(p.label)}</td>
      <td>${fmtArea(p.area)}</td>
    </tr>`
  ).join('');

  const measRows = S.measurements.map(m => {
    const len = dist(m.pt1, m.pt2);
    return `<tr>
      <td><span style="color:#fbbf24;font-size:14px">\u2014</span></td>
      <td>Mesure ${m.id}</td>
      <td>${S.scale ? fmtLength(len * S.scale) : len.toFixed(1) + ' px'}</td>
    </tr>`;
  }).join('');

  const totalArea = S.polygons.reduce((sum, p) => p.area !== null ? sum + p.area : sum, 0);
  const hasScale  = S.polygons.some(p => p.area !== null);
  const totalRow  = hasScale && S.polygons.length > 1
    ? `<tr style="font-weight:700;background:#f0f0ff">
        <td></td><td>Total</td><td>${fmtArea(totalArea)}</td>
      </tr>` : '';

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="fr"><head>
  <meta charset="UTF-8"><title>Rapport de surface</title>
  <style>
    body  { font-family:system-ui,sans-serif; padding:28px; color:#111; max-width:960px; margin:auto; }
    h1   { font-size:22px; font-weight:700; margin-bottom:18px; }
    img  { max-width:100%; border:1px solid #ccc; border-radius:6px; display:block; }
    table{ width:100%; border-collapse:collapse; margin-top:22px; font-size:13px; }
    th   { background:#f4f4f8; padding:9px 12px; text-align:left; border:1px solid #ddd; font-weight:600; }
    td   { padding:8px 12px; border:1px solid #ddd; vertical-align:middle; }
    tr:nth-child(even) td { background:#fafafa; }
    .footer { margin-top:28px; font-size:11px; color:#666; border-top:1px solid #ddd; padding-top:14px; line-height:1.7; }
    .footer a { color:#4f46e5; }
    .print-btn { margin-top:20px; padding:10px 24px; cursor:pointer; font-size:14px; font-weight:600; background:#4f46e5; color:#fff; border:none; border-radius:8px; }
    @media print { .print-btn { display:none; } }
  </style>
</head><body>
  <h1>Rapport de surface</h1>
  <img src="${dataUrl}" alt="Plan annoté">
  <table>
    <thead><tr><th></th><th>Nom</th><th>Surface / Distance</th></tr></thead>
    <tbody>${polyRows}${totalRow}${measRows}</tbody>
  </table>
  <div class="footer">
    <strong>Mentions légales</strong> &mdash;
    Cet outil est fourni à titre informatif uniquement. Les mesures peuvent être imprécises et ne doivent pas être utilisées à des fins légales ou techniques sans vérification professionnelle. L'auteur décline toute responsabilité. Aucune donnée n'est collectée ou stockée.<br>
    Développé par <strong>David Nazar</strong> &mdash;
    <a href="mailto:nazar.david@gmail.com">nazar.david@gmail.com</a> &mdash;
    <a href="https://twitter.com/gandoulfe" target="_blank" rel="noopener">@gandoulfe</a>
  </div>
  <button class="print-btn" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
</body></html>`);
  win.document.close();
}
