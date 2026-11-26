// أدوات جغرافية بسيطة (تقريبية)
const R_EARTH = 6371008.8;
const rad = d => d * Math.PI / 180;
function hav(a, b) {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(s));
}
function perimeter(pts, closed = true) {
  let p = 0;
  for (let i = 0; i < pts.length - 1; i++) p += hav(pts[i], pts[i + 1]);
  if (closed && pts.length > 2) p += hav(pts[pts.length - 1], pts[0]);
  return p;
}
function polyArea(pts) {
  if (pts.length < 3) return 0;
  const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lng0 = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const xy = pts.map(p => [rad(p[1] - lng0) * R_EARTH * Math.cos(rad(lat0)), rad(p[0] - lat0) * R_EARTH]);
  let a = 0;
  for (let i = 0; i < xy.length; i++) {
    const j = (i + 1) % xy.length;
    a += xy[i][0] * xy[j][1] - xy[j][0] * xy[i][1];
  }
  return Math.abs(a) / 2;
}
function centroid(pts) {
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}
function parseCoords(text) {
  const pts = [];
  for (const line of (text || '').split(/\n+/)) {
    const m = line.match(/-?\d+(?:[.,]\d+)?/g);
    if (m && m.length >= 2) {
      const la = parseFloat(m[0].replace(',', '.')), ln = parseFloat(m[1].replace(',', '.'));
      if (la >= 20 && la <= 37 && ln >= -18 && ln <= 0) pts.push([la, ln]);
    }
  }
  return pts;
}
// مستطيل بالأمتار حول نقطة (للبيانات التجريبية)
function rectAround(lat, lng, w, h) {
  const dLat = (h / 2) / 111320, dLng = (w / 2) / (111320 * Math.cos(rad(lat)));
  return [[lat - dLat, lng - dLng], [lat - dLat, lng + dLng], [lat + dLat, lng + dLng], [lat + dLat, lng - dLng]];
}
const fmt = n => Math.round(n).toLocaleString('en-US');
const fmtArea = m2 => m2 >= 10000 ? `${(m2 / 10000).toFixed(2)} هكتار (${fmt(m2)} م²)` : `${fmt(m2)} م²`;

// ---------- إحداثيات X,Y : Lambert المغرب (Merchich) ----------
const CRS = {
  nord: '+proj=lcc +lat_1=33.3 +lat_0=33.3 +lon_0=-5.4 +k_0=0.999625769 +x_0=500000 +y_0=300000 +a=6378249.2 +b=6356515 +towgs84=31,146,47,0,0,0,0 +units=m +no_defs',
  sud: '+proj=lcc +lat_1=29.7 +lat_0=29.7 +lon_0=-5.4 +k_0=0.9996155960 +x_0=500000 +y_0=300000 +a=6378249.2 +b=6356515 +towgs84=31,146,47,0,0,0,0 +units=m +no_defs'
};
const CRS_NAMES = { gps: 'GPS (خط العرض, خط الطول)', nord: 'X,Y — Lambert Nord Maroc (المنطقة 1)', sud: 'X,Y — Lambert Sud Maroc (المنطقة 2)' };
function toXY(p, crs) { const r = proj4('WGS84', CRS[crs], [p[1], p[0]]); return [r[0], r[1]]; }
function fromXY(x, y, crs) { const r = proj4(CRS[crs], 'WGS84', [x, y]); return [r[1], r[0]]; }
function polyAreaXY(xy) { let a = 0; for (let i = 0; i < xy.length; i++) { const j = (i + 1) % xy.length; a += xy[i][0] * xy[j][1] - xy[j][0] * xy[i][1]; } return Math.abs(a) / 2; }
// يقرأ أسطر "X Y" (يقبل فاصلة/مسافة/فاصلة منقوطة/تبويب؛ العلامة العشرية نقطة) أو GPS حسب النظام
function parsePoints(text, crs) {
  if (crs === 'gps') return parseCoords(text);
  const pts = [];
  for (const line of (text || '').split(/\n+/)) {
    const n = (line.match(/-?\d+(?:\.\d+)?/g) || []).map(parseFloat);
    const big = n.filter(v => Math.abs(v) >= 1000);
    const xy = big.length >= 2 ? big.slice(0, 2) : null;
    if (!xy) continue;
    const g = fromXY(xy[0], xy[1], crs);
    if (g[0] >= 20 && g[0] <= 37 && g[1] >= -18 && g[1] <= 0) pts.push(g);
  }
  return pts;
}
