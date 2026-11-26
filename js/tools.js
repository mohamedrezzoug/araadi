// ---------- الأدوات ----------
let measurePts = [], measuring = false, mLayer = L.layerGroup().addTo(map);
const hud = document.createElement('div'); hud.className = 'measure-hud'; $('#page-map').appendChild(hud);

function updateMeasure() {
  mLayer.clearLayers();
  measurePts.forEach(p => L.circleMarker(p, { radius: 5, color: '#c0392b' }).addTo(mLayer));
  if (measurePts.length > 2) L.polygon(measurePts, { color: '#c0392b', fillOpacity: .15 }).addTo(mLayer);
  else if (measurePts.length === 2) L.polyline(measurePts, { color: '#c0392b' }).addTo(mLayer);
  const a = polyArea(measurePts), p = perimeter(measurePts, measurePts.length > 2);
  hud.innerHTML = `📐 النقاط: ${measurePts.length} · المحيط: <b>${fmt(p)} م</b> · المساحة: <b>${fmtArea(a)}</b>
  <div class="btnrow"><button class="ghost" onclick="undoPt()">↩︎ تراجع</button><button class="ghost" onclick="clearMeasure()">🗑️ مسح</button><button class="primary" onclick="stopMeasure()">تم</button></div>`;
  const out = $('#mOut');
  if (out) {
    const crs = ($('#mCrs') || {}).value || 'nord';
    const head = crs === 'gps' ? ['النقطة', 'Lat', 'Lng'] : ['النقطة', 'X (م)', 'Y (م)'];
    let ar = a;
    if (measurePts.length > 2 && crs !== 'gps') ar = polyAreaXY(measurePts.map(q => toXY(q, crs)));
    out.innerHTML = measurePts.length ? `المساحة: <b>${fmtArea(ar)}</b><br>المحيط: <b>${fmt(p)} م</b><br>عدد النقاط: ${measurePts.length}
    <div style="overflow:auto"><table class="kv" dir="ltr" style="text-align:right"><tr>${head.map(x => `<td><b>${x}</b></td>`).join('')}</tr>${ptRows(crs).map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</table></div>` : '';
  }
}
map.on('click', e => { if (!measuring) return; measurePts.push([e.latlng.lat, e.latlng.lng]); updateMeasure(); });
function startMeasure() { measuring = true; go('map'); hud.classList.add('on'); updateMeasure(); toast('اضغط على الخريطة لتحديد زوايا الأرض'); }
function stopMeasure() { measuring = false; hud.classList.remove('on'); }
function undoPt() { measurePts.pop(); updateMeasure(); }
function clearMeasure() { measurePts = []; updateMeasure(); }

let curTool = 'measure';
const T = {};
function selectTool(t) {
  curTool = t;
  $$('#toolTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $('#tool').innerHTML = T[t]();
  if (T[t + 'Init']) T[t + 'Init']();
}
$$('#toolTabs button').forEach(b => b.onclick = () => selectTool(b.dataset.t));

// 📐 قياس
T.measure = () => `<div class="card"><h3>قياس الأراضي والإحداثيات</h3>
<p class="muted">حدد حدود الأرض على الخريطة، أو الصق الإحداثيات (نقطة في كل سطر). النتائج تقريبية وليست بديلاً عن عمل مهندس طبوغرافي.</p>
<label>نظام الإحداثيات<select id="mCrs">${Object.entries(CRS_NAMES).map(([k, v]) => `<option value="${k}" ${k === DB.get('crs', 'nord') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
<div class="btnrow"><button class="primary" onclick="startMeasure()">🗺️ القياس على الخريطة</button></div>
<label>📊 استيراد ملف Excel / CSV (.xlsx .xls .csv)<input id="mXls" type="file" accept=".xlsx,.xls,.csv,.txt" onchange="importXls(this.files[0])"></label>
<label class="check" style="border:0;padding:0"><input type="checkbox" id="mSwap"><span style="font-size:13px;color:var(--mut)">الترتيب في الملف Y ثم X (أو lng ثم lat)</span></label>
<div id="mXlsInfo" class="muted"></div>
<label>أو الصق الإحداثيات (X Y أو lat,lng) — العلامة العشرية نقطة<textarea id="mCoords" rows="5" dir="ltr" placeholder="483581.08 466281.05&#10;483640.20 466300.10&#10;483620.00 466250.30"></textarea></label>
<div class="btnrow"><button class="ghost" onclick="calcCoords()">احسب</button><button class="ghost" onclick="showOnMap()">اعرض على الخريطة</button><button class="ghost" onclick="copyPts()">📋 نسخ</button><button class="ghost" onclick="exportXls()">⬇️ تصدير Excel</button></div>
<div id="mOut" class="res"></div></div>`;
T.measureInit = () => { $('#mCrs').onchange = () => { DB.set('crs', $('#mCrs').value); updateMeasure(); }; updateMeasure(); };
function ptRows(crs) {
  return measurePts.map((p, i) => crs === 'gps' ? [`P${i + 1}`, p[0].toFixed(6), p[1].toFixed(6)] : (xy => [`P${i + 1}`, xy[0].toFixed(2), xy[1].toFixed(2)])(toXY(p, crs)));
}
function copyPts() {
  const crs = $('#mCrs').value, rows = ptRows(crs);
  if (!rows.length) return toast('لا نقاط');
  const txt = rows.map(r => r.join('\t')).join('\n');
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('تم النسخ'), () => { $('#mCoords').value = txt; toast('انسخ النص من الخانة'); });
}
const cellNum = v => { if (typeof v === 'number') return v; if (typeof v === 'string') { const s = v.trim().replace(',', '.'); if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s); } return null; };
async function importXls(f) {
  if (!f) return; const info = $('#mXlsInfo');
  try {
    let rows, sheetName = '';
    if (/\.(csv|txt)$/i.test(f.name)) {
      const lines = (await f.text()).split(/\r?\n/).filter(l => l.trim());
      const d = lines.some(l => l.includes(';')) ? ';' : lines.some(l => l.includes('\t')) ? '\t' : ',';
      rows = lines.map(l => l.split(d)); sheetName = 'CSV';
    } else {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); sheetName = wb.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });
      rows = rows.map(r => r.length === 1 && typeof r[0] === 'string' && /[;\t]/.test(r[0]) ? r[0].split(/[;\t]/) : r);
    }
    let xi = -1, yi = -1, hdr = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const r = rows[i].map(c => String(c ?? '').trim().toLowerCase());
      const fx = r.findIndex(c => ['x', 'e', 'est', 'easting', 'lon', 'long', 'longitude', 'lng'].includes(c));
      const fy = r.findIndex(c => ['y', 'n', 'nord', 'northing', 'lat', 'latitude'].includes(c));
      if (fx >= 0 && fy >= 0) { xi = fx; yi = fy; hdr = i; break; }
    }
    const swap = $('#mSwap').checked, xy = [], gps = [];
    for (let i = hdr + 1; i < rows.length; i++) {
      const r = rows[i]; let a, b;
      if (xi >= 0) { a = cellNum(r[xi]); b = cellNum(r[yi]); }
      else { const ns = r.map(cellNum).filter(v => v !== null); const big = ns.filter(v => Math.abs(v) >= 1000); const p = big.length >= 2 ? big.slice(0, 2) : ns.slice(-2); a = p[0]; b = p[1]; }
      if (a == null || b == null) continue;
      if (swap && xi < 0) [a, b] = [b, a];
      if (Math.abs(a) >= 1000 && Math.abs(b) >= 1000) xy.push([a, b]);
      else if (Math.abs(a) <= 100 && Math.abs(b) <= 100) gps.push(a >= -18 && a <= 0 && b >= 20 && b <= 37 ? [b, a] : [a, b]);
    }
    const sel = $('#mCrs');
    if (xy.length >= gps.length && xy.length) { if (sel.value === 'gps') sel.value = 'nord'; $('#mCoords').value = xy.map(p => p[0] + ' ' + p[1]).join('\n'); }
    else if (gps.length) { sel.value = 'gps'; $('#mCoords').value = gps.map(p => p[0] + ',' + p[1]).join('\n'); }
    else { info.textContent = '⚠️ لم أجد إحداثيات رقمية في أول ورقة. تأكد من وجود عمودين (X وY أو lat وlng).'; return; }
    info.textContent = `📊 ${f.name} — ${xy.length + gps.length} نقطة (${sheetName})`;
    calcCoords();
  } catch (e) { info.textContent = '❌ تعذرت قراءة الملف.'; }
}
function exportXls() {
  if (measurePts.length < 1) return toast('لا نقاط للتصدير');
  const crs = ($('#mCrs').value === 'sud') ? 'sud' : 'nord';
  const rows = [['Point', 'X (' + crs + ')', 'Y (' + crs + ')', 'Lat', 'Lng']].concat(measurePts.map((p, i) => { const q = toXY(p, crs); return ['P' + (i + 1), +q[0].toFixed(2), +q[1].toFixed(2), +p[0].toFixed(6), +p[1].toFixed(6)]; }));
  if (measurePts.length > 2) rows.push([], ['Area m2', +polyAreaXY(measurePts.map(q => toXY(q, crs))).toFixed(1)], ['Perimeter m', +perimeter(measurePts).toFixed(1)]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'ARAADI');
  XLSX.writeFile(wb, 'araadi-coordonnees.xlsx');
}
function calcCoords() {
  const crs = $('#mCrs').value; DB.set('crs', crs);
  const pts = parsePoints($('#mCoords').value, crs);
  if (pts.length < 3) return toast('3 نقاط صحيحة على الأقل (داخل المغرب، وتأكد من النظام المختار)');
  measurePts = pts; updateMeasure();
}
function showOnMap() {
  calcCoords(); if (measurePts.length < 3) return;
  go('map'); map.fitBounds(L.latLngBounds(measurePts), { maxZoom: 18 });
}

// 🤖 ARAADI AI — تحليل محلي للنص (بدون إرسال بياناتك لأي خادم)
const AR_DIG = s => s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const FLAGS = [
  ['رهن', 'يوجد ذكر لرهن — تحقق من رفع الرهن'], ['حجز', 'يوجد ذكر لحجز — تحقق منه قبل أي معاملة'],
  ['ارتفاق', 'يوجد ارتفاق — اقرأ تفاصيله'], ['تحملات', 'توجد تحملات عقارية'],
  ['طريق مبرمجة', 'طريق مبرمجة قد تقتطع جزءاً من الأرض'], ['منطقة خضراء', 'منطقة خضراء — غالباً غير قابلة للبناء'],
  ['منطقة غير قابلة للبناء', 'منطقة غير قابلة للبناء'], ['نزع الملكية', 'ذكر لنزع الملكية'], ['مطلب التحفيظ', 'عقار في طور التحفيظ (مطلب) — ليس محفظاً نهائياً'],
  ['شياع', 'ملكية على الشياع — يلزم موافقة كل الشركاء'], ['مخطط التهيئة', 'يذكر تصميم التهيئة — اطلب مذكرة المعلومات']
];
function extractAreas(t) {
  t = AR_DIG(t).replace(/,/g, '.');
  const out = [], NA = '(?![\\u0621-\\u064A])'; // لا يتبعها حرف عربي (يتجنب "هي" مثلاً)
  let m;
  const r1 = /(\d+(?:\.\d+)?)\s*(?:م²|م2|متر(?:ا)? مربع|m2|m²)/gi; while ((m = r1.exec(t))) out.push({ v: +m[1], raw: m[0] });
  // هكتار + آر + سنتيار (مثال: 1 هكتار 20 آر 50 سنتيار)
  const r2 = new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:هكتار|هـ|ه)' + NA + '\\s*(?:و\\s*)?(?:(\\d+)\\s*(?:آر|ار)' + NA + ')?\\s*(?:و\\s*)?(?:(\\d+)\\s*(?:سنتيار|س)' + NA + ')?', 'g');
  while ((m = r2.exec(t))) { const v = (+m[1]) * 10000 + (+(m[2] || 0)) * 100 + (+(m[3] || 0)); if (v) out.push({ v, raw: m[0].trim() }); }
  const rest = t.replace(r2, ' ');
  // آر + سنتيار (مثال: 6 آر 59 — الرقم الذي يلي «آر» مباشرة يعتبر سنتيار)
  const r3 = new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:آر|ار)' + NA + '\\s*(?:و\\s*)?(\\d{1,2})?(?!\\d)', 'g');
  while ((m = r3.exec(rest))) out.push({ v: +m[1] * 100 + (+(m[2] || 0)), raw: m[0].trim() });
  return out;
}
T.ai = () => `<div class="card"><h3>🤖 ARAADI AI — تحليل الوثائق</h3>
<p class="muted">الصق نص الوثيقة (رسم عقاري، شهادة ملكية، مذكرة معلومات التعمير…). التحليل يتم داخل هاتفك. قراءة الصور (OCR) غير مفعلة في هذه النسخة.</p>
<label>📄 استيراد ملف PDF أو نص (.pdf / .txt)<input id="aiFile" type="file" accept=".pdf,.txt,application/pdf,text/plain" onchange="importDoc(this.files[0])"></label>
<div id="aiFileInfo" class="muted"></div>
<label>نص الوثيقة<textarea id="aiText" rows="8" placeholder="الصق النص هنا…"></textarea></label>
<label>مساحة مرجعية أخرى (م²) — اختياري، للمقارنة<input id="aiRef" type="number"></label>
<div class="btnrow"><button class="primary" onclick="runAI()">حلل</button><button class="ghost" onclick="window.print()">🖨️ طباعة / PDF</button></div>
<div id="aiOut"></div></div>`;
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.min.js';
async function importDoc(f) {
  if (!f) return; const info = $('#aiFileInfo'); info.textContent = '⏳ جاري قراءة الملف…';
  try {
    let text = '';
    if (/\.txt$/i.test(f.name)) text = await f.text();
    else {
      const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
      const n = Math.min(pdf.numPages, 60);
      for (let i = 1; i <= n; i++) {
        const c = await (await pdf.getPage(i)).getTextContent();
        text += c.items.map(x => x.str).join(' ') + '\n';
      }
      info.textContent = `📄 ${f.name} — ${n} صفحة`;
    }
    if (text.trim().length < 20) { info.innerHTML = '⚠️ الملف لا يحتوي على نص قابل للقراءة (غالباً صورة ممسوحة ضوئياً). OCR غير متوفر في هذه النسخة؛ الصق النص يدوياً.'; return; }
    $('#aiText').value = text; info.textContent += ' — تم الاستيراد. راجع النص ثم اضغط «حلل».'; runAI();
  } catch (e) { info.textContent = '❌ تعذرت قراءة الملف (ربما محمي بكلمة سر أو تالف).'; }
}
function runAI() {
  const txt = $('#aiText').value; if (txt.trim().length < 10) return toast('الصق نصاً أطول');
  const areas = extractAreas(txt), ref = +$('#aiRef').value;
  const norm = AR_DIG(txt);
  const titres = [...new Set((norm.match(/(?:رسم عقاري|الرسم العقاري|\bR\.?F\b|titre foncier)[^\d]{0,15}(\d+\s*\/\s*\w+|\d+)/gi) || []))];
  const flags = FLAGS.filter(f => txt.includes(f[0]));
  let html = '<div class="res">';
  html += `<b>المساحات المستخرجة:</b> ${areas.length ? areas.map(a => `${fmt(a.v)} م² <small class="muted">(${esc(a.raw)})</small>`).join(' · ') : 'لم تُعثر على مساحة'}<br>`;
  html += `<b>مراجع الرسم العقاري:</b> ${titres.length ? titres.map(esc).join(' · ') : 'غير مذكورة'}`;
  html += '</div>';
  const vals = areas.map(a => a.v); if (ref) vals.push(ref);
  const uniq = [...new Set(vals.map(v => Math.round(v)))];
  if (uniq.length > 1) {
    const mx = Math.max(...uniq), mn = Math.min(...uniq), diff = (mx - mn) / mx * 100;
    html += `<div class="res ${diff > 1 ? 'bad' : 'warn'}">⚠️ اختلاف في المساحات: من ${fmt(mn)} إلى ${fmt(mx)} م² (فرق ${diff.toFixed(1)}٪). تحقق من الجهة المختصة (المحافظة العقارية / مهندس طبوغرافي).</div>`;
  } else if (uniq.length === 1) html += `<div class="res">✅ لم يظهر تناقض في المساحات المذكورة (${fmt(uniq[0])} م²).</div>`;
  if (flags.length) html += `<div class="res warn"><b>نقاط تستوجب التحقق:</b><ul>${flags.map(f => `<li>${f[1]}</li>`).join('')}</ul></div>`;
  html += '<p class="muted">هذا تحليل آلي للنص فقط، وليس رأياً قانونياً ولا إثباتاً للملكية. المصدر الرسمي: ANCFCC، البوابة الوطنية للتعمير، الوكالة الحضرية والجماعة.</p>';
  $('#aiOut').innerHTML = html;
}

// 🏗️ صلاحية البناء
const ZONES = { 'سكنية كثيفة': [.7, 4], 'سكنية متوسطة': [.6, 3], 'فيلات': [.4, 2], 'تجارية': [.8, 4], 'فلاحية (بناء محدود)': [.05, 1] };
T.build = () => `<div class="card"><h3>هل الأرض صالحة للبناء؟</h3>
<p class="muted">أجب عن الأسئلة، وعدّل الضوابط حسب وثيقة التعمير الرسمية (مذكرة المعلومات من الوكالة الحضرية). القيم الافتراضية مجرد أمثلة.</p>
<label>المساحة (م²)<input id="bArea" type="number" value="200"></label>
<label>نوع المنطقة<select id="bZone">${Object.keys(ZONES).map(z => `<option>${z}</option>`).join('')}</select></label>
<div class="row2"><label>نسبة الاحتلال ٪<input id="bEmp" type="number" value="60"></label><label>عدد الطوابق<input id="bFl" type="number" value="3"></label></div>
${[['bUrb', 'الأرض داخل المدار الحضري أو القروي المعمّر'], ['bPlan', 'مشمولة في تصميم التهيئة / وثيقة تعمير سارية'], ['bRoad', 'لا توجد طريق مبرمجة تقتطع الأرض'], ['bGreen', 'ليست في منطقة خضراء أو غير قابلة للبناء'], ['bAcc', 'لها منفذ وطريق عمومي'], ['bTitle', 'الملكية موثقة (رسم عقاري / عقود)'], ['bServ', 'لا ارتفاقات تمنع البناء']].map(([i, t]) => `<div class="check"><input type="checkbox" id="${i}"><label for="${i}" style="margin:0;color:inherit">${t}</label></div>`).join('')}
<div class="btnrow"><button class="primary" onclick="runBuild()">احسب</button></div><div id="bOut"></div></div>`;
T.buildInit = () => { $('#bZone').onchange = () => { const z = ZONES[$('#bZone').value]; $('#bEmp').value = z[0] * 100; $('#bFl').value = z[1]; }; $('#bZone').onchange(); };
function runBuild() {
  const a = +$('#bArea').value, e = +$('#bEmp').value / 100, f = +$('#bFl').value;
  const ids = ['bUrb', 'bPlan', 'bRoad', 'bGreen', 'bAcc', 'bTitle', 'bServ'];
  const ok = ids.filter(i => $('#' + i).checked).length, miss = ids.filter(i => !$('#' + i).checked);
  const names = { bUrb: 'المدار', bPlan: 'وثيقة التعمير', bRoad: 'الطريق المبرمجة', bGreen: 'المنطقة الخضراء', bAcc: 'الولوج', bTitle: 'الملكية', bServ: 'الارتفاقات' };
  const foot = a * e;
  const cls = ok >= 7 ? '' : ok >= 5 ? 'warn' : 'bad';
  $('#bOut').innerHTML = `<div class="res ${cls}"><div class="bar"><i style="width:${ok / 7 * 100}%"></i></div>
  ${ok}/7 شروط متحقق منها<br>مساحة الاحتلال التقديرية: <b>${fmt(foot)} م²</b><br>المساحة المبنية الإجمالية التقديرية: <b>${fmt(foot * f)} م²</b>
  ${miss.length ? `<br>⚠️ يلزم التحقق من: ${miss.map(i => names[i]).join('، ')}` : '<br>✅ كل الشروط المصرح بها متحققة — يبقى التأكد رسمياً.'}</div>
  <p class="muted">تقدير فقط. رخصة البناء تمنحها الجماعة وفق وثائق التعمير الرسمية.</p>`;
}

// 💰 تقدير الثمن
const PRICE0 = { 'سكنية': 3000, 'فلاحية': 150, 'تجارية': 8000, 'صناعية': 1500 };
T.price = () => {
  const P = DB.get('priceRef', PRICE0);
  return `<div class="card"><h3>تقدير الثمن</h3>
<p class="muted">أدخل أثمنة مرجعية (د.م/م²) من مصادر موثوقة لمنطقتك (إعلانات مماثلة، تقييمات الموثقين…). القيم الافتراضية أمثلة فقط وليست أسعار السوق.</p>
<div class="row2">${Object.keys(P).map(k => `<label>${k} د.م/م²<input class="pr" data-k="${k}" type="number" value="${P[k]}"></label>`).join('')}</div>
<label>المساحة (م²)<input id="pArea" type="number" value="200"></label>
<label>النوع<select id="pType">${Object.keys(P).map(k => `<option>${k}</option>`).join('')}</select></label>
<label>الثمن المعروض (د.م) — اختياري<input id="pAsk" type="number"></label>
<button class="primary" onclick="runPrice()">قدّر</button><div id="pOut"></div></div>`;
};
function runPrice() {
  const P = {}; $$('.pr').forEach(i => P[i.dataset.k] = +i.value); DB.set('priceRef', P);
  const a = +$('#pArea').value, m = P[$('#pType').value] || 0, ask = +$('#pAsk').value;
  let h = `<div class="res">القيمة التقديرية: <b>${fmt(a * m * .8)} – ${fmt(a * m * 1.2)} د.م</b> (وسط ${fmt(a * m)})`;
  if (ask) { const pm = ask / a, d = (pm - m) / m * 100; h += `<br>الثمن المعروض: ${fmt(pm)} د.م/م² — ${d > 20 ? '⚠️ أعلى من المرجع بـ' + d.toFixed(0) + '٪' : d < -20 ? '🔎 أقل من المرجع بـ' + (-d).toFixed(0) + '٪ — تحقق من سبب الفرق' : '✅ ضمن النطاق'}`; }
  $('#pOut').innerHTML = h + '</div>';
}

// ✅ شراء آمن
const SAFE = ['طلب شهادة الملكية من المحافظة العقارية (ANCFCC)', 'مطابقة هوية البائع مع الرسم العقاري', 'التحقق من غياب الرهون والحجوزات والتحملات', 'مقارنة المساحة في الرسم العقاري مع القياس الفعلي', 'تحديد الحدود ميدانياً مع مهندس طبوغرافي', 'طلب مذكرة معلومات التعمير من الوكالة الحضرية/الجماعة', 'التأكد من الطريق والولوج والشبكات (ماء، كهرباء، تطهير)', 'التأكد من غياب نزاعات مع الجيران أو ورثة الشياع', 'تحرير العقد لدى موثق أو عدل مختص', 'أداء الواجبات والتسجيل والتحفيظ بعد الشراء'];
T.safe = () => { const s = DB.get('safe', []); return `<div class="card"><h3>قائمة الشراء الآمن</h3><div class="bar"><i id="sBar" style="width:0"></i></div><div id="sCnt" class="muted" style="margin:6px 0"></div>${SAFE.map((t, i) => `<div class="check"><input type="checkbox" id="s${i}" ${s.includes(i) ? 'checked' : ''} onchange="saveSafe()"><label for="s${i}" style="margin:0;color:inherit">${t}</label></div>`).join('')}</div>`; };
T.safeInit = () => saveSafe(true);
function saveSafe(init) { const s = SAFE.map((_, i) => i).filter(i => $('#s' + i).checked); if (!init) DB.set('safe', s); $('#sBar').style.width = s.length / SAFE.length * 100 + '%'; $('#sCnt').textContent = `${s.length} / ${SAFE.length}`; }

// ⛰️ الانحدار
T.slope = () => `<div class="card"><h3>الانحدار</h3><p class="muted">أدخل ارتفاعين (م) والمسافة الأفقية بينهما.</p>
<div class="row2"><label>الارتفاع الأول<input id="z1" type="number" step="any"></label><label>الارتفاع الثاني<input id="z2" type="number" step="any"></label></div>
<label>المسافة الأفقية (م)<input id="zd" type="number" step="any"></label><button class="primary" onclick="runSlope()">احسب</button><div id="zOut"></div>
<p class="muted">عرض 3D للتضاريس: غير متوفر في هذه النسخة (يتطلب بيانات ارتفاعات DEM).</p></div>`;
function runSlope() { const dz = +$('#z2').value - +$('#z1').value, d = +$('#zd').value; if (!d) return toast('أدخل المسافة'); const s = dz / d * 100; $('#zOut').innerHTML = `<div class="res">الانحدار: <b>${s.toFixed(1)}٪</b> (${(Math.atan(dz / d) * 180 / Math.PI).toFixed(1)}°) — ${Math.abs(s) > 15 ? '⚠️ قوي، قد يرفع كلفة البناء' : Math.abs(s) > 8 ? 'متوسط' : 'خفيف'}</div>`; }

// 🛡️ الإدارة (محلية)
T.admin = () => {
  const ads = DB.get('ads', []);
  return `<div class="card"><h3>مراقبة الإعلانات</h3><p class="muted">نسخة محلية: كل الإعلانات مخزنة في هذا الجهاز. للإدارة الحقيقية متعددة المستخدمين نحتاج خادماً (Supabase).</p>
${ads.map(a => `<div class="card item"><div><b>${esc(a.title)}</b><br><span class="badge ${a.status === 'approved' ? 'ok' : 'warn'}">${a.status === 'approved' ? 'منشور' : 'قيد المراجعة'}</span></div><div class="btnrow">${a.status !== 'approved' ? `<button class="primary" onclick="setStatus('${a.id}','approved')">قبول</button>` : `<button class="ghost" onclick="setStatus('${a.id}','pending')">إخفاء</button>`}<button class="danger" onclick="delAd('${a.id}');selectTool('admin')">حذف</button></div></div>`).join('') || '<p class="muted">لا إعلانات.</p>'}
<h3>نسخ احتياطي</h3><div class="btnrow"><button class="ghost" onclick="exportData()">⬇️ تصدير JSON</button><button class="ghost" onclick="$('#imp').click()">⬆️ استيراد</button><input id="imp" type="file" accept=".json" hidden onchange="importData(this.files[0])"></div></div>`;
};
function setStatus(id, s) { const a = DB.get('ads', []); a.forEach(x => { if (x.id === id) x.status = s; }); DB.set('ads', a); drawParcels(); selectTool('admin'); }
function exportData() {
  const d = {}; Object.keys(localStorage).filter(k => k.startsWith('araadi_')).forEach(k => d[k] = localStorage[k]);
  const u = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' })); const a = document.createElement('a'); a.href = u; a.download = 'araadi-backup.json'; a.click();
}
function importData(f) { if (!f) return; f.text().then(t => { try { const d = JSON.parse(t); Object.keys(d).filter(k => k.startsWith('araadi_')).forEach(k => localStorage.setItem(k, d[k])); drawParcels(); toast('تم الاستيراد'); selectTool('admin'); } catch (e) { toast('ملف غير صالح'); } }); }

selectTool('measure');
