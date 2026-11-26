// بيانات تجريبية — ليست معطيات رسمية
const DEMO = [
  { id: 'ARA-000125', title: 'قطعة أرض فلاحية قرب وزان', province: 'وزان', commune: 'نموذج افتراضي', type: 'فلاحية', ownership: 'تحتاج التحقق', titled: 'غير متحقق', price: null, contact: '', c: [34.7967, -5.5778], w: 50, h: 50 },
  { id: 'ARA-000126', title: 'أرض سكنية بحي هادئ', province: 'وزان', commune: 'نموذج افتراضي', type: 'سكنية', ownership: 'تحتاج التحقق', titled: 'محفظة', price: 450000, contact: '', c: [34.8035, -5.5890], w: 20, h: 25 },
  { id: 'ARA-000201', title: 'أرض بالقنيطرة قرب الطريق', province: 'القنيطرة', commune: 'نموذج افتراضي', type: 'سكنية', ownership: 'تحتاج التحقق', titled: 'غير متحقق', price: 780000, contact: '', c: [34.2610, -6.5802], w: 15, h: 20 },
  { id: 'ARA-000310', title: 'أرض تجارية على شارع رئيسي', province: 'الرباط', commune: 'نموذج افتراضي', type: 'تجارية', ownership: 'تحتاج التحقق', titled: 'محفظة', price: 2400000, contact: '', c: [34.0209, -6.8416], w: 20, h: 20 },
  { id: 'ARA-000411', title: 'عقار فلاحي بجماعة مزفرون', province: 'وزان', commune: 'مزفرون', type: 'فلاحية', ownership: 'تحتاج التحقق', titled: 'غير محفظة', price: 120000, contact: '', c: [34.8420, -5.6480], w: 80, h: 60 },
  { id: 'ARA-000512', title: 'بقعة صناعية بطنجة', province: 'طنجة', commune: 'نموذج افتراضي', type: 'صناعية', ownership: 'تحتاج التحقق', titled: 'غير متحقق', price: 3100000, contact: '', c: [35.7595, -5.8340], w: 60, h: 50 }
].map(d => ({ ...d, coords: rectAround(d.c[0], d.c[1], d.w, d.h), demo: true, status: 'approved', area: Math.round(polyArea(rectAround(d.c[0], d.c[1], d.w, d.h))) }));

const DB = {
  get(k, d) { try { const v = localStorage.getItem('araadi_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('araadi_' + k, JSON.stringify(v)); } catch (e) { toast('تعذر الحفظ'); } }
};
function allParcels(includePending = false) {
  const mine = DB.get('ads', []);
  return DEMO.concat(mine.filter(a => includePending || a.status === 'approved'));
}
