const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2400); }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- التنقل ----------
function go(p) {
  $$('.page').forEach(x => x.classList.toggle('active', x.id === 'page-' + p));
  $$('.bottom button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
  if (p === 'map') setTimeout(() => map.invalidateSize(), 50);
  if (p === 'search') renderList();
  if (p === 'sell') renderMyAds();
  if (p === 'buy') renderFavs();
}
$$('.bottom button').forEach(b => b.onclick = () => go(b.dataset.p));

// ---------- الخريطة ----------
const map = L.map('map', { zoomControl: false }).setView([34.55, -5.9], 8);
L.control.zoom({ position: 'bottomleft' }).addTo(map);
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18, attribution: 'Esri World Imagery' });
const lbl = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
const MODES = [['🗺️ خريطة عادية', [osm]], ['🛰️ قمر صناعي', [esri]], ['🛰️ قمر صناعي + أسماء', [esri, lbl]]];
let mode = DB.get('mapmode', 0), active = [];
function setMode(i) {
  active.forEach(l => map.removeLayer(l)); mode = i % MODES.length;
  active = MODES[mode][1]; active.forEach(l => l.addTo(map)); DB.set('mapmode', mode);
  $('#btnLayer').textContent = mode ? '🗺️' : '🛰️';
  $$('#layerbar button').forEach(b => b.classList.toggle('on', +b.dataset.m === mode));
}
setMode(mode);
$$('#layerbar button').forEach(b => b.onclick = () => { setMode(+b.dataset.m); toast(MODES[mode][0]); });
esri.on('tileerror', () => { if (!window._te) { window._te = 1; toast('تعذر تحميل صور القمر الصناعي — تأكد من الإنترنت'); } });
$('#btnLayer').onclick = () => { setMode(mode + 1); toast(MODES[mode][0]); };
$('#btnLocate').onclick = () => {
  if (!navigator.geolocation) return toast('الموقع غير متاح');
  navigator.geolocation.getCurrentPosition(p => { map.setView([p.coords.latitude, p.coords.longitude], 15); L.circleMarker([p.coords.latitude, p.coords.longitude], { radius: 8, color: '#1a73e8' }).addTo(map); }, () => toast('تعذر تحديد موقعك'));
};

const COLORS = { 'سكنية': '#14806b', 'فلاحية': '#7a9a2a', 'تجارية': '#c9a24b', 'صناعية': '#6b6b8a' };
let layer = L.layerGroup().addTo(map);
function drawParcels(filter) {
  layer.clearLayers();
  const list = allParcels().filter(filter || (() => true));
  list.forEach(p => {
    const poly = L.polygon(p.coords, { color: COLORS[p.type] || '#14806b', weight: 2, fillOpacity: .35 }).addTo(layer);
    poly.on('click', () => openSheet(p.id));
    const mk = L.circleMarker(centroid(p.coords), { radius: 7, color: '#fff', weight: 2, fillColor: COLORS[p.type] || '#14806b', fillOpacity: 1 }).addTo(layer);
    mk.on('click', () => openSheet(p.id));
  });
  return list;
}
drawParcels();

$('#q').addEventListener('input', e => {
  const v = e.target.value.trim();
  const list = drawParcels(p => !v || (p.title + p.province + p.commune + p.id + p.type).includes(v));
  if (v && list.length) map.fitBounds(L.latLngBounds(list.flatMap(p => p.coords)), { maxZoom: 15, padding: [40, 40] });
});

// ---------- بطاقة القطعة ----------
const find = id => allParcels(true).find(p => p.id === id);
const favs = () => DB.get('favs', []);
function openSheet(id) {
  const p = find(id); if (!p) return;
  const isFav = favs().includes(id);
  const sh = $('#sheet');
  const per = perimeter(p.coords);
  sh.innerHTML = `<button class="x" onclick="$('#sheet').classList.add('hidden')">✕</button>
  <h3>قطعة أرض رقم ${esc(p.id)}</h3>
  ${p.demo ? '<span class="badge warn">بيانات تجريبية</span>' : '<span class="badge">إعلان مستخدم — غير موثق</span>'}
  <table class="kv">
   <tr><td>العنوان</td><td>${esc(p.title)}</td></tr>
   <tr><td>الإقليم</td><td>${esc(p.province)}</td></tr>
   <tr><td>الجماعة</td><td>${esc(p.commune || '—')}</td></tr>
   <tr><td>المساحة (محسوبة)</td><td>${fmtArea(polyArea(p.coords))}</td></tr>
   <tr><td>المحيط</td><td>${fmt(per)} م</td></tr>
   <tr><td>طبيعة الأرض</td><td>${esc(p.type)} (مقترحة)</td></tr>
   <tr><td>الملكية</td><td>${esc(p.ownership || 'تحتاج التحقق')}</td></tr>
   <tr><td>التحفيظ</td><td>${esc(p.titled || 'غير متحقق')}</td></tr>
   <tr><td>الثمن</td><td>${p.price ? fmt(p.price) + ' د.م' + ' (≈ ' + fmt(p.price / polyArea(p.coords)) + ' د.م/م²)' : 'غير محدد'}</td></tr>
   <tr><td>GPS</td><td dir="ltr">${centroid(p.coords).map(x => x.toFixed(5)).join(', ')}</td></tr>
   <tr><td>X, Y (Lambert Nord)</td><td dir="ltr">${toXY(centroid(p.coords), 'nord').map(x => x.toFixed(2)).join(' , ')}</td></tr>
  </table>
  <div class="btnrow">
   <button class="primary" onclick="toggleFav('${p.id}')">${isFav ? '★ في المفضلة' : '☆ حفظ'}</button>
   <button class="ghost" onclick="analyzeParcel('${p.id}')">🏗️ صالحة للبناء؟</button>
   <button class="ghost" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${centroid(p.coords).join(',')}','_blank')">🧭 الطريق</button>
   ${p.contact ? `<button class="ghost" onclick="location.href='tel:${esc(p.contact)}'">📞 اتصال</button>` : ''}
  </div>
  <p class="muted">⚠️ لا تعتبر هذه البيانات إثباتاً للملكية أو صلاحية البناء. تحقق دائماً لدى المحافظة العقارية (ANCFCC) والوكالة الحضرية.</p>`;
  sh.classList.remove('hidden');
  map.fitBounds(L.latLngBounds(p.coords), { maxZoom: 17, paddingBottomRight: [0, 250] });
}
function toggleFav(id) {
  let f = favs(); f = f.includes(id) ? f.filter(x => x !== id) : f.concat(id);
  DB.set('favs', f); openSheet(id); toast('تم التحديث');
}
function analyzeParcel(id) {
  const p = find(id);
  go('pro'); selectTool('build');
  setTimeout(() => { const el = $('#bArea'); if (el) { el.value = Math.round(polyArea(p.coords)); } }, 50);
}

// ---------- المواطن: قائمة ----------
const provs = [...new Set(DEMO.map(d => d.province))];
provs.forEach(x => $('#fProv').insertAdjacentHTML('beforeend', `<option>${x}</option>`));
['fProv', 'fType', 'fMax'].forEach(i => $('#' + i).addEventListener('input', renderList));
function renderList() {
  const pv = $('#fProv').value, tp = $('#fType').value, mx = +$('#fMax').value || 0;
  const l = allParcels().filter(p => (!pv || p.province === pv) && (!tp || p.type === tp) && (!mx || (p.price && p.price <= mx)));
  $('#list').innerHTML = l.map(p => `<div class="card item"><div><b>${esc(p.title)}</b><br><span class="badge">${esc(p.province)}</span><span class="badge">${esc(p.type)}</span><span class="badge">${fmt(polyArea(p.coords))} م²</span><br><small class="muted">${p.price ? fmt(p.price) + ' د.م' : 'الثمن غير محدد'} · ${p.id}</small></div><button class="primary" onclick="go('map');setTimeout(()=>openSheet('${p.id}'),200)">عرض</button></div>`).join('') || '<p class="muted">لا نتائج.</p>';
}

// ---------- البائع ----------
$('#sellForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const pts = parsePoints(f.coords, f.crs);
  if (pts.length < 3) return toast('أدخل 3 نقاط صحيحة على الأقل وتأكد من نظام الإحداثيات');
  const ads = DB.get('ads', []);
  const id = 'USR-' + String(Date.now()).slice(-6);
  ads.push({ id, title: f.title, province: f.province, commune: f.commune, type: f.type, titled: f.titled, ownership: 'تصريح البائع — غير موثق', price: +f.price || null, contact: f.contact, coords: pts, area: Math.round(polyArea(pts)), status: 'pending', demo: false });
  DB.set('ads', ads);
  e.target.reset(); renderMyAds(); toast('تم الحفظ — في انتظار مراجعة الإدارة');
});
$('#useMeasure').onclick = () => {
  if (!measurePts.length || measurePts.length < 3) return toast('حدد 3 نقاط على الأقل بأداة القياس');
  const c = $('#sCrs').value; $('#sellForm [name=coords]').value = measurePts.map(p => c === 'gps' ? p[0].toFixed(6) + ',' + p[1].toFixed(6) : toXY(p, c).map(v => v.toFixed(2)).join(' ')).join('\n');
};
function renderMyAds() {
  const ads = DB.get('ads', []);
  $('#myAds').innerHTML = ads.map(a => `<div class="card item"><div><b>${esc(a.title)}</b><br><span class="badge ${a.status === 'approved' ? 'ok' : 'warn'}">${a.status === 'approved' ? 'منشور' : 'قيد المراجعة'}</span> <small class="muted">${fmt(a.area)} م² · ${a.id}</small></div><button class="danger" onclick="delAd('${a.id}')">حذف</button></div>`).join('') || '<p class="muted">لا إعلانات بعد.</p>';
}
function delAd(id) { DB.set('ads', DB.get('ads', []).filter(a => a.id !== id)); renderMyAds(); drawParcels(); }

// ---------- المشتري ----------
function renderFavs() {
  const l = favs().map(find).filter(Boolean);
  $('#favs').innerHTML = l.map(p => `<div class="card item"><div><b>${esc(p.title)}</b><br><small class="muted">${esc(p.province)} · ${fmt(polyArea(p.coords))} م²</small></div><div class="btnrow"><button class="ghost" onclick="go('map');setTimeout(()=>openSheet('${p.id}'),200)">عرض</button><button class="danger" onclick="toggleFav2('${p.id}')">✕</button></div></div>`).join('') || '<p class="muted">لا عقارات محفوظة. افتح قطعة على الخريطة واضغط «حفظ».</p>';
  if (l.length >= 2) {
    $('#compare').innerHTML = `<h3>مقارنة</h3><div class="card" style="overflow:auto"><table class="kv"><tr><td></td>${l.map(p => `<td><b>${esc(p.id)}</b></td>`).join('')}</tr>
    <tr><td>المساحة</td>${l.map(p => `<td>${fmt(polyArea(p.coords))} م²</td>`).join('')}</tr>
    <tr><td>الثمن</td>${l.map(p => `<td>${p.price ? fmt(p.price) : '—'}</td>`).join('')}</tr>
    <tr><td>د.م/م²</td>${l.map(p => `<td>${p.price ? fmt(p.price / polyArea(p.coords)) : '—'}</td>`).join('')}</tr>
    <tr><td>النوع</td>${l.map(p => `<td>${esc(p.type)}</td>`).join('')}</tr>
    <tr><td>التحفيظ</td>${l.map(p => `<td>${esc(p.titled)}</td>`).join('')}</tr></table></div>`;
  } else $('#compare').innerHTML = '';
}
function toggleFav2(id) { DB.set('favs', favs().filter(x => x !== id)); renderFavs(); }
