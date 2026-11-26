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
