/* ================= آی‌حساب ۲ — حسابداری فروشگاهی حرفه‌ای (آفلاین) =================
   معماری: یک فایل، داده‌ها در IndexedDB، محاسبات انبار/سود با بازپخش رویدادها
   (replay) تا همیشه سازگار بمانند. */

/* ---------- ابزار عمومی ---------- */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- ارقام و اعداد ---------- */
var FA_ZERO = '۰'.charCodeAt(0), AR_ZERO = '٠'.charCodeAt(0);
function nd(x) { /* هر رشته‌ای با ارقام فارسی/عربی/لاتین را به عدد تبدیل می‌کند */
  if (x == null) return 0;
  if (typeof x === 'number') return isFinite(x) ? x : 0;
  var s = String(x).replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - FA_ZERO; })
                   .replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - AR_ZERO; })
                   .replace(/[,،\s]/g, '').replace(/[^\d.\-]/g, '');
  var n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
function faNum(n) {
  if (typeof DB !== 'undefined' && DB && DB.settings && DB.settings.lang === 'en') return String(n);
  return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; });
}
function fn(n) { /* عدد با جداکننده هزارگان و ارقام فارسی */
  var neg = n < 0; n = Math.round(Math.abs(nd(n)));
  var sep = (typeof DB !== 'undefined' && DB && DB.settings && DB.settings.lang === 'en') ? ',' : '٬';
  var s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return faNum((neg ? '-' : '') + s);
}
var PRINTING = false;
function fm(n) {
  if (DB && DB.settings.hideAmts && !PRINTING) return '••••••';
  return fn(n) + ' ' + (DB ? DB.settings.currency : 'تومان');
}

/* ---------- تقویم شمسی (الگوریتم jalaali) ---------- */
function _div(a, b) { return Math.floor(a / b); }
function _mod(a, b) { return a - _div(a, b) * b; }
function jalCal(jy) {
  var breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178],
      bl = breaks.length, gy = jy + 621, leapJ = -14, jp = breaks[0], jm, jump, n, i;
  for (i = 1; i < bl; i += 1) { jm = breaks[i]; jump = jm - jp; if (jy < jm) break; leapJ = leapJ + _div(jump, 33) * 8 + _div(_mod(jump, 33), 4); jp = jm; }
  n = jy - jp;
  leapJ = leapJ + _div(n, 33) * 8 + _div(_mod(n, 33) + 3, 4);
  if (_mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  var leapG = _div(gy, 4) - _div((_div(gy, 100) + 1) * 3, 4) - 150;
  var march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + _div(jump + 4, 33) * 33;
  var leap = _mod(_mod(n + 1, 33) - 1, 4); if (leap === -1) leap = 4;
  return { leap: leap, gy: gy, march: march };
}
function g2d(gy, gm, gd) { return Math.floor(Date.UTC(gy, gm - 1, gd) / 86400000) + 2440588; }
function d2g(jdn) {
  var d = new Date((jdn - 2440588) * 86400000);
  return { gy: d.getUTCFullYear(), gm: d.getUTCMonth() + 1, gd: d.getUTCDate() };
}
function j2d(jy, jm, jd) {
  var r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - _div(jm, 7) * (jm - 7) + jd - 1;
}
function d2j(jdn) {
  var gy = d2g(jdn).gy, jy = gy - 621, r = jalCal(jy), jdn1f = g2d(gy, 3, r.march), k = jdn - jdn1f, jd, jm;
  if (k >= 0) {
    if (k <= 185) { return { jy: jy, jm: 1 + _div(k, 31), jd: _mod(k, 31) + 1 }; }
    k -= 186;
  } else {
    jy -= 1; k += 179; if (r.leap === 1) k += 1;
  }
  return { jy: jy, jm: 7 + _div(k, 30), jd: _mod(k, 30) + 1 };
}
var JM = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function iso2j(iso) {
  var p = String(iso).split('-'); return d2j(g2d(+p[0], +p[1], +p[2]));
}
function j2iso(jy, jm, jd) {
  var g = d2g(j2d(jy, jm, jd));
  return g.gy + '-' + pad2(g.gm) + '-' + pad2(g.gd);
}
function fd(iso) { /* ۱۴۰۳/۰۷/۲۸ */
  if (!iso) return '—';
  var j = iso2j(iso);
  return faNum(j.jy + '/' + pad2(j.jm) + '/' + pad2(j.jd));
}
function fdm(iso) { /* ۲۸ مهر ۱۴۰۳ */
  if (!iso) return '—';
  var j = iso2j(iso);
  return faNum(j.jd) + ' ' + JM[j.jm - 1] + ' ' + faNum(j.jy);
}
function fdt(ts) {
  var d = new Date(ts), iso = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  return fdm(iso) + ' · ' + faNum(pad2(d.getHours()) + ':' + pad2(d.getMinutes()));
}
function parseJal(str) { /* «۱۴۰۳/۰۷/۲۸» یا «1403/7/28» ← ISO یا null */
  if (!str) return null;
  var s = String(str).replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - FA_ZERO; })
                     .replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - AR_ZERO; });
  var m = s.match(/(\d{3,4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (!m) return null;
  var jy = +m[1], jm = +m[2], jd = +m[3];
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  if (jm > 6 && jd > 30) return null;
  return j2iso(jy, jm, jd);
}
function isoOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function todayISO() { return isoOf(new Date()); }
function addDays(iso, n) {
  var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d);
}
function addMonthsISO(iso, n) {
  var j = iso2j(iso), jm = j.jm + n, jy = j.jy;
  while (jm > 12) { jm -= 12; jy += 1; }
  while (jm < 1) { jm += 12; jy -= 1; }
  var maxD = jm <= 6 ? 31 : jm <= 11 ? 30 : (jalCal(jy).leap === 0 ? 30 : 29);
  return j2iso(jy, jm, Math.min(j.jd, maxD));
}
function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
function jalMonthKey(iso) { var j = iso2j(iso); return j.jy * 100 + j.jm; }
function weekdayFa(iso) {
  var names = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  return names[new Date(iso + 'T12:00:00').getDay()];
}

/* ---------- پایگاه داده ---------- */
var DBKEY = 'ihesab2';
var DB = null;
function newId(p) { return (p || 'x') + '_' + (DB.seq++).toString(36) + '_' + Date.now().toString(36); }
function blankDB() {
  return {
    v: 5, seq: 1,
    settings: {
      shopName: 'فروشگاه من', owner: '', phone: '', address: '', logo: '',
      currency: 'تومان', defaultTax: 9, invoiceFooter: 'از خرید شما سپاس‌گزاریم.',
      font: 'tahoma', lang: 'fa', theme: 'auto', hideAmts: false, palette: 'sky', fontSize: 100,
      anim: { effect: 'fade', speed: 'normal' },
      printSize: 'a4', shopLogo: '', lastAutoBackup: 0,
      counters: { sale: 0, purchase: 0, sale_ret: 0, purchase_ret: 0, proforma: 0 },
      lastBackup: 0, sampleLoaded: false
    },
    accounts: [], categories: [], expCats: [], products: [], persons: [],
    invoices: [], stockOps: [], payments: [], expenses: [], incomes: [],
    transfers: [], cheques: [], audit: [],
    warehouses: [{ id: 'wh_default', name: 'انبار اصلی' }],
    users: [], installments: [], journalManual: []
  };
}
function defWh() { return (DB.warehouses && DB.warehouses[0] ? DB.warehouses[0].id : 'wh_default'); }
function whName(id) {
  var w = DB.warehouses.filter(function (x) { return x.id === id; })[0];
  return w ? w.name : '';
}
function migrateDB() {
  /* مهاجرت از نسخه ۲ به ۳: افزودن انبارها، کاربران و اقساط */
  if (!DB.warehouses || !DB.warehouses.length) {
    var dwh = { id: newId('wh'), name: 'انبار اصلی' };
    DB.warehouses = [dwh];
    DB.users = DB.users || [];
    DB.installments = DB.installments || [];
    DB.journalManual = DB.journalManual || [];
    DB.invoices.forEach(function (i) { i.whId = dwh.id; });
    DB.stockOps.forEach(function (o) { o.whId = dwh.id; });
    DB.v = 3;
  }
  if (!DB.v || DB.v < 4) {
    DB.products.forEach(function (p) {
      if (!p.barcodes) p.barcodes = p.barcode ? [p.barcode] : [];
      if (p.img === undefined) p.img = '';
    });
    DB.categories.forEach(function (c) { if (c.parentId === undefined) c.parentId = ''; });
    DB.v = 4;
  }
  if (!DB.v || DB.v < 5) {
    DB.products.forEach(function (p) {
      if (p.packSize === undefined) p.packSize = 0;
      if (p.packName === undefined) p.packName = '';
    });
    DB.stockOps.forEach(function (o) {
      if (o.expiry === undefined) o.expiry = '';
      if (o.batch === undefined) o.batch = '';
    });
    DB.v = 5;
  }
  if (!DB.logins) DB.logins = [];
  if (!DB.recon) DB.recon = [];
  if (!DB.settings.clubToman) DB.settings.clubToman = 10000;
  if (!DB.settings.printSize) DB.settings.printSize = 'a4';
  if (DB.settings.shopLogo === undefined) DB.settings.shopLogo = '';
  if (!DB.settings.lastAutoBackup) DB.settings.lastAutoBackup = 0;
  if (!DB.settings.font) DB.settings.font = 'tahoma';
  if (!DB.settings.lang) DB.settings.lang = 'fa';
  if (!DB.settings.theme) DB.settings.theme = 'auto';
  if (DB.settings.hideAmts === undefined) DB.settings.hideAmts = false;
  if (!DB.settings.palette) DB.settings.palette = 'sky';
  /* طراحی ۷٫۴: پیش‌فرض تازه «آبی آسمانی» است؛ کاربری که هنوز پالت را خودش انتخاب نکرده
     (مقدار سیدی سبز زمردی مانده) یک بار به آبی می‌آید — انتخاب دستی بعدی‌اش دست نمی‌خورد. */
  if (!DB.settings.design74) { if (DB.settings.palette === 'emerald') DB.settings.palette = 'sky'; DB.settings.design74 = 1; }
  if (!DB.settings.fontSize) DB.settings.fontSize = 100;
  if (!DB.settings.anim || typeof DB.settings.anim !== 'object') DB.settings.anim = { effect: 'fade', speed: 'normal' };
  if (['fade', 'slide', 'zoom', 'flip', 'up', 'none'].indexOf(DB.settings.anim.effect) < 0) DB.settings.anim.effect = 'fade';
  if (['slow', 'normal', 'fast'].indexOf(DB.settings.anim.speed) < 0) DB.settings.anim.speed = 'normal';
  if (!DB.v || DB.v < 6) DB.v = 6;
}
/* ===== لایه ذخیره‌سازی نسخه ۶: دیتابیس واقعی IndexedDB =====
   داده اصلی در IndexedDB ذخیره می‌شود (ظرفیت و پایداری بسیار بیشتر از localStorage).
   مهاجرت خودکار: اگر رکوردی در IDB نباشد، داده قدیمی localStorage خوانده و به IDB منتقل می‌شود.
   اگر IndexedDB در دسترس نباشد، فال‌بک کامل به localStorage انجام می‌شود (رفتار نسخه‌های قبلی). */
var IDB_NAME = 'ihesab_db', IDB_STORE = 'kv', IDB_REC = 'maindb';
var __idb = null, __idbOK = false, __saveTimer = null;
function idbOpen(cb) {
  if (__idb) { cb(__idb); return; }
  var req = null;
  try { req = indexedDB.open(IDB_NAME, 1); } catch (e) { cb(null); return; }
  req.onupgradeneeded = function () { try { req.result.createObjectStore(IDB_STORE); } catch (e) {} };
  req.onsuccess = function () { __idb = req.result; cb(__idb); };
  req.onerror = function () { cb(null); };
}
function idbGet(key, cb) {
  idbOpen(function (db) {
    if (!db) { cb(null); return; }
    try {
      var rq = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
      rq.onsuccess = function () { cb(rq.result || null); };
      rq.onerror = function () { cb(null); };
    } catch (e) { cb(null); }
  });
}
function idbPut(key, val, cb) {
  idbOpen(function (db) {
    if (!db) { if (cb) cb(false); return; }
    try {
      var tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(val, key);
      tx.oncomplete = function () { if (cb) cb(true); };
      tx.onerror = function () { if (cb) cb(false); };
      tx.onabort = function () { if (cb) cb(false); };
    } catch (e) { if (cb) cb(false); }
  });
}
function acceptLoadedDB(parsed) {
  if (parsed && (parsed.v >= 2 && parsed.v <= 6)) { DB = parsed; migrateDB(); return true; }
  return false;
}
function seedFreshDB() {
  DB = blankDB();
  DB.accounts.push({ id: newId('acc'), name: 'صندوق فروشگاه', type: 'cash', opening: 0 });
  DB.expCats.push(
    { id: newId('ec'), name: 'اجاره' }, { id: newId('ec'), name: 'حقوق' },
    { id: newId('ec'), name: 'قبوض' }, { id: newId('ec'), name: 'حمل‌ونقل' },
    { id: newId('ec'), name: 'تعمیرات' }, { id: newId('ec'), name: 'تبلیغات' },
    { id: newId('ec'), name: 'بسته‌بندی' }, { id: newId('ec'), name: 'سایر' });
  migrateDB();
}
function loadDB(done) {
  var finish = function () { if (done) done(); };
  if (typeof indexedDB !== 'undefined') {
    idbGet(IDB_REC, function (rec) {
      if (rec && rec.data && acceptLoadedDB(rec.data)) { __idbOK = true; finish(); return; }
      var raw = null;
      try { raw = localStorage.getItem(DBKEY); } catch (e) {}
      if (raw) {
        var p = null;
        try { p = JSON.parse(raw); } catch (e) {}
        if (p && acceptLoadedDB(p)) {
          __idbOK = true;
          idbPut(IDB_REC, { data: DB, savedAt: Date.now(), from: 'localStorage' }, function () { finish(); });
          return;
        }
      }
      seedFreshDB();
      __idbOK = true;
      flushSaveDB();
      finish();
    });
    return;
  }
  try {
    var raw2 = localStorage.getItem(DBKEY);
    if (raw2) { var p2 = JSON.parse(raw2); if (p2 && acceptLoadedDB(p2)) { finish(); return; } }
  } catch (e) { /* داده خراب → شروع تازه */ }
  seedFreshDB();
  saveDB();
  finish();
}
function saveDB() {
  if (__idbOK) {
    if (!__saveTimer) __saveTimer = setTimeout(flushSaveDB, 150);
  } else {
    try { localStorage.setItem(DBKEY, JSON.stringify(DB)); } catch (e) { toast('خطا در ذخیره‌سازی'); }
  }
}
function flushSaveDB() {
  if (__saveTimer) { clearTimeout(__saveTimer); __saveTimer = null; }
  if (!__idbOK || !DB) return;
  idbPut(IDB_REC, { data: DB, savedAt: Date.now() });
}
function audit(action, detail) {
  DB.audit.push({ id: newId('au'), ts: Date.now(), action: action, detail: detail || '' });
  if (DB.audit.length > 500) DB.audit = DB.audit.slice(-500);
}

/* جست‌وجوها */
function prodById(id) { return DB.products.filter(function (p) { return p.id === id; })[0] || null; }
function allBarcodes(p) {
  if (!p) return [];
  if (p.barcodes && p.barcodes.length) return p.barcodes;
  return p.barcode ? [p.barcode] : [];
}
function productByBarcode(code) {
  code = String(code || '');
  return DB.products.filter(function (p) {
    return allBarcodes(p).some(function (b) { return String(b) === code; });
  })[0] || null;
}
function catById(id) { return DB.categories.filter(function (c) { return c.id === id; })[0] || null; }
function catName(id) {
  var c = catById(id); if (!c) return '';
  var par = c.parentId ? catById(c.parentId) : null;
  return par ? par.name + ' ← ' + c.name : c.name;
}
var CAT_ICONS = ['🛒', '🥤', '🍶', '🥛', '🍞', '🧀', '🥚', '🍎', '🍌', '🍇', '🥦', '🥕', '🥩', '🍗', '🐟', '🍚', '🌾', '🥜', '🧂', '🍯', '🥫', '🍰', '🍫', '🍬', '🍦', '☕', '🍵', '🧃', '🍕', '🍔', '🥗', '🧴', '🧼', '🧻', '🪥', '💄', '💅', '👕', '👖', '👟', '👜', '⌚', '💍', '📱', '💻', '🔌', '🔋', '🏠', '🛋️', '🔧', '🚗', '📚', '✏️', '🎁', '🧸', '⚽', '🎮', '💊', '🩺', '🌸', '🐶', '🐱', '🧺', '📦', '⭐', '🔥', '❄️', '🌶️'];
var CAT_ICON_KEYS = [
  [/نوشیدنی|آبمیوه|نوشابه/, '🧃'], [/لبنی/, '🥛'], [/نان|کیک|شیرینی/, '🍞'], [/میوه/, '🍎'], [/سبزی|صیفی/, '🥦'],
  [/گوشت|مرغ/, '🥩'], [/ماهی|دریایی/, '🐟'], [/برنج|غلات|حبوبات/, '🌾'], [/ادویه|چاشنی/, '🧂'], [/تنقلات|خشکبار|آجیل/, '🥜'],
  [/شوینده|شستشو/, '🧼'], [/بهداشت|آرایش/, '🧴'], [/دارو|درمان/, '💊'], [/پوشاک|لباس/, '👕'], [/کفش/, '👟'],
  [/موبایل|گوشی|دیجیتال|الکترونیک/, '📱'], [/لوازم خانگی|خانه/, '🏠'], [/ابزار/, '🔧'], [/خودرو|ماشین/, '🚗'],
  [/کتاب|تحریر/, '📚'], [/اسباب بازی|بازی/, '🧸'], [/ورزش/, '⚽'], [/حیوان|پت/, '🐶'], [/گل/, '🌸'],
  [/ساعت/, '⌚'], [/کیف/, '👜'], [/مواد غذایی|خوراکی|غذا/, '🛒'], [/قهوه|چای/, '☕'], [/بستنی|دسر/, '🍦']
];
function catIcon(c) {
  if (!c) return '📦';
  if (c.icon) return c.icon;
  var n = c.name || '';
  for (var i = 0; i < CAT_ICON_KEYS.length; i++) if (CAT_ICON_KEYS[i][0].test(n)) return CAT_ICON_KEYS[i][1];
  return '📦';
}
function personById(id) { return DB.persons.filter(function (p) { return p.id === id; })[0] || null; }
function accById(id) { return DB.accounts.filter(function (a) { return a.id === id; })[0] || null; }
function catById(id) { return DB.categories.filter(function (c) { return c.id === id; })[0] || null; }
function expCatById(id) { return DB.expCats.filter(function (c) { return c.id === id; })[0] || null; }
function invById(id) { return DB.invoices.filter(function (i) { return i.id === id; })[0] || null; }

/* ---------- داده نمونه ---------- */
function loadSampleData() {
  var t = todayISO();
  function A(name, type, opening) { var a = { id: newId('acc'), name: name, type: type, opening: opening }; DB.accounts.push(a); return a; }
  var cash = DB.accounts[0] || A('صندوق فروشگاه', 'cash', 0);
  var bank = A('حساب بانک ملت', 'bank', 5000000);
  var c1 = { id: newId('cat'), name: 'مواد غذایی' }; DB.categories.push(c1);
  var c2 = { id: newId('cat'), name: 'نوشیدنی' }; DB.categories.push(c2);
  function P(name, code, cat, buy, sell, stock, min) {
    var p = { id: newId('prd'), name: name, code: code, barcode: '', catId: cat.id, buyPrice: buy, sellPrice: sell, wsPrice: Math.round(sell * 0.92), stock: 0, minStock: min, unit: 'عدد', note: '', avgCost: buy };
    DB.products.push(p);
    DB.stockOps.push({ id: newId('so'), pid: p.id, date: t, seq: DB.seq++, kind: 'in', qty: stock, cost: buy, note: 'موجودی اولیه', whId: defWh() });
    return p;
  }
  P('روغن مایع ۱ لیتری', '1001', c1, 78000, 95000, 40, 8);
  P('برنج ایرانی ۵ کیلویی', '1002', c1, 780000, 890000, 15, 4);
  P('شکر ۱ کیلویی', '1003', c1, 52000, 65000, 60, 10);
  P('نوشابه خانواده', '2001', c2, 34000, 45000, 48, 12);
  P('آب معدنی ۱٫۵ لیتری', '2002', c2, 9000, 14000, 90, 20);
  P('ماکارونی ۷۰۰ گرمی', '1004', c1, 28000, 36000, 35, 8);
  function PS(name, kind, phone) { var p = { id: newId('per'), name: name, kind: kind, phone: phone, address: '', opening: 0, creditLimit: 0, note: '' }; DB.persons.push(p); return p; }
  var cust = PS('علی رضایی', 'customer', '09123456789');
  var supp = PS('پخش مرکزی البرز', 'supplier', '02633334455');
  recompute();
  var prods = DB.products;
  createInvoice({ kind: 'sale', personId: cust.id, date: t, items: [{ pid: prods[0].id, qty: 3, price: prods[0].sellPrice, disc: 0 }, { pid: prods[3].id, qty: 2, price: prods[3].sellPrice, disc: 0 }], gdisc: 0, tax: DB.settings.defaultTax, shipping: 0, note: '', paidBy: [{ accId: cash.id, amount: 375000 }] });
  createInvoice({ kind: 'purchase', personId: supp.id, date: addDays(t, -3), items: [{ pid: prods[4].id, qty: 24, price: 9000, disc: 0 }], gdisc: 0, tax: 0, shipping: 15000, note: 'خرید هفتگی', paidBy: [] });
  DB.expenses.push({ id: newId('exp'), catId: DB.expCats[2].id, amount: 850000, date: addDays(t, -2), accId: cash.id, note: 'قبض برق مهر' });
  DB.cheques.push({ id: newId('chq'), dir: 'in', number: '۸۸۴۴۲۱', bank: 'ملت', amount: 1200000, issueDate: t, dueDate: addDays(t, 5), personId: cust.id, status: 'pending', accId: '', payId: '', note: '' });
  DB.settings.sampleLoaded = true;
  audit('داده نمونه', 'داده نمونه بارگذاری شد');
  saveDB();
}

/* ---------- موتور محاسبات: بازپخش رویدادهای انبار ---------- */
var KIND_LABEL = { sale: 'فاکتور فروش', purchase: 'فاکتور خرید', sale_ret: 'برگشت از فروش', purchase_ret: 'برگشت از خرید', proforma: 'پیش‌فاکتور' };
var KIND_SHORT = { sale: 'فروش', purchase: 'خرید', sale_ret: 'برگشت فروش', purchase_ret: 'برگشت خرید', proforma: 'پیش‌فاکتور' };
function invSign(kind) { return kind === 'sale' ? 1 : kind === 'sale_ret' ? -1 : kind === 'purchase' ? -1 : kind === 'purchase_ret' ? 1 : 0; }

var LEDGER_VAL = {};
function recompute() {
  /* موجودی و بهای میانگین موزون هر کالا + بهای تمام‌شده و سود هر فاکتور،
     با بازپخش همه فاکتورهای نهایی و عملیات انبار به ترتیب تاریخ. */
  LEDGER_VAL = {};
  DB.products.forEach(function (p) { p._stock = 0; p._avg = nd(p.buyPrice); p._short = false; p._wh = {}; });
  function whAdd(p, wh, dq) { p._wh[wh] = (p._wh[wh] || 0) + dq; }
  var evs = [];
  DB.invoices.forEach(function (inv) {
    inv.cogs = 0; inv.profit = 0; inv._short = false;
    if (inv.status !== 'final' || inv.kind === 'proforma') return;
    inv.items.forEach(function (it, ix) { evs.push({ date: inv.date, seq: inv.seq, inv: inv, it: it, ix: ix }); });
  });
  DB.stockOps.forEach(function (op) { evs.push({ date: op.date, seq: op.seq, op: op }); });
  evs.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.seq - b.seq); });
  evs.forEach(function (ev) {
    if (ev.op) {
      var p0 = prodById(ev.op.pid); if (!p0) return;
      var wh0 = ev.op.whId || defWh();
      if (ev.op.kind === 'in') {
        var tot = p0._stock + ev.op.qty;
        if (tot > 0) p0._avg = (p0._stock * p0._avg + ev.op.qty * nd(ev.op.cost || p0._avg)) / tot;
        p0._stock = tot; whAdd(p0, wh0, ev.op.qty);
      } else if (ev.op.kind === 'out') { LEDGER_VAL[ev.op.id] = Math.round(ev.op.qty * p0._avg); p0._stock -= ev.op.qty; whAdd(p0, wh0, -ev.op.qty); }
      else if (ev.op.kind === 'adjust') {
        var cur = p0._wh[wh0] || 0;
        LEDGER_VAL[ev.op.id] = Math.round((ev.op.qty - cur) * p0._avg);
        p0._stock += ev.op.qty - cur; p0._wh[wh0] = ev.op.qty;
      } else if (ev.op.kind === 'transfer') {
        var f = ev.op.fromWh || wh0, tw = ev.op.toWh || defWh();
        if (f !== tw) { whAdd(p0, f, -ev.op.qty); whAdd(p0, tw, ev.op.qty); }
      }
      return;
    }
    var inv = ev.inv, it = ev.it, p = prodById(it.pid); if (!p) return;
    var whI = inv.whId || defWh();
    var qty = nd(it.qty), price = nd(it.price);
    if (inv.kind === 'purchase') {
      var t2 = p._stock + qty;
      if (t2 > 0) p._avg = (p._stock * p._avg + qty * price) / t2;
      p._stock = t2; whAdd(p, whI, qty);
    } else if (inv.kind === 'sale') {
      if (qty > (p._wh[whI] || 0)) { p._short = true; inv._short = true; }
      it.cogs = qty * p._avg; inv.cogs += it.cogs; p._stock -= qty; whAdd(p, whI, -qty);
    } else if (inv.kind === 'sale_ret') {
      it.cogs = qty * p._avg; inv.cogs -= it.cogs; p._stock += qty; whAdd(p, whI, qty);
    } else if (inv.kind === 'purchase_ret') {
      if (qty > (p._wh[whI] || 0)) { p._short = true; inv._short = true; }
      p._stock -= qty; whAdd(p, whI, -qty);
    }
  });
  DB.invoices.forEach(function (inv) {
    if (inv.status !== 'final') return;
    var rev = invoiceItemsTotal(inv) - nd(inv.gdisc) + nd(inv.shipping);
    /* فاکتور فروش: سود = درآمد − بهای تمام‌شده.
       برگشت از فروش: سود = −درآمد برگشتی + بهای برگشتی (cogs آن منفی ذخیره شده). */
    if (inv.kind === 'sale') inv.profit = Math.round(rev - inv.cogs);
    else if (inv.kind === 'sale_ret') inv.profit = Math.round(-rev - inv.cogs);
    else inv.profit = 0;
  });
}
function stockOf(p) { return p ? p._stock : 0; }
function whStock(p, whId) { return p && p._wh ? (p._wh[whId || defWh()] || 0) : 0; }
function inventoryValue() {
  var v = 0; DB.products.forEach(function (p) { v += p._stock * p._avg; });
  return Math.round(v);
}

/* ---------- محاسبات فاکتور ---------- */
function lineTotal(it) { return nd(it.qty) * nd(it.price) * (1 - nd(it.disc) / 100); }
function invoiceItemsTotal(inv) {
  var s = 0; inv.items.forEach(function (it) { s += lineTotal(it); });
  return Math.round(s);
}
function invoiceTax(inv) {
  return Math.round((invoiceItemsTotal(inv) - nd(inv.gdisc)) * nd(inv.tax) / 100);
}
function invoiceTotal(inv) {
  return Math.round(invoiceItemsTotal(inv) - nd(inv.gdisc) + invoiceTax(inv) + nd(inv.shipping));
}
function invoicePaid(inv) {
  var s = 0; (inv.paidBy || []).forEach(function (p) { s += nd(p.amount); });
  return s;
}
function invoiceRemain(inv) { return invoiceTotal(inv) - invoicePaid(inv); }

/* ---------- ثبت/ویرایش/ابطال فاکتور ---------- */
function createInvoice(d) {
  var errs = [];
  if (!d.items || !d.items.length) errs.push('فاکتور هیچ قلمی ندارد.');
  (d.items || []).forEach(function (it) { if (!it.pid || nd(it.qty) <= 0) errs.push('قلم نامعتبر در فاکتور.'); });
  if (errs.length) return { ok: false, errs: errs };
  DB.settings.counters[d.kind] = (DB.settings.counters[d.kind] || 0) + 1;
  var inv = {
    id: newId('inv'), seq: DB.seq++, no: DB.settings.counters[d.kind], kind: d.kind,
    personId: d.personId || '', whId: d.whId || defWh(),
    date: d.date || todayISO(), time: new Date().toTimeString().slice(0, 5),
    items: d.items.map(function (it) {
      var p = prodById(it.pid);
      return { pid: it.pid, name: p ? p.name : (it.name || 'کالا'), qty: nd(it.qty), price: nd(it.price), disc: nd(it.disc), cogs: 0 };
    }),
    gdisc: nd(d.gdisc), tax: nd(d.tax), shipping: nd(d.shipping), note: d.note || '',
    seller: d.seller || '', status: 'final',
    paidBy: (d.paidBy || []).filter(function (p) { return nd(p.amount) > 0; })
      .map(function (p) { return { accId: p.accId, amount: nd(p.amount), ref: p.ref || '', date: p.date || '', note: p.note || '' }; }),
    createdAt: Date.now()
  };
  DB.invoices.push(inv);
  recompute();
  audit(KIND_LABEL[d.kind], 'شماره ' + fn(inv.no) + ' · ' + fm(invoiceTotal(inv)));
  saveDB();
  return { ok: true, inv: inv, short: inv._short };
}
function updateInvoice(id, d) {
  var inv = invById(id); if (!inv) return { ok: false, errs: ['فاکتور یافت نشد.'] };
  if (!d.items || !d.items.length) return { ok: false, errs: ['فاکتور هیچ قلمی ندارد.'] };
  inv.personId = d.personId || ''; inv.date = d.date || inv.date;
  if (d.whId) inv.whId = d.whId;
  if (d.seller != null) inv.seller = d.seller;
  inv.items = d.items.map(function (it) {
    var p = prodById(it.pid);
    return { pid: it.pid, name: p ? p.name : (it.name || 'کالا'), qty: nd(it.qty), price: nd(it.price), disc: nd(it.disc), cogs: 0 };
  });
  inv.gdisc = nd(d.gdisc); inv.tax = nd(d.tax); inv.shipping = nd(d.shipping); inv.note = d.note || '';
  inv.paidBy = (d.paidBy || []).filter(function (p) { return nd(p.amount) > 0; })
    .map(function (p) { return { accId: p.accId, amount: nd(p.amount), ref: p.ref || '', date: p.date || '', note: p.note || '' }; });
  recompute();
  audit('ویرایش ' + KIND_LABEL[inv.kind], 'شماره ' + fn(inv.no));
  saveDB();
  return { ok: true, inv: inv, short: inv._short };
}
function voidInvoice(id) {
  var inv = invById(id); if (!inv) return;
  inv.status = 'void';
  recompute();
  audit('ابطال ' + KIND_LABEL[inv.kind], 'شماره ' + fn(inv.no));
  saveDB();
}
function deleteInvoice(id) {
  var inv = invById(id); if (!inv) return;
  DB.invoices = DB.invoices.filter(function (i) { return i.id !== id; });
  recompute();
  audit('حذف ' + KIND_LABEL[inv.kind], 'شماره ' + fn(inv.no));
  saveDB();
}

/* ---------- مانده اشخاص و حساب‌ها ---------- */
function personBalance(pid) {
  var p = personById(pid); if (!p) return 0;
  var b = nd(p.opening);
  DB.invoices.forEach(function (inv) {
    if (inv.personId !== pid || inv.status !== 'final' || inv.kind === 'proforma') return;
    b += invSign(inv.kind) * (invoiceTotal(inv) - invoicePaid(inv));
  });
  DB.payments.forEach(function (pay) {
    if (pay.personId !== pid) return;
    b += (pay.dir === 'receive' ? -1 : 1) * nd(pay.amount);
  });
  return Math.round(b);
}
function accountBalance(accId) {
  var a = accById(accId); if (!a) return 0;
  var b = nd(a.opening);
  DB.invoices.forEach(function (inv) {
    if (inv.status !== 'final' || inv.kind === 'proforma') return;
    var dir = (inv.kind === 'sale' || inv.kind === 'purchase_ret') ? 1 : -1;
    (inv.paidBy || []).forEach(function (p) { if (p.accId === accId) b += dir * nd(p.amount); });
  });
  DB.payments.forEach(function (pay) { if (pay.accId === accId) b += (pay.dir === 'receive' ? 1 : -1) * nd(pay.amount); });
  DB.expenses.forEach(function (e) { if (e.accId === accId) b -= nd(e.amount); });
  DB.incomes.forEach(function (i) { if (i.accId === accId) b += nd(i.amount); });
  DB.transfers.forEach(function (t) {
    if (t.fromId === accId) b -= nd(t.amount);
    if (t.toId === accId) b += nd(t.amount);
  });
  return Math.round(b);
}
function accountsTotal(type) {
  var s = 0;
  DB.accounts.forEach(function (a) { if (!type || a.type === type) s += accountBalance(a.id); });
  return s;
}
function personsDebt(sign) { /* +1: بدهکاران به ما، -1: طلبکاران از ما */
  var s = 0;
  DB.persons.forEach(function (p) {
    var b = personBalance(p.id);
    if (sign > 0 && b > 0) s += b;
    if (sign < 0 && b < 0) s -= b;
  });
  return s;
}

/* ---------- شاخص‌های داشبورد و گزارش ---------- */
function invInRange(inv, from, to) { return inv.date >= from && inv.date <= to; }
function salesSum(from, to, kind) {
  var s = 0;
  DB.invoices.forEach(function (inv) {
    if (inv.status === 'final' && inv.kind === kind && invInRange(inv, from, to)) s += invoiceTotal(inv);
  });
  return s;
}
function profitSum(from, to) {
  var s = 0;
  DB.invoices.forEach(function (inv) {
    if (inv.status === 'final' && (inv.kind === 'sale' || inv.kind === 'sale_ret') && invInRange(inv, from, to)) s += inv.profit || 0;
  });
  return s;
}
function expenseSum(from, to) {
  var s = 0;
  DB.expenses.forEach(function (e) { if (e.date >= from && e.date <= to) s += nd(e.amount); });
  return s;
}
function lowStockList() {
  return DB.products.filter(function (p) { return p._stock <= nd(p.minStock); });
}
/* نزدیک‌ترین تاریخ انقضای ثبت‌شده برای کالا (از رسیدهای ورود) */
function productExpiry(pid) {
  var best = null;
  DB.stockOps.forEach(function (o) {
    if (o.pid === pid && o.kind === 'in' && o.expiry) { if (!best || o.expiry < best) best = o.expiry; }
  });
  if (!best) return null;
  var days = Math.round((new Date(best) - new Date(todayISO())) / 86400000);
  return { date: best, days: days };
}
function expiryAlerts(days) {
  days = days === undefined ? 30 : days;
  var out = [];
  DB.products.forEach(function (p) {
    if (p._stock <= 0) return;
    var ex = productExpiry(p.id);
    if (ex && ex.days <= days) out.push({ p: p, date: ex.date, days: ex.days });
  });
  return out.sort(function (a, b) { return a.days - b.days; });
}
function chequesDue(days) {
  var t = todayISO(), lim = addDays(t, days || 7);
  return DB.cheques.filter(function (c) {
    return c.status === 'pending' && c.dueDate >= addDays(t, -365) && c.dueDate <= lim;
  }).sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; });
}
function topProducts(from, to, n, byProfit) {
  var m = {};
  DB.invoices.forEach(function (inv) {
    if (inv.status !== 'final' || (inv.kind !== 'sale' && inv.kind !== 'sale_ret') || !invInRange(inv, from, to)) return;
    var s = inv.kind === 'sale' ? 1 : -1;
    inv.items.forEach(function (it) {
      if (!m[it.pid]) m[it.pid] = { pid: it.pid, name: it.name, qty: 0, amount: 0, profit: 0 };
      m[it.pid].qty += s * nd(it.qty);
      m[it.pid].amount += s * lineTotal(it);
      m[it.pid].profit += s * (lineTotal(it) - nd(it.cogs));
    });
  });
  var arr = Object.keys(m).map(function (k) { return m[k]; });
  arr.sort(function (a, b) { return (byProfit ? b.profit - a.profit : b.qty - a.qty); });
  return arr.slice(0, n || 5);
}
function monthRange(offset) { /* بازه ماه شمسی جاری با آفست */
  var j = iso2j(todayISO());
  var jm = j.jm + (offset || 0), jy = j.jy;
  while (jm < 1) { jm += 12; jy -= 1; }
  while (jm > 12) { jm -= 12; jy += 1; }
  var lastDay = jm <= 6 ? 31 : jm <= 11 ? 30 : (jalCal(jy).leap === 0 ? 30 : 29);
  return { from: j2iso(jy, jm, 1), to: j2iso(jy, jm, lastDay), jy: jy, jm: jm };
}
function personStatement(pid) { /* گردش حساب شخص: فاکتورها + پرداخت‌های مستقل */
  var rows = [], bal = nd((personById(pid) || {}).opening);
  if (bal) rows.push({ date: '', label: 'مانده اولیه', debit: bal > 0 ? bal : 0, credit: bal < 0 ? -bal : 0, bal: bal });
  var evs = [];
  DB.invoices.forEach(function (inv) {
    if (inv.personId !== pid || inv.status !== 'final' || inv.kind === 'proforma') return;
    evs.push({ date: inv.date, seq: inv.seq, inv: inv });
  });
  DB.payments.forEach(function (pay) { if (pay.personId === pid) evs.push({ date: pay.date, seq: pay.seq || 0, pay: pay }); });
  evs.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.seq - b.seq); });
  evs.forEach(function (ev) {
    if (ev.inv) {
      var inv = ev.inv, s = invSign(inv.kind), tot = invoiceTotal(inv), paid = invoicePaid(inv);
      var d1 = s > 0 ? tot : 0, c1 = s < 0 ? tot : 0;
      bal += s * tot;
      rows.push({ date: inv.date, label: KIND_LABEL[inv.kind] + ' شماره ' + fn(inv.no), debit: d1, credit: c1, bal: bal, invId: inv.id });
      if (paid > 0) {
        bal -= s * paid;
        rows.push({ date: inv.date, label: 'پرداخت بابت فاکتور ' + fn(inv.no), debit: s < 0 ? paid : 0, credit: s > 0 ? paid : 0, bal: bal });
      }
    } else {
      var pay = ev.pay;
      if (pay.dir === 'receive') { bal -= nd(pay.amount); rows.push({ date: pay.date, label: 'دریافت وجه' + (pay.note ? ' · ' + pay.note : ''), debit: 0, credit: nd(pay.amount), bal: bal }); }
      else { bal += nd(pay.amount); rows.push({ date: pay.date, label: 'پرداخت وجه' + (pay.note ? ' · ' + pay.note : ''), debit: nd(pay.amount), credit: 0, bal: bal }); }
    }
  });
  return rows;
}
function productKardex(pid) {
  var evs = [], bal = 0, rows = [];
  DB.invoices.forEach(function (inv) {
    if (inv.status !== 'final' || inv.kind === 'proforma') return;
    inv.items.forEach(function (it) { if (it.pid === pid) evs.push({ date: inv.date, seq: inv.seq, inv: inv, it: it }); });
  });
  DB.stockOps.forEach(function (op) { if (op.pid === pid) evs.push({ date: op.date, seq: op.seq, op: op }); });
  evs.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.seq - b.seq); });
  evs.forEach(function (ev) {
    var inQ = 0, outQ = 0, label = '';
    if (ev.op) {
      label = ev.op.kind === 'in' ? 'رسید ورود' : ev.op.kind === 'out' ? 'حواله خروج' : ev.op.kind === 'transfer' ? 'انتقال بین انبارها' : 'اصلاح موجودی';
      if (ev.op.note) label += ' · ' + ev.op.note;
      if (DB.warehouses.length > 1) {
        label += ' · ' + (ev.op.kind === 'transfer' ? whName(ev.op.fromWh) + ' ← ' + whName(ev.op.toWh) : whName(ev.op.whId || defWh()));
      }
      if (ev.op.kind === 'in') { inQ = nd(ev.op.qty); bal += inQ; }
      else if (ev.op.kind === 'out') { outQ = nd(ev.op.qty); bal -= outQ; }
      else if (ev.op.kind === 'adjust') { bal = nd(ev.op.qty); }
    } else {
      var inv = ev.inv, q = nd(ev.it.qty);
      label = KIND_LABEL[inv.kind] + ' شماره ' + fn(inv.no);
      if (DB.warehouses.length > 1) label += ' · ' + whName(inv.whId || defWh());
      if (inv.kind === 'purchase' || inv.kind === 'sale_ret') { inQ = q; bal += q; }
      else { outQ = q; bal -= q; }
    }
    rows.push({ date: ev.date, label: label, inQ: inQ, outQ: outQ, bal: bal });
  });
  return rows;
}

/* ---------- چارچوب رابط کاربری ---------- */
var MENU = [
  { id: 'dash', t: 'داشبورد', ic: '📊' , g: 'اصلی' },
  { id: 'assistant', t: 'دستیار هوشمند', ic: '🤖' , g: 'اصلی' },
  { id: 'search', t: 'جست‌وجوی فاکتور', ic: '🔎' , g: 'اصلی' },
  { id: 'sale', t: 'فروش', ic: '🧾' , g: 'فروش و انبار' },
  { id: 'buy', t: 'خرید', ic: '🛒' , g: 'فروش و انبار' },
  { id: 'products', t: 'کالاها', ic: '📦' , g: 'فروش و انبار' },
  { id: 'stock', t: 'انبار', ic: '🏭' , g: 'فروش و انبار' },
  { id: 'persons', t: 'اشخاص', ic: '👥' , g: 'مالی و اشخاص' },
  { id: 'finance', t: 'مالی', ic: '💰' , g: 'مالی و اشخاص' },
  { id: 'ledger', t: 'حسابداری دوطرفه', ic: '🧮' , g: 'مالی و اشخاص' },
  { id: 'cheques', t: 'چک‌ها', ic: '💳' , g: 'مالی و اشخاص' },
  { id: 'users', t: 'کاربران', ic: '👤' , g: 'سیستم' },
  { id: 'reports', t: 'گزارش‌ها', ic: '📈' , g: 'سیستم' },
  { id: 'backup', t: 'پشتیبان‌گیری', ic: '💾' , g: 'سیستم' },
  { id: 'settings', t: 'تنظیمات', ic: '⚙️' , g: 'سیستم' }
];
var cur = 'dash', curArg = null;

function toast(msg) {
  if (typeof document === 'undefined') return;
  var t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  $('#toastRoot').appendChild(t);
  setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 300); }, 2400);
}
var __savedScrollY = 0, __wasLocked = false;
function syncScrollLock() {
  try {
    var locked = !!($('#modalRoot') && $('#modalRoot').children.length) ||
      !!($('#drawer') && $('#drawer').classList.contains('open')) ||
      !!document.getElementById('calOv') || !!document.getElementById('lockOv');
    var b = document.body;
    if (locked && !__wasLocked) {
      __savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      b.classList.add('noScroll');
      b.style.top = (-__savedScrollY) + 'px';
    } else if (!locked && __wasLocked) {
      b.classList.remove('noScroll');
      b.style.top = '';
      try { window.scrollTo(0, __savedScrollY); } catch (e) {}
    }
    __wasLocked = locked;
  } catch (e) {}
}
function inScroller(el) {
  var n = el;
  while (n && n !== document.body) {
    try {
      var st = window.getComputedStyle(n);
      if ((st.overflowY === 'auto' || st.overflowY === 'scroll') && n.scrollHeight > n.clientHeight) return true;
    } catch (e) {}
    n = n.parentElement;
  }
  return false;
}
if (typeof document !== 'undefined' && !window.__touchLockWired) {
  window.__touchLockWired = true;
  document.addEventListener('touchmove', function (e) {
    if (!document.body.classList.contains('noScroll')) return;
    if (!inScroller(e.target)) e.preventDefault();
  }, { passive: false });
}
function openModal(title, bodyHtml, buttons) {
  var root = $('#modalRoot');
  root.innerHTML = '<div class="mScrim"><div class="mBox"><h3>' + esc(title) + '</h3><div class="mBody">' + bodyHtml + '</div><div class="mActions"></div></div></div>';
  var box = root.querySelector('.mBox'), acts = root.querySelector('.mActions');
  function close() { root.innerHTML = ''; syncScrollLock(); }
  syncScrollLock();
  root.querySelector('.mScrim').addEventListener('click', function (e) { if (e.target.className === 'mScrim') close(); });
  (buttons || [{ label: 'بستن' }]).forEach(function (b) {
    var btn = document.createElement('button');
    btn.className = 'btn ' + (b.cls || 'gray'); btn.textContent = trBtn(b.label);
    btn.addEventListener('click', function () { if (b.cb) b.cb(close); else close(); });
    acts.appendChild(btn);
  });
  return close;
}
function trBtn(label) {
  var s = String(label || '');
  if (tr(s) !== s) return tr(s);
  try {
    var stripped = s.replace(/^[^\u0600-\u06FF\w\d\s]+/u, '').trim();
    if (stripped && stripped !== s.trim() && tr(stripped) !== stripped) return s.replace(stripped, tr(stripped));
  } catch (e) {}
  return s;
}
function modalOpen() { return $('#modalRoot').innerHTML !== ''; }
function uiConfirm(msg, okLabel) {
  return new Promise(function (res) {
    openModal('تأیید', '<p>' + esc(msg) + '</p>', [
      { label: okLabel || 'بله، انجام شود', cls: '', cb: function (c) { c(); res(true); } },
      { label: 'انصراف', cls: 'gray', cb: function (c) { c(); res(false); } }
    ]);
  });
}
function openDrawer(o) {
  $('#drawer').classList.toggle('open', o);
  $('#drawerScrim').classList.toggle('open', o);
  syncScrollLock();
  if (o) { try { updateDrawerStats(); } catch (e) {} }
}
function updateDrawerStats() {
  var el = $('#drawerStats');
  if (!el || typeof DB === 'undefined' || !DB) return;
  var t = todayISO(), sales = 0, cnt = 0;
  (DB.invoices || []).forEach(function (inv) {
    if (inv.status !== 'final' || inv.date !== t) return;
    if (inv.kind === 'sale') { sales += invoiceTotal(inv); cnt++; }
    else if (inv.kind === 'sale_ret') sales -= invoiceTotal(inv);
  });
  el.innerHTML = '<div class="dStat"><span>فروش امروز</span><b>' + (DB.settings.hideAmts ? '••••••' : fm(sales)) + '</b></div>' +
    '<div class="dStat"><span>فاکتور امروز</span><b>' + faNum(cnt) + '</b></div>';
}
function show(id, arg) {
  try { applyAnim(); } catch (e) {}
  if (typeof pageBack !== 'undefined' && pageBack) { pageBack = null; D = null; }
  if (typeof canSee === 'function' && !canSee(id)) { toast('به این بخش دسترسی ندارید'); id = 'dash'; }
  cur = id; curArg = arg || null;
  openDrawer(false);
  var m = MENU.filter(function (x) { return x.id === id; })[0];
  $('#topTitle').textContent = m ? tr(m.t) : 'آی‌حساب';
  $$('#bottomnav button').forEach(function (b) { b.classList.toggle('active', b.dataset.id === id); });
  $('#drawerShop').textContent = DB.settings.shopName || 'فروشگاه من';
  $$('#drawerMenu .dItem').forEach(function (b) { b.classList.toggle('active', b.dataset.id === id); });
  $('#fab').classList.toggle('show', id === 'dash' || id === 'sale');
  var R = { dash: renderDash, assistant: renderAssistant, search: renderSearch, sale: renderSale, buy: renderBuy, products: renderProducts, stock: renderStock, persons: renderPersons, finance: renderFinance, ledger: renderLedger, cheques: renderCheques, users: renderUsers, reports: renderReports, backup: renderBackup, settings: renderSettings };
  $('#view').innerHTML = '';
  (R[id] || renderDash)(arg);
  window.scrollTo(0, 0);
  var vv = $('#view');
  if (vv) { vv.classList.remove('enter'); void vv.offsetWidth; vv.classList.add('enter'); }
}
function refresh() { show(cur, curArg); }
function handleBack() {
  if (typeof scanStop !== 'undefined' && scanStop) { scanStop(); return false; }
  if (modalOpen()) { $('#modalRoot').innerHTML = ''; return false; }
  if (typeof pageBack !== 'undefined' && pageBack) { pageBack(); return false; }
  if ($('#drawer').classList.contains('open')) { openDrawer(false); return false; }
  if (cur !== 'dash') { show('dash'); return false; }
  return true;
}

/* ---------- پل چاپ و اشتراک‌گذاری ---------- */
function doPrint(html) {
  var doc = '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>' +
    'body{font-family:Tahoma,sans-serif;direction:rtl;color:#111}' +
    'table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:6px 8px;font-size:13px;text-align:right}' +
    'th{background:#eee}.h{text-align:center;margin-bottom:6px}.t{font-size:19px;font-weight:bold}' +
    '.row{display:flex;justify-content:space-between;padding:2px 0;font-size:13px}.tot{font-weight:bold;font-size:15px;border-top:2px solid #111;margin-top:6px;padding-top:6px}' +
    '</style></head><body>' + html + '</body></html>';
  if (typeof Android !== 'undefined' && Android.printHtml) { Android.printHtml(doc); }
  else {
    var w = window.open('', '_blank');
    if (w) { w.document.write(doc); w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 300); }
    else toast('پنجره چاپ مسدود شد');
  }
}
function doShareText(text) {
  if (typeof Android !== 'undefined' && Android.shareText) { Android.shareText(text); return; }
  if (navigator.share) { navigator.share({ text: text }).catch(function () {}); }
  else toast('اشتراک‌گذاری در این دستگاه پشتیبانی نمی‌شود');
}
/* ---------- اسکنر بارکد و QR (نسخه ۷٫۶) ----------
   لایه انتزاعی تشخیص‌گر: Scanner.decoder قراردادی دارد —
   decoder.start(video, stream, onResult) => stopFn و onResult(text, {qr, format}).
   در تست‌ها می‌توان Scanner.decoder را با نمونه جعلی جایگزین کرد.
   ترتیب انتخاب خودکار: BarcodeDetector داخلی گوشی ← کتابخانه محلی ZXing ← فقط ورود دستی. */
var scanStop = null;
var _scanBeepCtx = null;
var Scanner = {
  decoder: null,
  _formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],

  _makeDecoder: function () {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      return {
        name: 'native',
        start: function (video, stream, onResult) {
          var det = new window.BarcodeDetector({ formats: Scanner._formats });
          var alive = true, busy = false;
          (function tick() {
            if (!alive) return;
            if (!busy && video.readyState >= 2) {
              busy = true;
              det.detect(video).then(function (codes) {
                busy = false;
                if (alive && codes && codes.length && codes[0].rawValue) {
                  var f = String(codes[0].format || '');
                  onResult(String(codes[0].rawValue), { qr: f === 'qr_code', format: f });
                }
                if (alive) setTimeout(tick, 120);
              }).catch(function () { busy = false; if (alive) setTimeout(tick, 250); });
            } else setTimeout(tick, 120);
          })();
          return function () { alive = false; };
        }
      };
    }
    if (typeof ZXing !== 'undefined' && ZXing.BrowserMultiFormatReader) {
      return {
        name: 'zxing',
        start: function (video, stream, onResult) {
          var hints = new Map();
          try {
            hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
              ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8,
              ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E,
              ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39,
              ZXing.BarcodeFormat.QR_CODE]);
            hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
          } catch (e) {}
          var reader = new ZXing.BrowserMultiFormatReader(hints, 250);
          reader.decodeFromStream(stream, video, function (res) {
            if (res) {
              var isQr = false;
              try { isQr = res.getBarcodeFormat() === ZXing.BarcodeFormat.QR_CODE; } catch (e) {}
              onResult(String(res.getText()), { qr: isQr, format: isQr ? 'qr_code' : 'barcode' });
            }
          }).catch(function () {});
          return function () { try { reader.reset(); } catch (e) {} };
        }
      };
    }
    return null;
  },

  _feedback: function (ok) {
    try { if (navigator.vibrate) navigator.vibrate(ok ? 45 : [30, 40, 30]); } catch (e) {}
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      _scanBeepCtx = _scanBeepCtx || new AC();
      if (_scanBeepCtx.state === 'suspended') _scanBeepCtx.resume();
      var o = _scanBeepCtx.createOscillator(), g = _scanBeepCtx.createGain();
      o.frequency.value = ok ? 1320 : 420; g.gain.value = 0.05;
      o.connect(g); g.connect(_scanBeepCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, _scanBeepCtx.currentTime + 0.12);
      o.stop(_scanBeepCtx.currentTime + 0.13);
    } catch (e) {}
  },

  /* opts: { title, continuous, mode:'lookup'|'field', onCode(code, ctl), onCreate(code), onClose() }
     ctl:  { close(), note(msg, 'ok'|'err'), unknown(code), setCount(n) } */
  open: function (opts) {
    opts = opts || {};
    var continuous = !!opts.continuous;
    var mode = opts.mode || 'lookup';
    var onCode = opts.onCode || function () {};
    if (scanStop) { try { scanStop(); } catch (e) {} }

    var ov = document.createElement('div');
    ov.className = 'scanSheet';
    ov.innerHTML =
      '<div class="scanHead">' +
        '<span class="scanTitle">' + esc(opts.title || 'اسکن بارکد') + '</span>' +
        '<button type="button" class="scanIconBtn" id="scTorch" style="display:none" title="چراغ‌قوه">🔦</button>' +
        '<button type="button" class="scanIconBtn" id="scClose" title="بستن">✕</button>' +
      '</div>' +
      '<div class="scanStage">' +
        '<video id="scVideo" autoplay playsinline muted></video>' +
        '<div class="scanFrame"><i class="fc1"></i><i class="fc2"></i><i class="fc3"></i><i class="fc4"></i><span class="scanLine"></span></div>' +
        '<div class="scanMsg" id="scMsg" style="display:none"></div>' +
      '</div>' +
      '<div class="scanBar">' +
        '<div class="scanStatus" id="scStatus">بارکد یا QR را روبه‌روی دوربین بگیرید…</div>' +
        '<div class="scanUnknown" id="scUnknown" style="display:none"></div>' +
        '<div class="scanManual">' +
          '<input id="scManualInp" placeholder="یا کد را دستی وارد کنید…" autocomplete="off">' +
          '<button type="button" class="btn" id="scManualBtn">ثبت کد</button>' +
        '</div>' +
        (continuous ? '<div class="scanCount" id="scCount"></div>' : '') +
      '</div>';
    document.body.appendChild(ov);
    syncScrollLock();

    var video = ov.querySelector('#scVideo');
    var statusEl = ov.querySelector('#scStatus');
    var unknownEl = ov.querySelector('#scUnknown');
    var msgEl = ov.querySelector('#scMsg');
    var countEl = ov.querySelector('#scCount');
    var stream = null, decoderStop = null, closed = false, paused = false;
    var lastText = '', lastAt = 0, delivered = 0;

    function setStatus(msg, kind) {
      statusEl.textContent = msg;
      statusEl.className = 'scanStatus' + (kind ? ' ' + kind : '');
    }
    function close() {
      if (closed) return;
      closed = true;
      if (decoderStop) { try { decoderStop(); } catch (e) {} decoderStop = null; }
      if (stream) { stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); stream = null; }
      ov.remove();
      if (scanStop === close) scanStop = null;
      syncScrollLock();
      if (opts.onClose) { try { opts.onClose(); } catch (e) {} }
    }
    scanStop = close;
    ov.querySelector('#scClose').onclick = close;

    var ctl = {
      close: close,
      note: function (msg, kind) {
        setStatus(msg, kind || '');
        Scanner._feedback(kind !== 'err');
        if (countEl) countEl.textContent = delivered ? ('اسکن‌های انجام‌شده: ' + faNum(delivered)) : '';
      },
      unknown: function (code) {
        paused = true;
        unknownEl.style.display = '';
        unknownEl.innerHTML = '<div>کالایی با کد <b class="scUnkCode"></b> پیدا نشد.</div>' +
          '<div class="row">' +
          (opts.onCreate ? '<button type="button" class="btn sm" id="scUnkCreate">＋ ساخت کالای جدید با این بارکد</button>' : '') +
          '<button type="button" class="btn gray sm" id="scUnkNext">ادامه اسکن</button></div>';
        unknownEl.querySelector('.scUnkCode').textContent = code;
        var nx = unknownEl.querySelector('#scUnkNext');
        if (nx) nx.onclick = function () { unknownEl.style.display = 'none'; paused = false; setStatus('بارکد یا QR را روبه‌روی دوربین بگیرید…'); };
        var cr = unknownEl.querySelector('#scUnkCreate');
        if (cr) cr.onclick = function () { var c = code; close(); if (opts.onCreate) opts.onCreate(c); };
      },
      setCount: function (n) { if (countEl) countEl.textContent = 'اسکن‌های انجام‌شده: ' + faNum(n); }
    };

    function deliver(text, meta) {
      delivered++;
      try { onCode(text, ctl); } catch (e) {}
      if (!continuous && !closed) close();
    }
    function handleResult(text, meta) {
      if (closed || paused) return;
      text = String(text == null ? '' : text).trim();
      if (!text) return;
      var now = Date.now();
      if (text === lastText && now - lastAt < 1800) return;
      lastText = text; lastAt = now;
      meta = meta || {};
      var looksUrl = /^https?:\/\//i.test(text);
      if (meta.qr && mode === 'lookup' && (looksUrl || text.length > 40)) {
        paused = true;
        msgEl.style.display = '';
        msgEl.innerHTML = '<div>محتوای این QR یک کد کالای ساده نیست:</div>' +
          '<div class="scQrText"></div>' +
          '<div class="row"><button type="button" class="btn sm" id="scQrUse">استفاده به‌عنوان کد</button>' +
          '<button type="button" class="btn gray sm" id="scQrSkip">ادامه اسکن</button></div>';
        msgEl.querySelector('.scQrText').textContent = text.length > 140 ? text.slice(0, 140) + '…' : text;
        msgEl.querySelector('#scQrUse').onclick = function () { msgEl.style.display = 'none'; paused = false; deliver(text, meta); };
        msgEl.querySelector('#scQrSkip').onclick = function () { msgEl.style.display = 'none'; paused = false; };
        return;
      }
      deliver(text, meta);
    }

    var manualInp = ov.querySelector('#scManualInp');
    function submitManual() {
      var v = manualInp.value.replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - FA_ZERO; })
        .replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - AR_ZERO; }).trim();
      if (!v) return;
      manualInp.value = '';
      lastText = ''; lastAt = 0;
      deliver(v, { manual: true, format: 'manual' });
    }
    ov.querySelector('#scManualBtn').onclick = submitManual;
    manualInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitManual(); });

    function noCamera(msg) {
      var st = ov.querySelector('.scanStage');
      if (st) st.classList.add('noCam');
      setStatus(msg, 'err');
      setTimeout(function () { try { manualInp.focus(); } catch (e) {} }, 80);
    }
    function setupTorch(st) {
      try {
        var track = st.getVideoTracks && st.getVideoTracks()[0];
        if (!track || !track.getCapabilities) return;
        var caps = track.getCapabilities();
        if (!caps || !('torch' in caps)) return;
        var btn = ov.querySelector('#scTorch');
        btn.style.display = '';
        var on = false;
        btn.onclick = function () {
          on = !on;
          track.applyConstraints({ advanced: [{ torch: on }] })
            .then(function () { btn.classList.toggle('on', on); })
            .catch(function () { on = !on; });
        };
      } catch (e) {}
    }

    var decoder = Scanner.decoder || Scanner._makeDecoder();
    if (Scanner.decoder) {
      try { decoderStop = decoder.start(video, null, handleResult) || null; }
      catch (e) { noCamera('خطا در راه‌اندازی اسکنر؛ کد را دستی وارد کنید'); }
    } else if (!decoder) {
      noCamera('تشخیص خودکار بارکد روی این گوشی در دسترس نیست؛ کد را دستی وارد کنید');
    } else if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      noCamera('دوربین روی این دستگاه در دسترس نیست؛ کد را دستی وارد کنید');
    } else {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
        .then(function (st) {
          if (closed) { st.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); return; }
          stream = st;
          try { video.srcObject = st; var pr = video.play && video.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
          setupTorch(st);
          try { decoderStop = decoder.start(video, st, handleResult) || null; }
          catch (e) { noCamera('خطا در راه‌اندازی تشخیص بارکد؛ کد را دستی وارد کنید'); }
        })
        .catch(function () { noCamera('دسترسی به دوربین داده نشد؛ می‌توانید کد را دستی وارد کنید'); });
    }
    return close;
  }
};

/* سازگاری با فراخوانی‌های قدیمی: اسکن تک‌مرحله‌ای */
function startScan(cb) {
  Scanner.open({
    title: 'اسکن بارکد', continuous: false, mode: 'lookup',
    onCode: function (code, ctl) { ctl.close(); cb(code); }
  });
}
function scanBarcode(cb) { startScan(cb); }

/* اسکن مستقیم داخل یک فیلد فرم (مثلاً فیلد بارکد کالا) */
function scanIntoField(inp) {
  if (!inp) return;
  Scanner.open({
    title: 'اسکن بارکد', continuous: false, mode: 'field',
    onCode: function (code, ctl) {
      inp.value = String(code).trim();
      try { inp.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
      ctl.close();
    }
  });
}

function doSaveFile(name, content, mime) {
  if (typeof Android !== 'undefined' && Android.saveHtml) {
    var uri = Android.saveHtml(name, content, mime || 'text/plain');
    return uri || null;
  }
  var blob = new Blob([content], { type: mime || 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500);
  return 'download';
}
function printInvoice(id) {
  var inv = invById(id); if (!inv) return;
  PRINTING = true;
  var st = DB.settings, per = personById(inv.personId);
  var rows = inv.items.map(function (it, i) {
    return '<tr><td>' + faNum(i + 1) + '</td><td>' + esc(it.name) + '</td><td>' + fn(it.qty) + '</td><td>' + fn(it.price) +
      '</td><td>' + fn(it.disc) + '٪</td><td>' + fn(lineTotal(it)) + '</td></tr>';
  }).join('');
  var pays = (inv.paidBy || []).map(function (p) {
    var a = accById(p.accId);
    return '<div class="row"><span>پرداخت (' + esc(a ? a.name : '؟') + ')</span><span>' + fm(p.amount) + '</span></div>';
  }).join('');
  var html =
    '<div class="h"><div class="t">' + esc(st.shopName) + '</div>' +
    (st.address ? '<div>' + esc(st.address) + '</div>' : '') +
    (st.phone ? '<div>تلفن: <span class="ltr">' + esc(st.phone) + '</span></div>' : '') + '</div>' +
    '<div class="h"><b>' + KIND_LABEL[inv.kind] + '</b> · شماره ' + fn(inv.no) + '</div>' +
    '<div class="row"><span>تاریخ: ' + fdm(inv.date) + '</span><span>ساعت: ' + faNum(inv.time || '') + '</span></div>' +
    (per ? '<div class="row"><span>طرف حساب: ' + esc(per.name) + '</span><span>تلفن: <span class="ltr">' + esc(per.phone || '—') + '</span></span></div>' : '') +
    '<table><tr><th>ردیف</th><th>شرح کالا</th><th>تعداد</th><th>قیمت واحد</th><th>تخفیف</th><th>مبلغ</th></tr>' + rows + '</table>' +
    '<div style="margin-top:8px">' +
    '<div class="row"><span>جمع اقلام</span><span>' + fm(invoiceItemsTotal(inv)) + '</span></div>' +
    (nd(inv.gdisc) ? '<div class="row"><span>تخفیف فاکتور</span><span>' + fm(inv.gdisc) + '</span></div>' : '') +
    (nd(inv.tax) ? '<div class="row"><span>مالیات و عوارض (' + faNum(inv.tax) + '٪)</span><span>' + fm(invoiceTax(inv)) + '</span></div>' : '') +
    (nd(inv.shipping) ? '<div class="row"><span>هزینه حمل</span><span>' + fm(inv.shipping) + '</span></div>' : '') +
    '<div class="row tot"><span>جمع کل</span><span>' + fm(invoiceTotal(inv)) + '</span></div>' +
    pays +
    '<div class="row"><span>مانده</span><span>' + fm(invoiceRemain(inv)) + '</span></div>' +
    (inv.note ? '<div class="row"><span>توضیحات: ' + esc(inv.note) + '</span></div>' : '') +
    (st.invoiceFooter ? '<div class="h" style="margin-top:10px">' + esc(st.invoiceFooter) + '</div>' : '') +
    '</div>';
  doPrint(wrapPrintHtml(html, st));
  PRINTING = false;
}
function wrapPrintHtml(inner, st) {
  var w = st.printSize === 't80' ? 'width:72mm;margin:0 auto;font-size:12.5px;' :
          st.printSize === 't58' ? 'width:48mm;margin:0 auto;font-size:11px;' : '';
  var logo = st.shopLogo ? '<div style="text-align:center;margin-bottom:6px"><img src="' + st.shopLogo + '" style="max-height:64px;max-width:180px"></div>' : '';
  return '<div style="' + w + '">' + logo + inner + '</div>';
}
function shareInvoiceText(id) {
  var inv = invById(id); if (!inv) return;
  var per = personById(inv.personId), st = DB.settings;
  var lines = ['*' + st.shopName + '*', KIND_LABEL[inv.kind] + ' شماره ' + faNum(inv.no), 'تاریخ: ' + fd(inv.date)];
  if (per) lines.push('طرف حساب: ' + per.name);
  lines.push('———————————');
  inv.items.forEach(function (it, i) { lines.push(faNum(i + 1) + '. ' + it.name + ' × ' + faNum(it.qty) + ' = ' + faNum(lineTotal(it))); });
  lines.push('———————————', 'جمع کل: ' + faNum(invoiceTotal(inv)) + ' ' + st.currency);
  if (invoicePaid(inv)) lines.push('پرداخت‌شده: ' + faNum(invoicePaid(inv)));
  if (invoiceRemain(inv)) lines.push('مانده: ' + faNum(invoiceRemain(inv)));
  doShareText(lines.join('\n'));
}

/* ---------- کمک‌کننده‌های فرم ---------- */
function fRow(label, inner) { return '<div class="f"><label>' + esc(label) + '</label>' + inner + '</div>'; }
function accOptions(sel, type) {
  return DB.accounts.map(function (a) {
    if (type && a.type !== type) return '';
    return '<option value="' + a.id + '"' + (a.id === sel ? ' selected' : '') + '>' + esc(a.name) + '</option>';
  }).join('');
}
function perOptions(sel, kind) {
  return '<option value="">— بدون طرف حساب —</option>' + DB.persons.filter(function (p) {
    return !kind || p.kind === kind || p.kind === 'both';
  }).map(function (p) {
    return '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.name) + '</option>';
  }).join('');
}
function catOptions(sel) {
  var roots = DB.categories.filter(function (c) { return !c.parentId; });
  var html = '<option value="">— بدون دسته —</option>';
  roots.forEach(function (r) {
    html += '<option value="' + r.id + '"' + (r.id === sel ? ' selected' : '') + '>' + catIcon(r) + ' ' + esc(r.name) + '</option>';
    DB.categories.filter(function (c) { return c.parentId === r.id; }).forEach(function (s) {
      html += '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>— ' + catIcon(s) + ' ' + esc(s.name) + ' (' + esc(r.name) + ')</option>';
    });
  });
  DB.categories.filter(function (c) { return c.parentId && !catById(c.parentId); }).forEach(function (o) {
    html += '<option value="' + o.id + '"' + (o.id === sel ? ' selected' : '') + '>' + esc(o.name) + '</option>';
  });
  return html;
}
function jalInput(id, val) { /* ورودی تاریخ شمسی */
  return '<input id="' + id + '" inputmode="numeric" placeholder="۱۴۰۳/۰۷/۲۸" value="' + esc(val ? fd(val) : fd(todayISO())) + '">';
}
function getJal(id) {
  var el = document.getElementById(id); if (!el) return null;
  var iso = parseJal(el.value);
  return iso;
}
function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
function num(id) { return nd(val(id)); }

/* ---------- داشبورد ---------- */
function recentActivity(n) {
  var evs = [];
  DB.invoices.forEach(function (inv) {
    if (inv.status !== 'final') return;
    var amt = invoiceTotal(inv);
    var sign = (inv.kind === 'sale' || inv.kind === 'purchase_ret') ? 1 : -1;
    var per = personById(inv.personId);
    var ic = inv.kind === 'sale' ? ['🧾', 'icGreen'] : inv.kind === 'purchase' ? ['🛒', 'icOrange'] : ['↩️', 'icBlue'];
    evs.push({ d: inv.date, c: inv.createdAt, ic: ic[0], cls: ic[1],
      title: KIND_LABEL[inv.kind] + ' شماره ' + faNum(inv.no),
      sub: (per ? per.name + ' · ' : '') + dayLabel(inv.date), amt: sign * amt, invId: inv.id });
  });
  DB.expenses.forEach(function (e) {
    evs.push({ d: e.date, c: 0, ic: '💸', cls: 'icPink',
      title: 'هزینه: ' + (DB.expCats[e.catId] || ''), sub: (e.note ? e.note + ' · ' : '') + dayLabel(e.date), amt: -e.amount });
  });
  DB.payments.forEach(function (p) {
    var a = accountById(p.accId), per = personById(p.personId);
    evs.push({ d: p.date, c: 0, ic: p.dir === 'in' ? '💵' : '💳', cls: p.dir === 'in' ? 'icGreen' : 'icOrange',
      title: (p.dir === 'in' ? 'دریافت' : 'پرداخت') + (per ? ' ' + per.name : ''),
      sub: (a ? a.name : '') + ' · ' + dayLabel(p.date), amt: p.dir === 'in' ? p.amount : -p.amount });
  });
  evs.sort(function (a, b) { return (b.d < a.d ? -1 : b.d > a.d ? 1 : b.c - a.c); });
  return evs.slice(0, n || 6);
}
function dayLabel(date) {
  var t = todayISO();
  if (date === t) return 'امروز';
  if (date === addDays(t, -1)) return 'دیروز';
  return fdm(date);
}
function kpi2(ic, cls, lb, vl, vcls) {
  return '<div class="kpi"><div class="icChip ' + cls + '">' + ic + '</div><div class="lb">' + lb + '</div><div class="vl ' + (vcls || '') + '">' + vl + '</div></div>';
}
function txItemHtml(e) {
  return '<div class="txItem"' + (e.invId ? ' data-inv="' + e.invId + '" style="cursor:pointer"' : '') + '>' +
    '<div class="txIc ' + e.cls + '">' + e.ic + '</div>' +
    '<div class="grow"><div class="tt">' + esc(e.title) + '</div><div class="ts">' + esc(e.sub) + '</div></div>' +
    '<div class="ta ' + (e.amt < 0 ? 'neg' : 'pos') + '">' + fm(e.amt) + '</div></div>';
}
function renderDash() {
  var v = $('#view'), t = todayISO(), mr = monthRange(0);
  var saleToday = salesSum(t, t, 'sale') - salesSum(t, t, 'sale_ret');
  var buyToday = salesSum(t, t, 'purchase') - salesSum(t, t, 'purchase_ret');
  var expToday = expenseSum(t, t);
  var profitToday = profitSum(t, t) - expToday;
  var grossM = profitSum(mr.from, mr.to), expM = expenseSum(mr.from, mr.to);
  var lows = lowStockList(), dues = chequesDue(7);
  var overdue = dues.filter(function (c) { return c.dueDate < t; }).length;
  var st = DB.settings;
  var h = '<div class="greet"><div class="hi">سلام، ' + esc(st.owner || st.shopName || 'دوست من') + ' 👋</div>' +
    '<div class="dt">' + weekdayFa(t) + ' · ' + fdm(t) + '</div></div>';
  var isEmpty = DB.products.length === 0 && DB.invoices.length === 0;
  if (isEmpty && !DB.settings.sampleLoaded) {
    h += '<div class="empty">هنوز داده‌ای ثبت نشده.<br><br>' +
      '<button class="btn" id="dSample">بارگذاری داده نمونه</button> ' +
      '<button class="btn gray" id="dStart">شروع با کالای جدید</button></div>';
  }
  /* حلقه وصول: نسبت واقعیِ مبلغ وصول‌شده (paidBy) به جمع فاکتورهای فروش نهایی؛
     اگر هیچ فاکتور فروشی نیست، حلقه اصلاً ساخته نمی‌شود (عدد ساختگی نداریم). */
  var cTot = 0, cPaid = 0;
  DB.invoices.forEach(function (inv) {
    if (inv.kind === 'sale' && inv.status === 'final') { cTot += invoiceTotal(inv); cPaid += invoicePaid(inv); }
  });
  var cPct = cTot > 0 ? Math.max(0, Math.min(100, Math.round(cPaid / cTot * 100))) : null;
  h += '<div class="balanceCard"><i class="sheen"></i><div class="balMain"><div class="lb"><span>💳 مانده کل حساب‌ها</span>' +
    '<button class="eye" id="eyeToggle" aria-label="مخفی/نمایش">' + (st.hideAmts ? '🙈' : '👁️') + '</button></div>' +
    '<div class="amount"><span class="cntUp" data-v="' + accountsTotal() + '">' + fm(accountsTotal()) + '</span></div>' +
    '<div class="subs"><span>💵 صندوق ' + fm(accountsTotal('cash')) + '</span><span>🏦 بانک ' + fm(accountsTotal('bank')) + '</span></div></div>' +
    (cPct !== null ? '<div class="heroRing" style="--p:' + cPct + '"><div class="hrIn"><b>' + (st.hideAmts ? '•••' : faNum(cPct) + '٪') + '</b><span>' + tr('وصول فاکتورها') + '</span></div></div>' : '') +
    '</div>';
  h += '<div class="kpis">' +
    kpi2('💰', 'icGreen', tr('فروش امروز'), '<span class="cntUp" data-v="' + saleToday + '">' + fm(saleToday) + '</span>') +
    kpi2('🧾', 'icOrange', tr('هزینه امروز'), '<span class="cntUp" data-v="' + expToday + '">' + fm(expToday) + '</span>') +
    kpi2('📈', 'icBlue', tr('سود امروز'), '<span class="cntUp" data-v="' + profitToday + '">' + fm(profitToday) + '</span>', profitToday < 0 ? 'bad' : '') +
    kpi2('👥', 'icPink', tr('بدهی مشتریان'), '<span class="cntUp" data-v="' + personsDebt(1) + '">' + fm(personsDebt(1)) + '</span>') +
    '</div>';
  h += '<div class="qa">' +
    '<button data-act="saleNew"><span class="ic">🧾</span>' + tr('فاکتور فروش') + '</button>' +
    '<button data-act="buyNew"><span class="ic">🛒</span>' + tr('فاکتور خرید') + '</button>' +
    '<button data-act="prodNew"><span class="ic">📦</span>' + tr('کالای جدید') + '</button>' +
    '<button data-act="expNew"><span class="ic">💸</span>' + tr('ثبت هزینه') + '</button>' +
    '</div>' +
    '<button class="btn gray block" id="dashSearch" style="margin-bottom:12px">🔎 ' + tr('جست‌وجوی فاکتورهای گذشته') + '</button>';
  var exps = (typeof expiryAlerts === 'function') ? expiryAlerts(30) : [];
  if (lows.length || dues.length || exps.length) {
    h += '<div class="card"><h3>🔔 ' + tr('هشدارها') + '</h3>';
    exps.slice(0, 4).forEach(function (x) {
      h += '<div class="row" style="padding:4px 0"><span class="grow">⏳ ' + esc(x.p.name) + '</span><span class="chip ' + (x.days < 0 ? 'red' : 'amber') + '">' + (x.days < 0 ? 'منقضی شده' : 'انقضا ' + fd(x.date)) + '</span></div>';
    });
    lows.slice(0, 5).forEach(function (p) {
      h += '<div class="row" style="padding:4px 0"><span class="grow">⚠️ ' + esc(p.name) + '</span><span class="chip amber">موجودی ' + fn(p._stock) + '</span></div>';
    });
    dues.slice(0, 5).forEach(function (c) {
      var per = personById(c.personId);
      h += '<div class="row" style="padding:4px 0"><span class="grow">💳 چک ' + (c.dir === 'in' ? 'دریافتی' : 'پرداختی') + ' ' + fm(c.amount) + (per ? ' · ' + esc(per.name) : '') + '</span><span class="chip ' + (c.dueDate < t ? 'red' : 'amber') + '">' + fd(c.dueDate) + '</span></div>';
    });
    h += '</div>';
  }
  if (typeof computeInsights === 'function') {
    var ins = computeInsights().slice(0, 3);
    if (ins.length) {
      h += '<div class="card" style="cursor:pointer" id="dashIns"><h3>🤖 ' + tr('بینش‌های دستیار') + '</h3>' + ins.map(function (x) {
        return '<div class="row" style="padding:3px 0"><span>' + x.ic + '</span><span class="grow">' + x.text + '</span></div>';
      }).join('') + '<p class="mut small" style="margin:4px 0 0">برای پرس‌وجو از دستیار، اینجا بزنید ←</p></div>';
    }
  }
  var days = [], max = 0;
  for (var i = 6; i >= 0; i--) {
    var d = addDays(t, -i), s = salesSum(d, d, 'sale') - salesSum(d, d, 'sale_ret'), e = expenseSum(d, d);
    days.push({ d: d, s: s, e: e });
    if (s > max) max = s; if (e > max) max = e;
  }
  h += '<div class="card"><h3>📊 ' + tr('فروش و هزینه (۷ روز اخیر)') + '</h3><div class="bars2">' + days.map(function (x, i) {
    var hs = max > 0 ? Math.max(3, Math.round(x.s / max * 76)) : 3;
    var he = max > 0 ? Math.max(3, Math.round(x.e / max * 76)) : 3;
    return '<div class="day"><div class="pair"><i class="s" style="height:' + hs + 'px;animation-delay:' + (i * 55) + 'ms"></i><i class="e" style="height:' + he + 'px;animation-delay:' + (i * 55 + 90) + 'ms"></i></div><span>' + weekdayFa(x.d).slice(0, 4) + '</span></div>';
  }).join('') + '</div><div class="legend"><span><i style="background:var(--green-b)"></i>' + tr('فروش') + '</span><span><i style="background:#f5a623"></i>' + tr('هزینه') + '</span></div></div>';
  var act = recentActivity(6);
  if (act.length) {
    h += '<div class="card"><h3>⏱ ' + tr('آخرین تراکنش‌ها') + '</h3>' + act.map(txItemHtml).join('') + '</div>';
  }
  h += '<div class="kpis">' +
    kpi('🛒 ' + tr('خرید امروز'), fm(buyToday)) +
    kpi('📈 ' + tr('سود ناخالص این ماه'), (typeof canProfit === 'function' && !canProfit()) ? '🔒 ' + tr('محدود شده') : fm(grossM)) +
    kpi('✅ ' + tr('سود خالص این ماه'), (typeof canProfit === 'function' && !canProfit()) ? '🔒 ' + tr('محدود شده') : fm(grossM - expM), grossM - expM < 0 ? 'bad' : '') +
    kpi('🏭 ' + tr('بدهی به تأمین‌کنندگان'), fm(personsDebt(-1))) +
    kpi('📦 ' + tr('ارزش موجودی انبار'), fm(inventoryValue())) +
    kpi('🔢 ' + tr('تعداد کالاها'), fn(DB.products.length) + ' قلم') +
    kpi('⚠️ ' + tr('کالای رو به اتمام'), fn(lows.length) + ' قلم', lows.length ? 'warn' : '') +
    kpi('💳 ' + tr('چک نزدیک سررسید'), fn(dues.length) + ' فقره', overdue ? 'bad' : dues.length ? 'warn' : '') +
    '</div>';
  var tops = topProducts(mr.from, mr.to, 5, false);
  if (tops.length) {
    h += '<div class="card"><h3>🏆 ' + tr('پرفروش‌ترین‌های این ماه') + '</h3>' + tops.map(function (x) {
      return '<div class="row" style="padding:4px 0">' + thumbHtml(x.name, true) + '<span class="grow">' + esc(x.name) + '</span><span class="mut">' + fn(x.qty) + ' عدد · </span><span>' + fm(x.amount) + '</span></div>';
    }).join('') + '</div>';
  }
  if (DB.settings.lastBackup && Date.now() - DB.settings.lastBackup > 7 * 86400000 && DB.invoices.length > 3) {
    h += '<div class="card" style="border-color:#f0d9a8;background:var(--amber-l)"><b>💾 یادآوری:</b> بیش از یک هفته از آخرین پشتیبان‌گیری گذشته. از بخش «پشتیبان‌گیری» یک نسخه ذخیره کنید.</div>';
  }
  v.innerHTML = h;
  countUps();
  var ey = $('#eyeToggle');
  if (ey) ey.onclick = function () { DB.settings.hideAmts = !DB.settings.hideAmts; saveDB(); refresh(); };
  var di = $('#dashIns'); if (di) di.onclick = function () { show('assistant'); };
  var ds2 = $('#dashSearch'); if (ds2) ds2.onclick = function () { show('search'); };
  var sBtn = $('#dSample'); if (sBtn) sBtn.onclick = function () { loadSampleData(); toast('داده نمونه بارگذاری شد'); refresh(); };
  var stBtn = $('#dStart'); if (stBtn) stBtn.onclick = function () { show('products'); setTimeout(productEditor, 60); };
  $$('#view [data-act]').forEach(function (b) {
    b.onclick = function () {
      var a = b.dataset.act;
      if (a === 'saleNew') openInvoiceEditor('sale');
      else if (a === 'buyNew') openInvoiceEditor('purchase');
      else if (a === 'prodNew') { show('products'); setTimeout(productEditor, 60); }
      else if (a === 'expNew') { show('finance', 'expenses'); setTimeout(expenseEditor, 60); }
    };
  });
  $$('#view [data-inv]').forEach(function (el) { el.onclick = function () { invoiceDetail(el.dataset.inv); }; });
}

function kpi(label, val, cls) {
  return '<div class="kpi ' + (cls || '') + '"><div class="lb">' + label + '</div><div class="vl">' + val + '</div></div>';
}

/* ---------- کالاها ---------- */
var prodTab = 'list', prodQuery = '', prodCatFilter = '';
function renderProducts() {
  var v = $('#view');
  var h = '<div class="secTitle">📦 ' + tr('کالاها') + '</div>';
  h += '<div class="tabs"><button data-t="list" class="' + (prodTab === 'list' ? 'active' : '') + '">' + tr('فهرست کالاها') + '</button>' +
       '<button data-t="cats" class="' + (prodTab === 'cats' ? 'active' : '') + '">' + tr('دسته‌بندی‌ها') + '</button></div>';
  if (prodTab === 'cats') {
    v.innerHTML = h + catsHtml();
    $$('#view .tabs [data-t]').forEach(function (b) { b.onclick = function () { prodTab = b.dataset.t; renderProducts(); }; });
    wireCats(); return;
  }
  h += '<div class="row" style="align-items:center"><input class="searchBox grow" style="margin-bottom:0" id="pSearch" placeholder="جست‌وجو: نام، کد یا بارکد…" value="' + esc(prodQuery) + '"><button class="btn gray sm" type="button" id="pScanBtn" title="اسکن بارکد">📷</button><button class="btn gray sm" type="button" data-voice-field="pSearch" title="جست‌وجوی صوتی">🎤</button></div>';
  h += '<div class="tabs"><button data-c="" class="' + (prodCatFilter === '' ? 'active' : '') + '">همه</button>' +
    DB.categories.map(function (c) { return '<button data-c="' + c.id + '" class="' + (prodCatFilter === c.id ? 'active' : '') + '">' + catIcon(c) + ' ' + esc(c.name) + '</button>'; }).join('') + '</div>';
  h += '<button class="btn block" id="pNew" style="margin-bottom:8px">＋ کالای جدید</button>' +
    '<div class="row" style="margin-bottom:12px"><label class="btn gray sm grow" for="impFile" style="cursor:pointer;text-align:center">📥 ورود از اکسل</label>' +
    '<input type="file" id="impFile" accept=".xlsx,.xls,.csv" style="display:none">' +
    '<button class="btn gray sm grow" id="impTpl">📄 قالب نمونه اکسل</button>' +
    '<button class="btn gray sm grow" id="impExp">📤 خروجی اکسل</button></div>';
  var q = prodQuery.replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - FA_ZERO; }).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - AR_ZERO; }).toLowerCase();
  var list = DB.products.filter(function (p) {
    if (prodCatFilter && p.catId !== prodCatFilter) {
      var pc = catById(p.catId);
      if (!pc || pc.parentId !== prodCatFilter) return false;
    }
    if (!q) return true;
    return p.name.toLowerCase().indexOf(q) >= 0 || String(p.code || '').indexOf(q) >= 0 || String(p.barcode || '').indexOf(q) >= 0;
  });
  if (!list.length) h += '<div class="empty">کالایی پیدا نشد.</div>';
  h += list.map(function (p) {
    var low = p._stock <= nd(p.minStock);
    return '<div class="listItem" data-pid="' + p.id + '">' + prodThumbHtml(p) + '<div class="main"><div class="t">' + esc(p.name) + '</div>' +
      '<div class="s">کد ' + esc(p.code || '—') + ' · خرید ' + fn(p.buyPrice) + ' · فروش ' + fn(p.sellPrice) + '</div></div>' +
      '<div><div class="amt">' + fn(p._stock) + ' ' + esc(p.unit || 'عدد') + '</div><div class="s" style="text-align:left">' + (low ? '<span class="chip amber">رو به اتمام</span>' : '<span class="chip green">موجود</span>') + '</div></div></div>';
  }).join('');
  v.innerHTML = h;
  $$('#view .tabs [data-t]').forEach(function (b) { b.onclick = function () { prodTab = b.dataset.t; renderProducts(); }; });
  $$('#view .tabs [data-c]').forEach(function (b) { b.onclick = function () { prodCatFilter = b.dataset.c; renderProducts(); var s = $('#pSearch'); if (s) { s.focus(); } }; });
  var sb = $('#pSearch');
  sb.oninput = function () { prodQuery = sb.value; var pos = sb.selectionStart; renderProducts(); var s2 = $('#pSearch'); s2.focus(); s2.setSelectionRange(pos, pos); };
  var psb = $('#pScanBtn');
  if (psb) psb.onclick = function () {
    Scanner.open({
      title: 'یافتن کالا با بارکد', continuous: false, mode: 'lookup',
      onCode: function (code, ctl) {
        var p = productByBarcode(code);
        ctl.close();
        if (p) { productEditor(p.id); return; }
        uiConfirm('کالایی با بارکد ' + code + ' پیدا نشد. کالای جدید با همین بارکد ساخته شود؟', 'ساخت کالا').then(function (ok) {
          if (!ok) return;
          productEditor();
          var b = $('#pfBar'); if (b) b.value = code;
        });
      }
    });
  };
  $('#pNew').onclick = function () { productEditor(); };
  var impF = $('#impFile'); if (impF) impF.onchange = function () { if (impF.files && impF.files[0]) importProductsFile(impF.files[0]); };
  var impT = $('#impTpl'); if (impT) impT.onclick = exportTemplateXlsx;
  var impE = $('#impExp'); if (impE) impE.onclick = exportProductsXlsx;
  $$('#view [data-pid]').forEach(function (el) { el.onclick = function () { productEditor(el.dataset.pid); }; });
}
function catsHtml() {
  var h = '<button class="btn block" id="cNew" style="margin-bottom:12px">＋ دسته جدید</button>';
  if (!DB.categories.length) h += '<div class="empty">دسته‌ای ثبت نشده.</div>';
  h += DB.categories.map(function (c) {
    var cnt = DB.products.filter(function (p) { return p.catId === c.id; }).length;
    return '<div class="listItem" data-cid="' + c.id + '"><span class="catIcTile">' + catIcon(c) + '</span><div class="main"><div class="t">' + esc(c.name) + '</div><div class="s">' + fn(cnt) + ' کالا</div></div><span>✏️</span></div>';
  }).join('');
  return h;
}
function wireCats() {
  $('#cNew').onclick = function () { catEditor(); };
  $$('#view [data-cid]').forEach(function (el) { el.onclick = function () { catEditor(el.dataset.cid); }; });
}
function catEditor(id) {
  var c = id ? catById(id) : null;
  var parentOpts = '<option value="">— دسته اصلی —</option>' + DB.categories.filter(function (x) {
    return !x.parentId && (!c || x.id !== c.id);
  }).map(function (x) {
    return '<option value="' + x.id + '"' + (c && c.parentId === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>';
  }).join('');
  var pickedIcon = c ? catIcon(c) : '🛒';
  openModal(c ? 'ویرایش دسته' : 'دسته جدید',
    fRow('نام دسته', '<input id="cfName" value="' + esc(c ? c.name : '') + '">') +
    fRow('دسته والد (برای ساخت زیردسته)', '<select id="cfParent">' + parentOpts + '</select>') +
    '<div class="f"><label>آیکون دسته <span id="cfIconPrev" style="font-size:19px">' + pickedIcon + '</span></label>' +
    '<div class="catIcGrid" id="cfIcons">' + CAT_ICONS.map(function (ic) {
      return '<button type="button" class="catIc' + (ic === pickedIcon ? ' on' : '') + '" data-ic="' + ic + '">' + ic + '</button>';
    }).join('') + '</div></div>' +
    '<div class="err" id="cfErr"></div>',
    [
      { label: 'ذخیره', cb: function (close) {
          var name = val('cfName').trim();
          if (!name) { $('#cfErr').textContent = 'نام دسته را وارد کنید.'; return; }
          var par = val('cfParent');
          if (c) { c.name = name; c.parentId = par; c.icon = pickedIcon; }
          else DB.categories.push({ id: newId('cat'), name: name, parentId: par, icon: pickedIcon });
          saveDB(); close(); renderProducts(); toast('ذخیره شد');
        } },
      c ? { label: 'حذف', cls: 'danger', cb: function (close) {
          close();
          uiConfirm('دسته «' + c.name + '» حذف شود؟ کالاهای این دسته بدون دسته می‌مانند.').then(function (ok) {
            if (!ok) return;
            DB.products.forEach(function (p) { if (p.catId === c.id) p.catId = ''; });
            DB.categories.forEach(function (x) { if (x.parentId === c.id) x.parentId = ''; });
            DB.categories = DB.categories.filter(function (x) { return x.id !== c.id; });
            saveDB(); renderProducts(); toast('حذف شد');
          });
        } } : { label: 'انصراف', cls: 'gray' }
    ]);
  $$('#cfIcons .catIc').forEach(function (b) {
    b.onclick = function () {
      pickedIcon = b.dataset.ic;
      $$('#cfIcons .catIc').forEach(function (x) { x.classList.toggle('on', x === b); });
      var pv = $('#cfIconPrev'); if (pv) pv.textContent = pickedIcon;
    };
  });
}
function productEditor(id) {
  if (!id && !limitGate('product')) return;
  var p = id ? prodById(id) : null;
  var imgData = p ? (p.img || '') : '';
  var extraBars = p ? allBarcodes(p).slice(1) : [];
  var body =
    '<div class="row" style="align-items:center;margin-bottom:10px">' +
    '<span id="pfImgPrev">' + (imgData ? '<img src="' + imgData + '" style="width:64px;height:64px;border-radius:14px;object-fit:cover">' : thumbHtml(p ? p.name : '؟')) + '</span>' +
    '<label class="btn gray sm" style="cursor:pointer">📷 انتخاب عکس<input type="file" id="pfImg" accept="image/*" hidden></label>' +
    '<button class="btn gray sm" id="pfImgDel" type="button">حذف عکس</button></div>' +
    fRow('نام کالا *', '<input id="pfName" value="' + esc(p ? p.name : '') + '">') +
    '<div class="grid2">' +
    fRow('کد کالا', '<input id="pfCode" value="' + esc(p ? p.code : '') + '">') +
    fRow('بارکد اصلی', '<div class="row"><input class="grow" id="pfBar" inputmode="numeric" value="' + esc(p ? (allBarcodes(p)[0] || '') : '') + '"><button class="btn gray sm" id="pfBarScan" type="button" title="اسکن بارکد">📷</button></div>') + '</div>' +
    '<div id="pfBars">' + extraBars.map(function (b, i) {
      return '<div class="row" style="margin-bottom:8px"><input class="grow pfBarX" inputmode="numeric" placeholder="بارکد دیگر" value="' + esc(b) + '"><button class="btn gray sm pfBarScan" type="button" title="اسکن بارکد">📷</button><button class="btn danger sm pfBarDel" type="button">✕</button></div>';
    }).join('') + '</div>' +
    '<button class="btn gray sm" id="pfBarAdd" type="button">＋ بارکد دیگر</button>' +
    fRow('دسته‌بندی', '<select id="pfCat">' + catOptions(p ? p.catId : '') + '</select>') +
    '<div class="grid2">' +
    (typeof canEditPrices === 'function' && !canEditPrices() ? fRow('قیمت خرید', '<input id="pfBuy" inputmode="numeric" value="🔒" disabled>') : fRow('قیمت خرید', '<input id="pfBuy" inputmode="numeric" value="' + (p ? faNum(p.buyPrice) : '') + '">')) +
    fRow('قیمت فروش', '<input id="pfSell" inputmode="numeric" value="' + (p ? faNum(p.sellPrice) : '') + '">') +
    fRow('قیمت عمده', '<input id="pfWs" inputmode="numeric" value="' + (p ? faNum(p.wsPrice) : '') + '">') +
    fRow('حداقل موجودی (هشدار)', '<input id="pfMin" inputmode="numeric" value="' + (p ? faNum(p.minStock) : '۵') + '">') +
    fRow('واحد', '<input id="pfUnit" value="' + esc(p ? p.unit : 'عدد') + '">') +
    '<div class="grid2">' + fRow('تعداد در بسته (۰=ندارد)', '<input id="pfPack" inputmode="numeric" value="' + (p ? faNum(p.packSize || 0) : '0') + '">') +
    fRow('نام بسته (مثل کارتن)', '<input id="pfPackName" value="' + esc(p ? (p.packName || '') : '') + '">') + '</div>' +
    (p ? fRow('موجودی در انبارها', '<input value="' + esc(DB.warehouses.map(function (w) { return w.name + ': ' + faNum(whStock(p, w.id)); }).join(' · ') + ' ' + (p.unit || '') + ' · بهای میانگین ' + fn(Math.round(p._avg))) + '" disabled>') : '') +
    '</div>' +
    fRow('توضیحات', '<textarea id="pfNote">' + esc(p ? p.note : '') + '</textarea>') +
    '<div class="err" id="pfErr"></div>' +
    (p ? '<div class="row wrap"><button class="btn gray sm" id="pfKardex">📋 کاردکس کالا</button> <button class="btn gray sm" id="pfStockOp">🏭 عملیات انبار</button></div>' : '');
  var btns = [
    { label: 'ذخیره کالا', cb: function (close) {
        var name = val('pfName').trim();
        if (!name) { $('#pfErr').textContent = 'نام کالا الزامی است.'; return; }
        var bars = [val('pfBar').trim()];
        $$('#pfBars .pfBarX').forEach(function (inp) { bars.push(inp.value.trim()); });
        bars = bars.filter(function (b, i) { return b && bars.indexOf(b) === i; });
        var data = { name: name, code: val('pfCode').trim(), barcode: bars[0] || '', barcodes: bars, img: imgData, catId: val('pfCat'),
          buyPrice: num('pfBuy'), sellPrice: num('pfSell'), wsPrice: num('pfWs'), minStock: num('pfMin'),
          packSize: num('pfPack'), packName: val('pfPackName').trim(),
          unit: val('pfUnit').trim() || 'عدد', note: val('pfNote') };
        if (typeof canEditPrices === 'function' && !canEditPrices()) data.buyPrice = p ? p.buyPrice : 0;
        if (p) { for (var k in data) p[k] = data[k]; }
        else { data.id = newId('prd'); data.stock = 0; data.avgCost = data.buyPrice; DB.products.push(data); recompute(); }
        saveDB(); close(); refresh(); toast('کالا ذخیره شد');
      } },
    { label: 'بستن', cls: 'gray' }
  ];
  if (p && (typeof canDelete !== 'function' || canDelete())) btns.splice(1, 0, { label: 'حذف', cls: 'danger', cb: function (close) {
    close();
    uiConfirm('کالای «' + p.name + '» حذف شود؟ اگر در فاکتوری استفاده شده باشد، سوابق فاکتور باقی می‌ماند.').then(function (ok) {
      if (!ok) return;
      DB.products = DB.products.filter(function (x) { return x.id !== p.id; });
      DB.stockOps = DB.stockOps.filter(function (o) { return o.pid !== p.id; });
      recompute(); saveDB(); refresh(); toast('حذف شد');
    });
  } });
  openModal(p ? 'ویرایش کالا' : 'کالای جدید', body, btns);
  var pfImg = $('#pfImg');
  if (pfImg) pfImg.onchange = function () {
    var f = pfImg.files && pfImg.files[0]; if (!f) return;
    fileToDataUrl(f, 320, function (url) {
      imgData = url;
      var pv = $('#pfImgPrev');
      if (pv) pv.innerHTML = '<img src="' + url + '" style="width:64px;height:64px;border-radius:14px;object-fit:cover">';
    });
  };
  var pfImgDel = $('#pfImgDel');
  if (pfImgDel) pfImgDel.onclick = function () { imgData = ''; var pv = $('#pfImgPrev'); if (pv) pv.innerHTML = thumbHtml(val('pfName') || '؟'); };
  var pfBarAdd = $('#pfBarAdd');
  if (pfBarAdd) pfBarAdd.onclick = function () {
    var row = document.createElement('div');
    row.className = 'row'; row.style.marginBottom = '8px';
    row.innerHTML = '<input class="grow pfBarX" inputmode="numeric" placeholder="بارکد دیگر"><button class="btn gray sm pfBarScan" type="button" title="اسکن بارکد">📷</button><button class="btn danger sm pfBarDel" type="button">✕</button>';
    $('#pfBars').appendChild(row);
    row.querySelector('.pfBarDel').onclick = function () { row.remove(); };
    row.querySelector('.pfBarScan').onclick = function () { scanIntoField(row.querySelector('.pfBarX')); };
  };
  $$('#pfBars .pfBarDel').forEach(function (b) { b.onclick = function () { b.closest('.row').remove(); }; });
  $$('#pfBars .pfBarScan').forEach(function (b) { b.onclick = function () { scanIntoField(b.closest('.row').querySelector('.pfBarX')); }; });
  var pfBarScan = $('#pfBarScan');
  if (pfBarScan) pfBarScan.onclick = function () { scanIntoField($('#pfBar')); };
  if (p) {
    $('#pfKardex').onclick = function () { $('#modalRoot').innerHTML = ''; show('stock', 'kardex:' + p.id); };
    $('#pfStockOp').onclick = function () { stockOpEditor(p.id); };
  }
}

/* ---------- فاکتورها: فهرست و جزئیات ---------- */
var saleTab = 'sale', buyTab = 'purchase', invQuery = '';
function normSearch(s) {
  return String(s || '').toLowerCase()
    .replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - FA_ZERO; })
    .replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - AR_ZERO; })
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();
}
function invListItemHtml(inv) {
  var per = personById(inv.personId), rem = invoiceRemain(inv);
  var chip = inv.status === 'void' ? '<span class="chip red">باطل‌شده</span>'
    : rem > 0 ? '<span class="chip amber">مانده ' + fm(rem) + '</span>'
    : '<span class="chip green">تسویه</span>';
  return '<div class="listItem" data-inv="' + inv.id + '"><div class="main"><div class="t">' + KIND_LABEL[inv.kind] + ' شماره ' + fn(inv.no) + '</div>' +
    '<div class="s">' + (per ? esc(per.name) : 'بدون طرف حساب') + ' · ' + fd(inv.date) + '</div></div>' +
    '<div><div class="amt">' + fm(invoiceTotal(inv)) + '</div><div class="s" style="text-align:left">' + chip + '</div></div></div>';
}
function invListHtml(kind) {
  var q = normSearch(invQuery);
  var list = DB.invoices.filter(function (i) { return i.kind === kind; })
    .sort(function (a, b) { return b.createdAt - a.createdAt; })
    .filter(function (i) {
      if (!q) return true;
      var per = personById(i.personId);
      var hay = normSearch(String(i.no) + ' ' + (per ? per.name : ''));
      return hay.indexOf(q) >= 0;
    });
  if (!list.length) return '<div class="empty">هنوز ' + KIND_LABEL[kind] + 'ی ثبت نشده.</div>';
  return list.map(invListItemHtml).join('');
}
/* جست‌وجوی پیشرفته در همه فاکتورهای گذشته */
var IS = { q: '', kind: '', status: '', from: '', to: '', ran: false };
function searchInvoices(o) {
  var q = normSearch(o.q);
  return DB.invoices.filter(function (inv) {
    if (o.kind && inv.kind !== o.kind) return false;
    if (o.status === 'final' && inv.status !== 'final') return false;
    if (o.status === 'void' && inv.status !== 'void') return false;
    if (o.from && inv.date < o.from) return false;
    if (o.to && inv.date > o.to) return false;
    if (q) {
      var per = personById(inv.personId);
      var items = inv.items.map(function (it) { return it.name; }).join(' ');
      var hay = normSearch(String(inv.no) + ' ' + KIND_LABEL[inv.kind] + ' ' + (per ? per.name : '') + ' ' + items);
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }).sort(function (a, b) { return b.createdAt - a.createdAt; });
}
function renderSearch() {
  var v = $('#view');
  var h = '<div class="secTitle">🔎 ' + tr('جست‌وجوی فاکتور') + '</div>' +
    '<div class="card">' +
    fRow('متن جست‌وجو (شماره، نام شخص، نام کالا…)', '<div class="row" style="align-items:center"><input class="grow" id="isQ" value="' + esc(IS.q) + '"><button class="btn gray sm" type="button" data-voice-field="isQ" title="جست‌وجوی صوتی">🎤</button></div>') +
    '<div class="grid2">' +
    fRow('نوع فاکتور', '<select id="isKind"><option value="">' + tr('همه') + '</option>' + Object.keys(KIND_LABEL).map(function (k) {
      return '<option value="' + k + '"' + (IS.kind === k ? ' selected' : '') + '>' + KIND_LABEL[k] + '</option>';
    }).join('') + '</select>') +
    fRow('وضعیت', '<select id="isStatus"><option value="">' + tr('همه') + '</option>' +
      '<option value="final"' + (IS.status === 'final' ? ' selected' : '') + '>ثبت‌شده</option>' +
      '<option value="void"' + (IS.status === 'void' ? ' selected' : '') + '>باطل‌شده</option></select>') + '</div>' +
    '<div class="grid2">' + fRow('از تاریخ', '<input id="isFrom" readonly class="calIn" placeholder="📅 انتخاب از تقویم" value="' + esc(IS.from ? fd(IS.from) : '') + '">') +
    fRow('تا تاریخ', '<input id="isTo" readonly class="calIn" placeholder="📅 انتخاب از تقویم" value="' + esc(IS.to ? fd(IS.to) : '') + '">') + '</div>' +
    '<div class="row"><button class="btn grow" id="isGo">🔎 جست‌وجو</button><button class="btn gray" id="isClear">پاک‌سازی</button></div></div>' +
    '<div id="isRes"></div>';
  v.innerHTML = h;
  $('#isGo').onclick = function () {
    IS.q = val('isQ'); IS.kind = val('isKind'); IS.status = val('isStatus'); IS.ran = true;
    var f = parseJal(val('isFrom')), tt = parseJal(val('isTo'));
    if (val('isFrom') && !f) { toast('تاریخ «از» نامعتبر است'); return; }
    if (val('isTo') && !tt) { toast('تاریخ «تا» نامعتبر است'); return; }
    IS.from = f || ''; IS.to = tt || '';
    renderSearchResults();
  };
  $('#isClear').onclick = function () { IS = { q: '', kind: '', status: '', from: '', to: '', ran: false }; renderSearch(); };
  $('#isFrom').onclick = function () {
    openJalCalendar(IS.from, function (iso) { IS.from = iso || ''; renderSearch(); });
  };
  $('#isTo').onclick = function () {
    openJalCalendar(IS.to, function (iso) { IS.to = iso || ''; renderSearch(); });
  };
  var iq = $('#isQ');
  iq.addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#isGo').click(); });
  if (IS.ran) renderSearchResults();
}
function renderSearchResults() {
  var res = searchInvoices(IS);
  var box = $('#isRes'); if (!box) return;
  if (!IS.q && !IS.kind && !IS.status && !IS.from && !IS.to) {
    box.innerHTML = '<div class="empty">فیلترها را تنظیم کنید و دکمه جست‌وجو را بزنید.</div>'; return;
  }
  if (!res.length) { box.innerHTML = '<div class="empty">فاکتوری با این مشخصات پیدا نشد.</div>'; return; }
  box.innerHTML = '<p class="mut" style="margin:2px">' + fn(res.length) + ' فاکتور پیدا شد</p>' + res.map(invListItemHtml).join('');
  $$('#isRes [data-inv]').forEach(function (el) { el.onclick = function () { invoiceDetail(el.dataset.inv); }; });
}
function wireInvList() {
  $$('#view [data-inv]').forEach(function (el) { el.onclick = function () { invoiceDetail(el.dataset.inv); }; });
  var sb = $('#invSearch');
  if (sb) sb.oninput = function () { invQuery = sb.value; refresh(); var s2 = $('#invSearch'); if (s2) { s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length); } };
}
function renderSale() {
  var v = $('#view');
  var h = '<div class="secTitle">🧾 ' + tr('فروش') + '</div>' +
    '<div class="row" style="margin-bottom:10px"><button class="btn grow" id="sNew">＋ فاکتور فروش</button>' +
    '<button class="btn gray" id="sPro">پیش‌فاکتور</button><button class="btn gray" id="sRet">برگشت از فروش</button></div>' +
    '<div class="row" style="margin-bottom:10px"><button class="btn gray grow" id="sCat">🛍 کاتالوگ آنلاین</button>' +
    '<button class="btn gray grow" id="sImp">📥 ثبت سفارش آنلاین</button></div>' +
    '<div class="tabs"><button data-t="sale" class="' + (saleTab === 'sale' ? 'active' : '') + '">' + tr('فاکتورهای فروش') + '</button>' +
    '<button data-t="proforma" class="' + (saleTab === 'proforma' ? 'active' : '') + '">' + tr('پیش‌فاکتورها') + '</button>' +
    '<button data-t="sale_ret" class="' + (saleTab === 'sale_ret' ? 'active' : '') + '">' + tr('برگشت از فروش') + '</button></div>' +
    '<div class="row" style="align-items:center"><input class="searchBox grow" style="margin-bottom:0" id="invSearch" placeholder="جست‌وجو: شماره یا نام مشتری…" value="' + esc(invQuery) + '"><button class="btn gray sm" type="button" data-voice-field="invSearch" title="جست‌وجوی صوتی">🎤</button></div>' +
    invListHtml(saleTab);
  v.innerHTML = h;
  $('#sNew').onclick = function () { openInvoiceEditor('sale'); };
  $('#sPro').onclick = function () { openInvoiceEditor('proforma'); };
  $('#sRet').onclick = function () { openInvoiceEditor('sale_ret'); };
  $('#sCat').onclick = function () { catalogModal(); };
  $('#sImp').onclick = function () { orderImportModal(); };
  $$('#view .tabs [data-t]').forEach(function (b) { b.onclick = function () { saleTab = b.dataset.t; invQuery = ''; renderSale(); }; });
  wireInvList();
}
function renderBuy() {
  var v = $('#view');
  var h = '<div class="secTitle">🛒 ' + tr('خرید') + '</div>' +
    '<div class="row" style="margin-bottom:10px"><button class="btn grow" id="bNew">＋ فاکتور خرید</button>' +
    '<button class="btn gray" id="bRet">برگشت از خرید</button>' +
    '<button class="btn gray" id="bOcr">📷 اسکن فاکتور</button></div>' +
    '<div class="tabs"><button data-t="purchase" class="' + (buyTab === 'purchase' ? 'active' : '') + '">' + tr('فاکتورهای خرید') + '</button>' +
    '<button data-t="purchase_ret" class="' + (buyTab === 'purchase_ret' ? 'active' : '') + '">' + tr('برگشت از خرید') + '</button></div>' +
    '<div class="row" style="align-items:center"><input class="searchBox grow" style="margin-bottom:0" id="invSearch" placeholder="جست‌وجو: شماره یا نام تأمین‌کننده…" value="' + esc(invQuery) + '"><button class="btn gray sm" type="button" data-voice-field="invSearch" title="جست‌وجوی صوتی">🎤</button></div>' +
    invListHtml(buyTab);
  v.innerHTML = h;
  $('#bNew').onclick = function () { openInvoiceEditor('purchase'); };
  $('#bRet').onclick = function () { openInvoiceEditor('purchase_ret'); };
  var bo = $('#bOcr'); if (bo) bo.onclick = function () { ocrInvoice(); };
  $$('#view .tabs [data-t]').forEach(function (b) { b.onclick = function () { buyTab = b.dataset.t; invQuery = ''; renderBuy(); }; });
  wireInvList();
}
function invoiceDetail(id) {
  var inv = invById(id); if (!inv) return;
  var per = personById(inv.personId);
  var hasPlan = (DB.installments || []).some(function (p) { return p.invId === id; });
  var rows = inv.items.map(function (it, i) {
    return '<tr><td>' + faNum(i + 1) + '</td><td>' + esc(it.name) + '</td><td class="n">' + fn(it.qty) + '</td><td class="n">' + fn(it.price) + '</td><td class="n">' + fn(lineTotal(it)) + '</td></tr>';
  }).join('');
  var pays = (inv.paidBy || []).map(function (p) {
    var a = accById(p.accId);
    return '<div class="row" style="padding:3px 0"><span class="grow">💵 ' + esc(a ? a.name : '؟') + '</span><span>' + fm(p.amount) + '</span></div>';
  }).join('');
  var body =
    '<div class="row"><span class="grow"><b>' + KIND_LABEL[inv.kind] + ' شماره ' + fn(inv.no) + '</b></span>' +
    (inv.status === 'void' ? '<span class="chip red">باطل‌شده</span>' : '<span class="chip blue">' + fd(inv.date) + '</span>') + '</div>' +
    '<p class="mut small" style="margin:6px 0">' + (per ? 'طرف حساب: <b>' + esc(per.name) + '</b>' + (per.phone ? ' · <span class="ltr">' + esc(per.phone) + '</span>' : '') : 'بدون طرف حساب') + '</p>' +
    '<div class="tblwrap"><table class="tbl"><tr><th>#</th><th>کالا</th><th class="n">تعداد</th><th class="n">قیمت</th><th class="n">مبلغ</th></tr>' + rows +
    '<tfoot><tr><td colspan="4">جمع اقلام</td><td class="n">' + fn(invoiceItemsTotal(inv)) + '</td></tr>' +
    (nd(inv.gdisc) ? '<tr><td colspan="4">تخفیف</td><td class="n">− ' + fn(inv.gdisc) + '</td></tr>' : '') +
    (nd(inv.tax) ? '<tr><td colspan="4">مالیات (' + faNum(inv.tax) + '٪)</td><td class="n">' + fn(invoiceTax(inv)) + '</td></tr>' : '') +
    (nd(inv.shipping) ? '<tr><td colspan="4">حمل</td><td class="n">' + fn(inv.shipping) + '</td></tr>' : '') +
    '<tr><td colspan="4">جمع کل</td><td class="n">' + fn(invoiceTotal(inv)) + '</td></tr></tfoot></table></div>' +
    (pays ? '<div style="margin-top:8px">' + pays + '</div>' : '') +
    '<div class="row" style="margin-top:4px"><span class="grow">مانده</span><b>' + fm(invoiceRemain(inv)) + '</b></div>' +
    (typeof canProfit === 'function' && canProfit() && (inv.kind === 'sale' || inv.kind === 'sale_ret') ? '<div class="row"><span class="grow">سود این فاکتور</span><b class="' + (inv.profit < 0 ? 'neg' : 'pos') + '">' + fm(inv.profit || 0) + '</b></div>' : '') +
    (inv._short ? '<p class="neg small">⚠️ موجودی برخی اقلام هنگام ثبت کافی نبوده (موجودی منفی).</p>' : '') +
    (inv.seller ? '<p class="mut small">فروشنده: ' + esc(inv.seller) + '</p>' : '') +
    (hasPlan ? '<p class="mut small">📅 این فاکتور برنامه اقساط دارد (بخش مالی ← اقساط).</p>' : '') +
    (inv.note ? '<p class="mut small">📝 ' + esc(inv.note) + '</p>' : '');
  var btns = [];
  if (inv.status === 'final') btns.push({ label: '✏️ ویرایش', cb: function (c) { c(); openInvoiceEditor(inv.kind, inv.id); } });
  btns.push({ label: '🖨 چاپ/PDF', cls: 'blue', cb: function () { printInvoice(id); } });
  btns.push({ label: '🖨 چاپ بلوتوثی', cls: 'gray', cb: function (c) { c(); btPrintInvoice(id); } });
  btns.push({ label: '📤 ارسال', cls: 'gray', cb: function () { shareInvoiceText(id); } });
  if (inv.kind === 'sale' && inv.status === 'final' && !hasPlan && invoiceRemain(inv) > 0)
    btns.push({ label: '📅 فروش اقساطی', cb: function (c) { c(); installmentDialog(id); } });
  if (hasPlan) btns.push({ label: '📅 مشاهده اقساط', cb: function (c) { c(); show('finance', 'inst'); } });
  if (inv.kind === 'proforma' && inv.status === 'final') btns.push({ label: '✅ تبدیل به فاکتور فروش', cb: function (c) {
    var r = createInvoice({ kind: 'sale', personId: inv.personId, date: todayISO(), items: inv.items, gdisc: inv.gdisc, tax: inv.tax, shipping: inv.shipping, note: inv.note, paidBy: [] });
    c();
    if (r.ok) { toast('به فاکتور فروش شماره ' + fn(r.inv.no) + ' تبدیل شد'); show('sale'); } else toast('خطا در تبدیل');
  } });
  if (inv.status === 'final' && (typeof canVoid !== 'function' || canVoid())) btns.push({ label: '🚫 ابطال', cls: 'warn', cb: function (c) {
    c();
    uiConfirm('این فاکتور باطل شود؟ اثرش روی موجودی، حساب طرف و صندوق حذف می‌شود اما سابقه‌اش می‌ماند.').then(function (ok) {
      if (ok) { voidInvoice(id); toast('فاکتور باطل شد'); refresh(); }
    });
  } });
  if (typeof canDelete !== 'function' || canDelete()) btns.push({ label: '🗑 حذف کامل', cls: 'danger', cb: function (c) {
    c();
    uiConfirm('فاکتور به‌طور کامل حذف شود؟ این کار قابل برگشت نیست.').then(function (ok) {
      if (ok) { deleteInvoice(id); toast('حذف شد'); refresh(); }
    });
  } });
  btns.push({ label: 'بستن', cls: 'gray' });
  openModal(KIND_LABEL[inv.kind], body, btns);
}

/* ---------- ویرایشگر فاکتور ---------- */
var D = null; /* پیش‌نویس فاکتور */
var pageBack = null;
function computeDraft() {
  var items = 0;
  D.items.forEach(function (it) { items += lineTotal(it); });
  var taxAmt = Math.round((items - nd(D.gdisc)) * nd(D.tax) / 100);
  var total = Math.round(items - nd(D.gdisc) + taxAmt + nd(D.shipping));
  var paid = 0; D.paidBy.forEach(function (p) { paid += nd(p.amount); });
  return { items: Math.round(items), taxAmt: taxAmt, total: total, paid: paid, remain: total - paid };
}
function openInvoiceEditor(kind, invId) {
  if (!invId && !limitGate('invoice')) return;
  var inv = invId ? invById(invId) : null;
  D = {
    kind: kind, id: invId || null, personId: inv ? inv.personId : '',
    whId: inv ? (inv.whId || defWh()) : defWh(), seller: inv ? (inv.seller || '') : '',
    date: inv ? inv.date : todayISO(),
    items: inv ? inv.items.map(function (it) { return { pid: it.pid, name: it.name, qty: it.qty, price: it.price, disc: it.disc }; }) : [],
    gdisc: inv ? inv.gdisc : 0, tax: inv ? inv.tax : (kind === 'purchase' ? 0 : DB.settings.defaultTax),
    shipping: inv ? inv.shipping : 0, note: inv ? inv.note : '',
    paidBy: inv ? inv.paidBy.map(function (p) { return { accId: p.accId, amount: p.amount }; }) : []
  };
  var backSec = kind === 'purchase' || kind === 'purchase_ret' ? 'buy' : 'sale';
  pageBack = function () { pageBack = null; D = null; show(backSec); return true; };
  renderInvoiceEditor();
}
function renderInvoiceEditor() {
  var v = $('#view'), isBuy = D.kind === 'purchase' || D.kind === 'purchase_ret';
  $('#topTitle').textContent = (D.id ? 'ویرایش ' : '') + KIND_LABEL[D.kind];
  var h = '<button class="btn gray sm" id="ivBack">← بازگشت</button>' +
    '<div class="secTitle" style="margin-top:10px">' + (D.id ? '✏️ ویرایش ' : '＋ ') + KIND_LABEL[D.kind] + '</div>' +
    '<div class="card">' +
    fRow(tr(isBuy ? 'تأمین‌کننده' : 'مشتری'), '<div class="row"><select id="ivPer" class="grow">' + perOptions(D.personId, isBuy ? 'supplier' : 'customer') + '</select><button class="btn gray" id="ivNewPer" type="button">＋ شخص</button></div>') +
    '<div class="grid2">' + fRow(tr('تاریخ (شمسی)'), calField('ivDate', D.date)) +
    fRow(tr('فروشنده/صادرکننده'), '<input id="ivSeller" placeholder="اختیاری" value="' + esc(D.seller || '') + '">') + '</div>' +
    (DB.warehouses.length > 1 ? fRow('انبار', '<select id="ivWh">' + DB.warehouses.map(function (w) { return '<option value="' + w.id + '"' + (D.whId === w.id ? ' selected' : '') + '>' + esc(w.name) + '</option>'; }).join('') + '</select>') : '') +
    '<div class="err" id="ivErr"></div></div>' +
    '<div class="card"><h3>' + tr('اقلام') + '</h3>' +
    '<div class="row"><input class="searchBox grow" id="ivSearch" placeholder="نام، کد یا بارکد کالا…" autocomplete="off" style="margin-bottom:0"><button class="btn gray" id="ivScan" type="button">📷 اسکن</button><button class="btn gray" id="ivVoice" type="button">🎤 صوتی</button></div>' +
    '<div id="ivResults" style="margin-top:10px"></div><div id="ivItems"></div>' +
    '<button class="btn gray sm" id="ivNewProd">＋ کالای جدید</button></div>' +
    '<div class="card"><h3>' + tr('جمع‌بندی') + '</h3>' +
    '<div class="grid2">' +
    fRow('تخفیف روی کل فاکتور', '<input id="ivGdisc" inputmode="numeric" value="' + (D.gdisc ? fn(D.gdisc) : '') + '">') +
    fRow('مالیات ٪', '<input id="ivTax" inputmode="numeric" value="' + faNum(D.tax) + '">') +
    fRow('هزینه حمل', '<input id="ivShip" inputmode="numeric" value="' + (D.shipping ? fn(D.shipping) : '') + '">') +
    fRow('توضیحات', '<input id="ivNote" value="' + esc(D.note) + '">') + '</div>' +
    '<div id="ivTotals"></div></div>' +
    (D.kind !== 'proforma' ? '<div class="card"><h3>' + tr(isBuy ? 'پرداخت به تأمین‌کننده' : 'دریافت از مشتری') + '</h3>' +
    '<div class="payChips"><button type="button" data-pm="cash" id="pmCash">💵 نقدی</button><button type="button" data-pm="card" id="pmCard">💳 کارت</button><button type="button" data-pm="credit" id="pmCredit">🕐 نسیه</button></div>' +
    '<div id="ivPays"></div>' +
      '<div class="row"><button class="btn gray sm" id="ivAddPay">＋ افزودن پرداخت</button>' +
      '<button class="btn gray sm" id="ivFullPay">تسویه کامل با صندوق</button></div></div>' : '') +
    '<button class="btn block" id="ivSave" style="padding:14px;font-size:17px">✔ ثبت ' + KIND_LABEL[D.kind] + '</button>' +
    '<div style="height:10px"></div>';
  v.innerHTML = h;
  $('#ivBack').onclick = function () { pageBack(); };
  $('#ivPer').onchange = function () { D.personId = this.value; };
  var whSel = $('#ivWh'); if (whSel) whSel.onchange = function () { D.whId = this.value; renderIvItems(); };
  var slr = $('#ivSeller'); if (slr) slr.oninput = function () { D.seller = this.value; };
  $('#ivNewPer').onclick = function () {
    personEditor(null, function (np) {
      D.personId = np.id;
      $('#ivPer').innerHTML = perOptions(np.id, isBuy ? 'supplier' : 'customer');
    });
  };
  $('#ivDate').onchange = function () {
    var iso = getCal('ivDate');
    if (iso) { D.date = iso; $('#ivErr').textContent = ''; } else $('#ivErr').textContent = 'تاریخ نامعتبر است (مثال: ۱۴۰۳/۰۷/۲۸).';
  };
  var srch = $('#ivSearch');
  srch.oninput = function () { renderIvResults(srch.value); };
  renderIvItems(); renderIvTotals(); renderIvPays();
  $('#ivGdisc').oninput = function () { D.gdisc = nd(this.value); renderIvTotals(); };
  $('#ivTax').oninput = function () { D.tax = nd(this.value); renderIvTotals(); };
  $('#ivShip').oninput = function () { D.shipping = nd(this.value); renderIvTotals(); };
  $('#ivNote').oninput = function () { D.note = this.value; };
  $('#ivNewProd').onclick = function () { productEditor(); };
  var ivv = $('#ivVoice');
  if (ivv) ivv.onclick = function () { startVoice('invoice'); };
  $('#ivScan').onclick = function () {
    Scanner.open({
      title: 'اسکن اقلام فاکتور', continuous: true, mode: 'lookup',
      onCode: function (code, ctl) {
        var p = productByBarcode(code);
        if (p) { ivAddProduct(p); ctl.note('➕ «' + p.name + '» اضافه شد', 'ok'); }
        else { ctl.note('کالایی با بارکد ' + code + ' پیدا نشد', 'err'); ctl.unknown(code); }
      },
      onCreate: function (code) {
        productEditor();
        var b = $('#pfBar'); if (b) b.value = code;
        toast('بارکد در فرم کالا قرار گرفت؛ مشخصات را کامل کنید و ذخیره بزنید');
      }
    });
  };
  var ap = $('#ivAddPay'); if (ap) ap.onclick = function () { D.paidBy.push({ accId: DB.accounts.length ? DB.accounts[0].id : '', amount: 0 }); D.payMode = 'custom'; renderIvPays(); renderIvTotals(); };
  var pc = $('#pmCash'); if (pc) pc.onclick = function () { setPayChip('cash'); };
  var pk = $('#pmCard'); if (pk) pk.onclick = function () { setPayChip('card'); };
  var pr = $('#pmCredit'); if (pr) pr.onclick = function () { setPayChip('credit'); };
  var fp = $('#ivFullPay'); if (fp) fp.onclick = function () {
    var t = computeDraft(), cash = DB.accounts.filter(function (a) { return a.type === 'cash'; })[0] || DB.accounts[0];
    if (!cash) { toast('ابتدا یک حساب/صندوق تعریف کنید'); return; }
    D.paidBy = [{ accId: cash.id, amount: t.total }];
    renderIvPays(); renderIvTotals();
  };
  $('#ivSave').onclick = saveDraftInvoice;
}
function renderIvResults(q) {
  var box = $('#ivResults'); if (!box) return;
  q = (q || '').replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - FA_ZERO; }).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - AR_ZERO; }).toLowerCase().trim();
  if (!q) { box.innerHTML = ''; return; }
  var list = DB.products.filter(function (p) {
    return p.name.toLowerCase().indexOf(q) >= 0 || String(p.code || '').indexOf(q) >= 0 ||
      allBarcodes(p).some(function (b) { return String(b).indexOf(q) >= 0; });
  }).slice(0, 8);
  box.innerHTML = list.map(function (p) {
    var price = (D.kind === 'purchase' || D.kind === 'purchase_ret') ? p.buyPrice : p.sellPrice;
    return '<div class="listItem" data-add="' + p.id + '" style="margin-bottom:6px"><div class="main"><div class="t">' + esc(p.name) + '</div>' +
      '<div class="s">موجودی ' + fn(DB.warehouses.length > 1 ? whStock(p, D.whId) : p._stock) + ' · ' + fn(price) + '</div></div><span class="chip green">＋ افزودن</span></div>';
  }).join('') || '<p class="mut small">کالایی یافت نشد.</p>';
  $$('#ivResults [data-add]').forEach(function (el) {
    el.onclick = function () {
      var p = prodById(el.dataset.add);
      ivAddProduct(p);
      $('#ivSearch').value = ''; box.innerHTML = '';
    };
  });
}
function ivAddProduct(p) {
  if (!p) return;
  var price = (D.kind === 'purchase' || D.kind === 'purchase_ret') ? p.buyPrice : p.sellPrice;
  var ex = D.items.filter(function (it) { return it.pid === p.id; })[0];
  if (ex) ex.qty = nd(ex.qty) + 1; else D.items.push({ pid: p.id, name: p.name, qty: 1, price: price, disc: 0 });
  renderIvItems(); renderIvTotals();
}
function renderIvItems() {
  var box = $('#ivItems'); if (!box) return;
  if (!D.items.length) { box.innerHTML = '<div class="empty">هنوز قلمی اضافه نشده. از جست‌وجوی بالا کالا انتخاب کنید.</div>'; return; }
  box.innerHTML = D.items.map(function (it, ix) {
    var p = prodById(it.pid);
    var dispStock = p ? (DB.warehouses.length > 1 ? whStock(p, D.whId) : p._stock) : 0;
    var hasPack = p && p.packSize > 1, isPack = hasPack && it.unit === 'pack';
    var dispQty = isPack ? (nd(it.qty) / p.packSize) : it.qty;
    var dispPrice = isPack ? (nd(it.price) * p.packSize) : it.price;
    return '<div class="invItem"><div class="row">' + prodThumbHtml(p, true) + '<b class="grow">' + esc(it.name) + '</b>' +
      (p ? '<span class="chip ' + (dispStock <= 0 ? 'red' : 'blue') + '">موجودی ' + fn(dispStock) + '</span>' : '') +
      '<button class="btn danger sm" data-del="' + ix + '">✕</button></div>' +
      '<div class="gridRow">' +
      '<label class="small mut">تعداد<div class="stepper"><button type="button" data-step="-1" data-ix="' + ix + '">−</button><input data-ix="' + ix + '" data-f="qty" inputmode="decimal" value="' + faNum(dispQty) + '"><button type="button" data-step="1" data-ix="' + ix + '">＋</button></div></label>' +
      '<label class="small mut">تخفیف٪<input data-ix="' + ix + '" data-f="disc" inputmode="decimal" value="' + faNum(it.disc || 0) + '"></label>' +
      '<label class="small mut">قیمت واحد<input data-ix="' + ix + '" data-f="price" inputmode="numeric" value="' + fn(dispPrice) + '"></label>' +
      '<label class="small mut">مبلغ<input value="' + fn(lineTotal(it)) + '" disabled></label>' +
      (hasPack ? '<label class="small mut">واحد فروش<select data-u="' + ix + '"><option value="base"' + (!isPack ? ' selected' : '') + '>' + esc(p.unit || 'عدد') + '</option><option value="pack"' + (isPack ? ' selected' : '') + '>' + esc(p.packName || 'بسته') + ' (' + fn(p.packSize) + ')</option></select></label>' : '') +
      '</div></div>';
  }).join('');
  $$('#ivItems [data-u]').forEach(function (sel) {
    sel.onchange = function () {
      D.items[+sel.dataset.u].unit = sel.value;
      renderIvItems(); renderIvTotals();
    };
  });
  $$('#ivItems [data-del]').forEach(function (b) {
    b.onclick = function () { D.items.splice(+b.dataset.del, 1); renderIvItems(); renderIvTotals(); };
  });
  $$('#ivItems [data-step]').forEach(function (b) {
    b.onclick = function () {
      var it = D.items[+b.dataset.ix];
      var pp = prodById(it.pid);
      var mult = (it.unit === 'pack' && pp && pp.packSize > 1) ? pp.packSize : 1;
      it.qty = Math.max(0, (nd(it.qty) || 0) + (+b.dataset.step) * mult);
      renderIvItems(); renderIvTotals();
    };
  });
  $$('#ivItems input[data-ix]').forEach(function (inp) {
    inp.oninput = function () {
      var it = D.items[+inp.dataset.ix], f = inp.dataset.f, v = nd(inp.value);
      var pp = prodById(it.pid);
      var isP = it.unit === 'pack' && pp && pp.packSize > 1;
      if (f === 'qty') it.qty = isP ? v * pp.packSize : v;
      else if (f === 'price') it.price = isP ? v / pp.packSize : v;
      else it[f] = v;
      renderIvTotals();
      var row = inp.closest('.invItem'); if (row) row.querySelectorAll('input')[3].value = fn(lineTotal(it));
    };
  });
}
function renderIvTotals() {
  var box = $('#ivTotals'); if (!box) return;
  var t = computeDraft();
  box.innerHTML = '<div class="totBox">' +
    '<div class="tr"><span>جمع اقلام</span><span>' + fm(t.items) + '</span></div>' +
    (nd(D.gdisc) ? '<div class="tr"><span>تخفیف</span><span>− ' + fm(D.gdisc) + '</span></div>' : '') +
    (nd(D.tax) ? '<div class="tr"><span>مالیات</span><span>' + fm(t.taxAmt) + '</span></div>' : '') +
    (nd(D.shipping) ? '<div class="tr"><span>حمل</span><span>' + fm(D.shipping) + '</span></div>' : '') +
    '<div class="tr grand"><span>جمع کل</span><span>' + fm(t.total) + '</span></div>' +
    (D.kind !== 'proforma' ? '<div class="tr"><span>پرداخت‌شده</span><span>' + fm(t.paid) + '</span></div><div class="tr"><span>مانده</span><span>' + fm(t.remain) + '</span></div>' : '') +
    '</div>';
}
function renderIvPays() {
  var box = $('#ivPays'); if (!box) return;
  box.innerHTML = D.paidBy.map(function (p, px) {
    return '<div class="row" style="margin-bottom:8px"><select data-px="' + px + '" data-f="accId" class="grow" style="padding:9px;border:1px solid var(--line);border-radius:9px">' + accOptions(p.accId) + '</select>' +
      '<input data-px="' + px + '" data-f="amount" inputmode="numeric" placeholder="مبلغ" value="' + (p.amount ? fn(p.amount) : '') + '" style="flex:1;padding:9px;border:1px solid var(--line);border-radius:9px">' +
      '<button class="btn danger sm" data-pdel="' + px + '">✕</button></div>';
  }).join('') || '<p class="mut small">پرداختی ثبت نشده (فاکتور نسیه می‌ماند).</p>';
  $$('#ivPays [data-pdel]').forEach(function (b) { b.onclick = function () { D.paidBy.splice(+b.dataset.pdel, 1); renderIvPays(); renderIvTotals(); }; });
  $$('#ivPays [data-px]').forEach(function (inp) {
    inp.onchange = inp.oninput = function () {
      var rec = D.paidBy[+inp.dataset.px];
      if (inp.dataset.f === 'accId') rec.accId = inp.value; else rec.amount = nd(inp.value);
      D.payMode = 'custom';
      renderIvTotals(); markPayChips();
    };
  });
  markPayChips();
}
function markPayChips() {
  $$('.payChips button').forEach(function (b) { b.classList.toggle('on', b.dataset.pm === D.payMode); });
}
function setPayChip(mode) {
  var t = computeDraft().total, acc;
  if (mode === 'credit') { D.paidBy = []; }
  else {
    acc = DB.accounts.filter(function (a) { return mode === 'cash' ? a.type === 'cash' : a.type === 'bank'; })[0] || DB.accounts[0];
    if (!acc) { toast('ابتدا یک حساب در بخش مالی بسازید'); return; }
    D.paidBy = [{ accId: acc.id, amount: t }];
  }
  D.payMode = mode;
  renderIvPays(); renderIvTotals();
}
function saveDraftInvoice() {
  var err = $('#ivErr');
  if (!D.items.length) { err.textContent = 'حداقل یک قلم به فاکتور اضافه کنید.'; return; }
  var iso = getCal('ivDate');
  if (!iso) { err.textContent = 'تاریخ نامعتبر است.'; return; }
  D.date = iso; D.personId = val('ivPer');
  var payload = { kind: D.kind, personId: D.personId, whId: D.whId, seller: D.seller || '', date: D.date, items: D.items, gdisc: D.gdisc, tax: D.tax, shipping: D.shipping, note: D.note, paidBy: D.paidBy };
  function doSave() {
    var r = D.id ? updateInvoice(D.id, payload) : createInvoice(payload);
    if (!r.ok) { err.textContent = r.errs.join(' '); return; }
    toast(KIND_LABEL[D.kind] + ' شماره ' + fn(r.inv.no) + ' ثبت شد');
    var sec = D.kind === 'purchase' || D.kind === 'purchase_ret' ? 'buy' : 'sale';
    pageBack = null; var theInv = r.inv; D = null;
    show(sec);
    setTimeout(function () { invoiceDetail(theInv.id); }, 60);
  }
  if (D.kind === 'sale') {
    var short = [];
    D.items.forEach(function (it) {
      var p = prodById(it.pid); if (!p) return;
      var avail = whStock(p, D.whId) + (D.id ? (function () { var o = invById(D.id); var s = 0; if (o && (o.whId || defWh()) === D.whId) o.items.forEach(function (oi) { if (oi.pid === it.pid) s += nd(oi.qty); }); return s; })() : 0);
      if (nd(it.qty) > avail) short.push(p.name + ' (موجودی انبار ' + fn(avail) + ')');
    });
    if (short.length) {
      uiConfirm('موجودی این کالاها کافی نیست: ' + short.join('، ') + '. فاکتور با موجودی منفی ثبت شود؟').then(function (ok) { if (ok) doSave(); });
      return;
    }
  }
  doSave();
}

/* ---------- اشخاص ---------- */
var perTab = 'all', perQuery = '';
var KIND_PERSON = { customer: 'مشتری', supplier: 'تأمین‌کننده', both: 'مشتری و تأمین‌کننده' };
function renderPersons() {
  var v = $('#view');
  var h = '<div class="secTitle">👥 ' + tr('اشخاص') + '</div>' +
    '<div class="row" style="align-items:center"><input class="searchBox grow" style="margin-bottom:0" id="perSearch" placeholder="جست‌وجو: نام یا تلفن…" value="' + esc(perQuery) + '"><button class="btn gray sm" type="button" data-voice-field="perSearch" title="جست‌وجوی صوتی">🎤</button></div>' +
    '<div class="tabs"><button data-t="all" class="' + (perTab === 'all' ? 'active' : '') + '">' + tr('همه') + '</button>' +
    '<button data-t="customer" class="' + (perTab === 'customer' ? 'active' : '') + '">' + tr('مشتریان') + '</button>' +
    '<button data-t="supplier" class="' + (perTab === 'supplier' ? 'active' : '') + '">' + tr('تأمین‌کنندگان') + '</button>' +
    '<button data-t="debtors" class="' + (perTab === 'debtors' ? 'active' : '') + '">' + tr('بدهکاران') + '</button></div>' +
    '<button class="btn block" id="perNew" style="margin-bottom:12px">＋ شخص جدید</button>';
  var q = perQuery.replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - FA_ZERO; }).toLowerCase();
  var list = DB.persons.map(function (p) { return { p: p, bal: personBalance(p.id) }; }).filter(function (x) {
    if (perTab === 'customer' && !(x.p.kind === 'customer' || x.p.kind === 'both')) return false;
    if (perTab === 'supplier' && !(x.p.kind === 'supplier' || x.p.kind === 'both')) return false;
    if (perTab === 'debtors' && x.bal <= 0) return false;
    if (q && x.p.name.toLowerCase().indexOf(q) < 0 && String(x.p.phone || '').indexOf(q) < 0) return false;
    return true;
  }).sort(function (a, b) { return Math.abs(b.bal) - Math.abs(a.bal); });
  if (!list.length) h += '<div class="empty">شخصی پیدا نشد.</div>';
  h += list.map(function (x) {
    var p = x.p, bal = x.bal;
    var chip = bal > 0 ? '<span class="chip red">بدهکار ' + fm(bal) + '</span>' : bal < 0 ? '<span class="chip blue">طلبکار ' + fm(-bal) + '</span>' : '<span class="chip green">تسویه</span>';
    return '<div class="listItem" data-per="' + p.id + '">' + thumbHtml(p.name) + '<div class="main"><div class="t">' + esc(p.name) + '</div>' +
      '<div class="s">' + KIND_PERSON[p.kind] + (p.phone ? ' · <span class="ltr">' + esc(p.phone) + '</span>' : '') + '</div></div>' + chip + '</div>';
  }).join('');
  v.innerHTML = h;
  $$('#view .tabs [data-t]').forEach(function (b) { b.onclick = function () { perTab = b.dataset.t; renderPersons(); }; });
  var sb = $('#perSearch');
  sb.oninput = function () { perQuery = sb.value; renderPersons(); var s2 = $('#perSearch'); s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length); };
  $('#perNew').onclick = function () { personEditor(); };
  $$('#view [data-per]').forEach(function (el) { el.onclick = function () { personDetail(el.dataset.per); }; });
}
function personEditor(id, onSaved) {
  var p = id ? personById(id) : null;
  var body =
    fRow('نام *', '<input id="peName" value="' + esc(p ? p.name : '') + '">') +
    fRow('نوع شخص', '<select id="peKind"><option value="customer"' + (p && p.kind === 'customer' ? ' selected' : '') + '>مشتری</option><option value="supplier"' + (p && p.kind === 'supplier' ? ' selected' : '') + '>تأمین‌کننده</option><option value="both"' + (p && p.kind === 'both' ? ' selected' : '') + '>هر دو</option></select>') +
    '<div class="grid2">' + fRow('تلفن', '<input id="pePhone" inputmode="tel" value="' + esc(p ? p.phone : '') + '">') +
    fRow('مانده اولیه (مثبت=بدهکار ما)', '<input id="peOpen" inputmode="numeric" value="' + (p ? faNum(p.opening) : '') + '">') + '</div>' +
    fRow('سقف اعتبار', '<input id="peCredit" inputmode="numeric" value="' + (p ? faNum(p.creditLimit) : '') + '">') +
    fRow('آدرس', '<input id="peAddr" value="' + esc(p ? p.address : '') + '">') +
    fRow('یادداشت', '<textarea id="peNote">' + esc(p ? p.note : '') + '</textarea>') +
    '<div class="err" id="peErr"></div>';
  var btns = [
    { label: 'ذخیره', cb: function (close) {
        var name = val('peName').trim();
        if (!name) { $('#peErr').textContent = 'نام را وارد کنید.'; return; }
        var data = { name: name, kind: val('peKind'), phone: val('pePhone').trim(), opening: num('peOpen'), creditLimit: num('peCredit'), address: val('peAddr'), note: val('peNote') };
        var rec;
        if (p) { for (var k in data) p[k] = data[k]; rec = p; }
        else { data.id = newId('per'); DB.persons.push(data); rec = data; }
        saveDB(); close();
        if (onSaved) onSaved(rec); else refresh();
        toast('شخص ذخیره شد');
      } },
    { label: 'بستن', cls: 'gray' }
  ];
  if (p) btns.splice(1, 0, { label: 'حذف', cls: 'danger', cb: function (close) {
    close();
    uiConfirm('شخص «' + p.name + '» حذف شود؟ فاکتورهای مرتبط بدون طرف حساب می‌شوند.').then(function (ok) {
      if (!ok) return;
      DB.persons = DB.persons.filter(function (x) { return x.id !== p.id; });
      saveDB(); refresh(); toast('حذف شد');
    });
  } });
  openModal(p ? 'ویرایش شخص' : 'شخص جدید', body, btns);
}
function personDetail(pid) {
  var p = personById(pid); if (!p) return;
  var bal = personBalance(pid);
  var rows = personStatement(pid);
  var tbl = rows.map(function (r) {
    return '<tr' + (r.invId ? ' data-inv="' + r.invId + '" style="cursor:pointer"' : '') + '><td>' + (r.date ? fd(r.date) : '—') + '</td><td>' + esc(r.label) + '</td><td class="n">' + (r.debit ? fn(r.debit) : '') + '</td><td class="n">' + (r.credit ? fn(r.credit) : '') + '</td><td class="n">' + fn(r.bal) + '</td></tr>';
  }).join('');
  var body =
    '<div class="row"><b class="grow">' + esc(p.name) + '</b><span class="chip ' + (bal > 0 ? 'red' : bal < 0 ? 'blue' : 'green') + '">' +
    (bal > 0 ? 'بدهکار: ' : bal < 0 ? 'طلبکار: ' : '') + fm(Math.abs(bal)) + '</span></div>' +
    '<p class="mut small">' + KIND_PERSON[p.kind] + (p.phone ? ' · <span class="ltr">' + esc(p.phone) + '</span>' : '') + (p.address ? ' · ' + esc(p.address) : '') + (p.creditLimit ? ' · سقف اعتبار ' + fm(p.creditLimit) : '') + '</p>' +
    (bal > 0 && nd(p.creditLimit) > 0 && bal > nd(p.creditLimit) ? '<p class="neg small">⚠️ بدهی از سقف اعتبار بیشتر شده است.</p>' : '') +
    '<div class="row" style="margin-bottom:10px"><button class="btn sm" id="pdReceive">💵 دریافت وجه</button>' +
    '<button class="btn gray sm" id="pdPay">💸 پرداخت وجه</button>' +
    '<button class="btn gray sm" id="pdShare">📤 ارسال صورت‌حساب</button></div>' +
    (p.kind !== 'supplier' ? (function () { var pts = clubPoints(pid), lv = clubLevel(pts); return '<div class="row" style="margin-bottom:10px"><span class="chip amber">🎁 باشگاه: ' + fn(pts) + ' امتیاز · سطح ' + lv.name + ' ' + lv.ic + (lv.next ? ' · ' + fn(lv.next) + ' تا سطح بعد' : '') + '</span>' +
      '<button class="btn gray sm" id="pdClub">🎁 پیام باشگاه</button>' +
      (bal > 0 ? '<button class="btn gray sm" id="pdRemind">💬 یادآوری بدهی</button>' : '') + '</div>'; })() : '') +
    '<h3>گردش حساب</h3><div class="tblwrap"><table class="tbl"><tr><th>تاریخ</th><th>شرح</th><th class="n">بدهکار</th><th class="n">بستانکار</th><th class="n">مانده</th></tr>' +
    (tbl || '<tr><td colspan="5" class="mut">گردشی ثبت نشده.</td></tr>') + '</table></div>' +
    '<p class="mut small">مانده مثبت یعنی شخص به فروشگاه بدهکار است.</p>';
  openModal('صورت‌حساب شخص', body, [
    { label: '✏️ ویرایش شخص', cb: function (c) { c(); personEditor(pid); } },
    { label: 'بستن', cls: 'gray' }
  ]);
  $('#pdReceive').onclick = function () { paymentEditor(null, { personId: pid, dir: 'receive' }); };
  $('#pdPay').onclick = function () { paymentEditor(null, { personId: pid, dir: 'pay' }); };
  $('#pdShare').onclick = function () {
    var lines = ['صورت‌حساب ' + p.name + ' — ' + DB.settings.shopName, 'تاریخ: ' + fd(todayISO())];
    rows.slice(-12).forEach(function (r) { lines.push((r.date ? fd(r.date) : '') + ' ' + r.label + ' — مانده: ' + faNum(r.bal)); });
    lines.push('مانده فعلی: ' + faNum(bal) + ' ' + DB.settings.currency + (bal > 0 ? ' (بدهکار)' : bal < 0 ? ' (طلبکار)' : ''));
    doShareText(lines.join('\n'));
  };
  var pc = $('#pdClub');
  if (pc) pc.onclick = function () {
    var pts = clubPoints(pid), lv = clubLevel(pts);
    doShareText('🎁 ' + p.name + ' عزیز، شما در باشگاه مشتریان «' + DB.settings.shopName + '» ' + faNum(pts) + ' امتیاز دارید (سطح ' + lv.name + ' ' + lv.ic + ').' +
      (lv.next ? ' تا سطح بعد فقط ' + faNum(lv.next) + ' امتیاز مانده!' : ' شما از بهترین مشتریان ما هستید!') + '\nاز خرید و همراهی‌تان سپاس‌گزاریم 🌹');
  };
  var pr = $('#pdRemind');
  if (pr) pr.onclick = function () {
    doShareText('سلام ' + p.name + ' عزیز 🌹\nیادآوری دوستانه از «' + DB.settings.shopName + '»: مانده حساب شما ' + faNum(Math.abs(bal)) + ' ' + DB.settings.currency + ' بدهی است.\nبرای تسویه یا دریافت صورت‌حساب کامل در خدمتیم. سپاس از همراهی شما 🙏');
  };
  $$('#modalRoot [data-inv]').forEach(function (el) { el.onclick = function () { $('#modalRoot').innerHTML = ''; invoiceDetail(el.dataset.inv); }; });
}

/* ---------- مالی ---------- */
var finTab = 'accounts';
function renderFinance(arg) {
  if (arg) finTab = arg;
  var v = $('#view');
  var h = '<div class="secTitle">💰 ' + tr('مالی') + '</div>' +
    '<div class="tabs">' +
    '<button data-t="accounts" class="' + (finTab === 'accounts' ? 'active' : '') + '">' + tr('صندوق و بانک') + '</button>' +
    '<button data-t="payments" class="' + (finTab === 'payments' ? 'active' : '') + '">' + tr('دریافت و پرداخت') + '</button>' +
    '<button data-t="expenses" class="' + (finTab === 'expenses' ? 'active' : '') + '">' + tr('هزینه‌ها') + '</button>' +
    '<button data-t="incomes" class="' + (finTab === 'incomes' ? 'active' : '') + '">' + tr('درآمدها') + '</button>' +
    '<button data-t="transfers" class="' + (finTab === 'transfers' ? 'active' : '') + '">' + tr('انتقال وجه') + '</button>' +
    '<button data-t="inst" class="' + (finTab === 'inst' ? 'active' : '') + '">📅 ' + tr('اقساط') + '</button>' +
    '<button data-t="recon" class="' + (finTab === 'recon' ? 'active' : '') + '">🏦 مغایرت بانکی</button></div>';
  if (finTab === 'accounts') h += finAccountsHtml();
  else if (finTab === 'payments') h += finPaymentsHtml();
  else if (finTab === 'expenses') h += finExpensesHtml();
  else if (finTab === 'incomes') h += finIncomesHtml();
  else if (finTab === 'inst') h += installmentsHtml();
  else if (finTab === 'recon') h += reconHtml();
  else h += finTransfersHtml();
  v.innerHTML = h;
  $$('#view .tabs [data-t]').forEach(function (b) { b.onclick = function () { finTab = b.dataset.t; renderFinance(); }; });
  if (finTab === 'accounts') wireAccounts();
  else if (finTab === 'payments') wirePayments();
  else if (finTab === 'expenses') wireExpenses();
  else if (finTab === 'incomes') wireIncomes();
  else if (finTab === 'inst') wireInstallments();
  else if (finTab === 'recon') { wireRecon(); }
  else wireTransfers();
}
function finAccountsHtml() {
  var h = '<button class="btn block" id="aNew" style="margin-bottom:12px">＋ حساب جدید (صندوق/بانک)</button>';
  h += DB.accounts.map(function (a) {
    var bal = accountBalance(a.id);
    return '<div class="listItem" data-acc="' + a.id + '"><div class="main"><div class="t">' + (a.type === 'cash' ? '💵 ' : '🏦 ') + esc(a.name) + '</div>' +
      '<div class="s">' + (a.type === 'cash' ? 'صندوق' : 'بانک') + ' · موجودی اولیه ' + fn(a.opening) + '</div></div><div class="amt ' + (bal < 0 ? 'neg' : 'pos') + '">' + fm(bal) + '</div></div>';
  }).join('');
  h += '<div class="card"><div class="row"><span class="grow">جمع کل نقدینگی</span><b>' + fm(accountsTotal()) + '</b></div></div>';
  return h;
}
function wireAccounts() {
  $('#aNew').onclick = function () { accountEditor(); };
  $$('#view [data-acc]').forEach(function (el) { el.onclick = function () { accountEditor(el.dataset.acc); }; });
}
function accountEditor(id) {
  var a = id ? accById(id) : null;
  openModal(a ? 'ویرایش حساب' : 'حساب جدید',
    fRow('نام حساب', '<input id="afName" value="' + esc(a ? a.name : '') + '">') +
    fRow('نوع', '<select id="afType"><option value="cash"' + (a && a.type === 'cash' ? ' selected' : '') + '>صندوق</option><option value="bank"' + (a && a.type === 'bank' ? ' selected' : '') + '>بانک</option></select>') +
    fRow('موجودی اولیه', '<input id="afOpen" inputmode="numeric" value="' + (a ? faNum(a.opening) : '') + '">') +
    '<div class="err" id="afErr"></div>',
    [
      { label: 'ذخیره', cb: function (close) {
          var name = val('afName').trim();
          if (!name) { $('#afErr').textContent = 'نام حساب را وارد کنید.'; return; }
          if (a) { a.name = name; a.type = val('afType'); a.opening = num('afOpen'); }
          else DB.accounts.push({ id: newId('acc'), name: name, type: val('afType'), opening: num('afOpen') });
          saveDB(); close(); refresh(); toast('حساب ذخیره شد');
        } },
      a ? { label: 'حذف', cls: 'danger', cb: function (close) {
          close();
          uiConfirm('حساب «' + a.name + '» حذف شود؟ ثبت‌های مالی مرتبط بدون حساب می‌مانند.').then(function (ok) {
            if (!ok) return;
            DB.accounts = DB.accounts.filter(function (x) { return x.id !== a.id; });
            saveDB(); refresh(); toast('حذف شد');
          });
        } } : { label: 'انصراف', cls: 'gray' }
    ]);
}
function payRowHtml(pay) {
  var per = personById(pay.personId), acc = accById(pay.accId);
  return '<div class="listItem" data-pay="' + pay.id + '"><div class="main"><div class="t">' + (pay.dir === 'receive' ? '💵 دریافت از ' : '💸 پرداخت به ') + (per ? esc(per.name) : '؟') + '</div>' +
    '<div class="s">' + fd(pay.date) + ' · ' + esc(acc ? acc.name : '؟') + (pay.note ? ' · ' + esc(pay.note) : '') + '</div></div>' +
    '<div class="amt ' + (pay.dir === 'receive' ? 'pos' : 'neg') + '">' + fm(pay.amount) + '</div></div>';
}
function finPaymentsHtml() {
  var h = '<button class="btn block" id="payNew" style="margin-bottom:12px">＋ ثبت دریافت/پرداخت</button>';
  var list = DB.payments.slice().sort(function (a, b) { return b.date < a.date ? -1 : b.date > a.date ? 1 : (b.seq || 0) - (a.seq || 0); });
  if (!list.length) h += '<div class="empty">دریافت/پرداختی ثبت نشده.</div>';
  h += list.map(payRowHtml).join('');
  return h;
}
function wirePayments() {
  $('#payNew').onclick = function () { paymentEditor(); };
  $$('#view [data-pay]').forEach(function (el) { el.onclick = function () { paymentEditor(el.dataset.pay); }; });
}
function paymentEditor(id, preset) {
  var pay = id ? DB.payments.filter(function (x) { return x.id === id; })[0] : null;
  var pre = pay || preset || {};
  openModal(pay ? 'ویرایش دریافت/پرداخت' : 'دریافت/پرداخت جدید',
    fRow('نوع', '<select id="pyDir"><option value="receive"' + (pre.dir === 'receive' ? ' selected' : '') + '>دریافت از شخص (کم‌شدن بدهی او)</option><option value="pay"' + (pre.dir === 'pay' ? ' selected' : '') + '>پرداخت به شخص (تسویه بدهی ما)</option></select>') +
    fRow('شخص', '<select id="pyPer">' + perOptions(pre.personId || '') + '</select>') +
    '<div class="grid2">' + fRow('مبلغ', '<input id="pyAmt" inputmode="numeric" value="' + (pre.amount ? fn(pre.amount) : '') + '">') +
    fRow('تاریخ', calField('pyDate', pay ? pay.date : todayISO())) + '</div>' +
    fRow('حساب', '<select id="pyAcc">' + accOptions(pre.accId || (DB.accounts[0] || {}).id) + '</select>') +
    fRow('توضیحات', '<input id="pyNote" value="' + esc(pre.note || '') + '">') +
    '<div class="err" id="pyErr"></div>',
    [
      { label: 'ثبت', cb: function (close) {
          var amt = num('pyAmt'), iso = getCal('pyDate');
          if (amt <= 0) { $('#pyErr').textContent = 'مبلغ معتبر وارد کنید.'; return; }
          if (!val('pyPer')) { $('#pyErr').textContent = 'شخص را انتخاب کنید.'; return; }
          if (!iso) { $('#pyErr').textContent = 'تاریخ نامعتبر است.'; return; }
          var data = { personId: val('pyPer'), dir: val('pyDir'), amount: amt, date: iso, accId: val('pyAcc'), note: val('pyNote') };
          if (pay) { for (var k in data) pay[k] = data[k]; }
          else { data.id = newId('pay'); data.seq = DB.seq++; DB.payments.push(data); }
          saveDB(); close(); refresh(); toast('ثبت شد');
        } },
      pay ? { label: 'حذف', cls: 'danger', cb: function (close) {
          close();
          uiConfirm('این ثبت حذف شود؟').then(function (ok) {
            if (!ok) return;
            DB.payments = DB.payments.filter(function (x) { return x.id !== pay.id; });
            saveDB(); refresh(); toast('حذف شد');
          });
        } } : { label: 'انصراف', cls: 'gray' }
    ]);
}
function finExpensesHtml() {
  var mr = monthRange(0);
  var h = '<button class="btn block" id="eNew" style="margin-bottom:12px">＋ هزینه جدید</button>';
  var list = DB.expenses.slice().sort(function (a, b) { return b.date < a.date ? -1 : 1; });
  if (!list.length) h += '<div class="empty">هزینه‌ای ثبت نشده.</div>';
  h += list.map(function (e) {
    var c = expCatById(e.catId), acc = accById(e.accId);
    return '<div class="listItem" data-exp="' + e.id + '"><div class="main"><div class="t">' + esc(c ? c.name : 'هزینه') + (e.note ? ' · ' + esc(e.note) : '') + '</div>' +
      '<div class="s">' + fd(e.date) + ' · از ' + esc(acc ? acc.name : '؟') + '</div></div><div class="amt neg">' + fm(e.amount) + '</div></div>';
  }).join('');
  h += '<div class="card"><div class="row"><span class="grow">جمع هزینه‌های این ماه</span><b class="neg">' + fm(expenseSum(mr.from, mr.to)) + '</b></div></div>';
  return h;
}
function wireExpenses() {
  $('#eNew').onclick = function () { expenseEditor(); };
  $$('#view [data-exp]').forEach(function (el) { el.onclick = function () { expenseEditor(el.dataset.exp); }; });
}
function expenseEditor(id) {
  var e = id ? DB.expenses.filter(function (x) { return x.id === id; })[0] : null;
  openModal(e ? 'ویرایش هزینه' : 'هزینه جدید',
    fRow('دسته هزینه', '<select id="efCat">' + DB.expCats.map(function (c) { return '<option value="' + c.id + '"' + (e && e.catId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select>') +
    '<div class="grid2">' + fRow('مبلغ', '<input id="efAmt" inputmode="numeric" value="' + (e ? fn(e.amount) : '') + '">') +
    fRow('تاریخ', calField('efDate', e ? e.date : todayISO())) + '</div>' +
    fRow('پرداخت از حساب', '<select id="efAcc">' + accOptions(e ? e.accId : (DB.accounts[0] || {}).id) + '</select>') +
    fRow('توضیحات', '<input id="efNote" value="' + esc(e ? e.note : '') + '">') +
    '<div class="err" id="efErr"></div>',
    [
      { label: 'ثبت هزینه', cb: function (close) {
          var amt = num('efAmt'), iso = getCal('efDate');
          if (amt <= 0) { $('#efErr').textContent = 'مبلغ معتبر وارد کنید.'; return; }
          if (!iso) { $('#efErr').textContent = 'تاریخ نامعتبر است.'; return; }
          var data = { catId: val('efCat'), amount: amt, date: iso, accId: val('efAcc'), note: val('efNote') };
          if (e) { for (var k in data) e[k] = data[k]; }
          else { data.id = newId('exp'); DB.expenses.push(data); }
          saveDB(); close(); refresh(); toast('هزینه ثبت شد');
        } },
      e ? { label: 'حذف', cls: 'danger', cb: function (close) {
          close();
          uiConfirm('این هزینه حذف شود؟').then(function (ok) {
            if (!ok) return;
            DB.expenses = DB.expenses.filter(function (x) { return x.id !== e.id; });
            saveDB(); refresh(); toast('حذف شد');
          });
        } } : { label: 'انصراف', cls: 'gray' }
    ]);
}
function finIncomesHtml() {
  var h = '<button class="btn block" id="iNew" style="margin-bottom:12px">＋ درآمد متفرقه</button>';
  var list = DB.incomes.slice().sort(function (a, b) { return b.date < a.date ? -1 : 1; });
  if (!list.length) h += '<div class="empty">درآمد متفرقه‌ای ثبت نشده.</div>';
  h += list.map(function (x) {
    var acc = accById(x.accId);
    return '<div class="listItem" data-inc="' + x.id + '"><div class="main"><div class="t">' + esc(x.title) + '</div>' +
      '<div class="s">' + fd(x.date) + ' · به ' + esc(acc ? acc.name : '؟') + (x.note ? ' · ' + esc(x.note) : '') + '</div></div><div class="amt pos">' + fm(x.amount) + '</div></div>';
  }).join('');
  return h;
}
function wireIncomes() {
  $('#iNew').onclick = function () { incomeEditor(); };
  $$('#view [data-inc]').forEach(function (el) { el.onclick = function () { incomeEditor(el.dataset.inc); }; });
}
function incomeEditor(id) {
  var x = id ? DB.incomes.filter(function (z) { return z.id === id; })[0] : null;
  openModal(x ? 'ویرایش درآمد' : 'درآمد متفرقه',
    fRow('عنوان', '<input id="ifTitle" value="' + esc(x ? x.title : '') + '">') +
    '<div class="grid2">' + fRow('مبلغ', '<input id="ifAmt" inputmode="numeric" value="' + (x ? fn(x.amount) : '') + '">') +
    fRow('تاریخ', calField('ifDate', x ? x.date : todayISO())) + '</div>' +
    fRow('واریز به حساب', '<select id="ifAcc">' + accOptions(x ? x.accId : (DB.accounts[0] || {}).id) + '</select>') +
    fRow('توضیحات', '<input id="ifNote" value="' + esc(x ? x.note : '') + '">') +
    '<div class="err" id="ifErr"></div>',
    [
      { label: 'ثبت', cb: function (close) {
          var amt = num('ifAmt'), iso = getCal('ifDate');
          if (!val('ifTitle').trim()) { $('#ifErr').textContent = 'عنوان را وارد کنید.'; return; }
          if (amt <= 0) { $('#ifErr').textContent = 'مبلغ معتبر وارد کنید.'; return; }
          if (!iso) { $('#ifErr').textContent = 'تاریخ نامعتبر است.'; return; }
          var data = { title: val('ifTitle').trim(), amount: amt, date: iso, accId: val('ifAcc'), note: val('ifNote') };
          if (x) { for (var k in data) x[k] = data[k]; }
          else { data.id = newId('inc'); DB.incomes.push(data); }
          saveDB(); close(); refresh(); toast('ثبت شد');
        } },
      x ? { label: 'حذف', cls: 'danger', cb: function (close) {
          close();
          uiConfirm('این درآمد حذف شود؟').then(function (ok) {
            if (!ok) return;
            DB.incomes = DB.incomes.filter(function (z) { return z.id !== x.id; });
            saveDB(); refresh(); toast('حذف شد');
          });
        } } : { label: 'انصراف', cls: 'gray' }
    ]);
}
function finTransfersHtml() {
  var h = '<button class="btn block" id="tNew" style="margin-bottom:12px">＋ انتقال وجه</button>';
  var list = DB.transfers.slice().sort(function (a, b) { return b.date < a.date ? -1 : 1; });
  if (!list.length) h += '<div class="empty">انتقالی ثبت نشده.</div>';
  h += list.map(function (t) {
    var f = accById(t.fromId), to = accById(t.toId);
    return '<div class="listItem" data-tr="' + t.id + '"><div class="main"><div class="t">' + esc(f ? f.name : '؟') + ' ← ' + esc(to ? to.name : '؟') + '</div>' +
      '<div class="s">' + fd(t.date) + (t.note ? ' · ' + esc(t.note) : '') + '</div></div><div class="amt">' + fm(t.amount) + '</div></div>';
  }).join('');
  return h;
}
function wireTransfers() {
  $('#tNew').onclick = function () { transferEditor(); };
  $$('#view [data-tr]').forEach(function (el) { el.onclick = function () { transferEditor(el.dataset.tr); }; });
}
function transferEditor(id) {
  var t = id ? DB.transfers.filter(function (z) { return z.id === id; })[0] : null;
  openModal(t ? 'ویرایش انتقال' : 'انتقال وجه',
    fRow('از حساب', '<select id="tfFrom">' + accOptions(t ? t.fromId : (DB.accounts[0] || {}).id) + '</select>') +
    fRow('به حساب', '<select id="tfTo">' + accOptions(t ? t.toId : (DB.accounts[1] || DB.accounts[0] || {}).id) + '</select>') +
    '<div class="grid2">' + fRow('مبلغ', '<input id="tfAmt" inputmode="numeric" value="' + (t ? fn(t.amount) : '') + '">') +
    fRow('تاریخ', calField('tfDate', t ? t.date : todayISO())) + '</div>' +
    fRow('توضیحات', '<input id="tfNote" value="' + esc(t ? t.note : '') + '">') +
    '<div class="err" id="tfErr"></div>',
    [
      { label: 'ثبت انتقال', cb: function (close) {
          var amt = num('tfAmt'), iso = getCal('tfDate');
          if (val('tfFrom') === val('tfTo')) { $('#tfErr').textContent = 'حساب مبدأ و مقصد نمی‌توانند یکی باشند.'; return; }
          if (amt <= 0) { $('#tfErr').textContent = 'مبلغ معتبر وارد کنید.'; return; }
          if (!iso) { $('#tfErr').textContent = 'تاریخ نامعتبر است.'; return; }
          var data = { fromId: val('tfFrom'), toId: val('tfTo'), amount: amt, date: iso, note: val('tfNote') };
          if (t) { for (var k in data) t[k] = data[k]; }
          else { data.id = newId('trn'); DB.transfers.push(data); }
          saveDB(); close(); refresh(); toast('انتقال ثبت شد');
        } },
      t ? { label: 'حذف', cls: 'danger', cb: function (close) {
          close();
          uiConfirm('این انتقال حذف شود؟').then(function (ok) {
            if (!ok) return;
            DB.transfers = DB.transfers.filter(function (z) { return z.id !== t.id; });
            saveDB(); refresh(); toast('حذف شد');
          });
        } } : { label: 'انصراف', cls: 'gray' }
    ]);
}

/* ---------- انبار ---------- */
var stockTab = 'list';
function renderStock(arg) {
  var v = $('#view');
  if (arg && arg.indexOf('kardex:') === 0) stockTab = 'kardex';
  var h = '<div class="secTitle">🏭 ' + tr('انبار') + '</div>' +
    '<div class="tabs"><button data-t="list" class="' + (stockTab === 'list' ? 'active' : '') + '">' + tr('موجودی') + '</button>' +
    '<button data-t="ops" class="' + (stockTab === 'ops' ? 'active' : '') + '">' + tr('عملیات انبار') + '</button>' +
    '<button data-t="kardex" class="' + (stockTab === 'kardex' ? 'active' : '') + '">' + tr('کاردکس کالا') + '</button>' +
    '<button data-t="take" class="' + (stockTab === 'take' ? 'active' : '') + '">🧮 انبارگردانی</button></div>';
  if (stockTab === 'take') { v.innerHTML = h + stockTakeHtml(); wireStockTake(); return; }
  if (stockTab === 'ops') { v.innerHTML = h + stockOpsHtml(); wireStockOps(); return; }
  if (stockTab === 'kardex') { v.innerHTML = h + kardexHtml(arg); return; }
  var totVal = inventoryValue();
  h += '<div class="card"><div class="row"><span class="grow">ارزش کل موجودی (بهای میانگین)</span><b>' + fm(totVal) + '</b></div></div>';
  h += '<div class="row" style="margin-bottom:10px"><button class="btn gray sm" id="whManage">🏭 مدیریت انبارها (' + fn(DB.warehouses.length) + ')</button>' +
    '<select id="whFilter" style="flex:1;padding:9px;border:1px solid var(--line);border-radius:9px">' +
    '<option value="">همه انبارها</option>' + DB.warehouses.map(function (w) { return '<option value="' + w.id + '"' + (stWh === w.id ? ' selected' : '') + '>' + esc(w.name) + '</option>'; }).join('') + '</select></div>';
  if (!DB.products.length) h += '<div class="empty">کالایی ثبت نشده.</div>';
  h += DB.products.map(function (p) {
    var disp = stWh ? whStock(p, stWh) : p._stock;
    var low = p._stock <= nd(p.minStock);
    return '<div class="listItem" data-sop="' + p.id + '"><div class="main"><div class="t">' + esc(p.name) + '</div>' +
      '<div class="s">بهای میانگین ' + fn(Math.round(p._avg)) + ' · ارزش کل ' + fn(Math.round(p._stock * p._avg)) + '</div></div>' +
      '<div><div class="amt">' + fn(disp) + ' ' + esc(p.unit || '') + '</div><div class="s" style="text-align:left">' + (low ? '<span class="chip amber">رو به اتمام</span>' : '') + '</div></div></div>';
  }).join('');
  v.innerHTML = h;
  $$('#view .tabs [data-t]').forEach(function (b) { b.onclick = function () { stockTab = b.dataset.t; renderStock(); }; });
  $$('#view [data-sop]').forEach(function (el) { el.onclick = function () { stockOpEditor(el.dataset.sop); }; });
  $('#whFilter').onchange = function () { stWh = this.value; renderStock(); };
  $('#whManage').onclick = warehouseManager;
}
var stWh = '';
function warehouseManager() {
  var body = DB.warehouses.map(function (w) {
    return '<div class="row" style="padding:5px 0"><span class="grow">🏭 ' + esc(w.name) + '</span><button class="btn gray sm" data-wr="' + w.id + '">تغییر نام</button>' +
      (DB.warehouses.length > 1 ? ' <button class="btn danger sm" data-wd="' + w.id + '">حذف</button>' : '') + '</div>';
  }).join('') +
    '<div class="row" style="margin-top:10px"><input id="whNewName" placeholder="نام انبار جدید" class="grow" style="padding:10px;border:1px solid var(--line);border-radius:10px"><button class="btn" id="whAddBtn">＋ افزودن</button></div>' +
    '<p class="mut small">نکته: حذف انبار فقط وقتی ممکن است که موجودی همه کالاها در آن انبار صفر باشد.</p>';
  openModal('مدیریت انبارها', body, [{ label: 'بستن', cls: 'gray', cb: function (c) { c(); refresh(); } }]);
  $('#whAddBtn').onclick = function () {
    var nm = val('whNewName').trim();
    if (!nm) { toast('نام انبار را بنویسید'); return; }
    DB.warehouses.push({ id: newId('wh'), name: nm });
    saveDB(); warehouseManager(); toast('انبار اضافه شد');
  };
  $$('#modalRoot [data-wr]').forEach(function (b) {
    b.onclick = function () {
      var w = DB.warehouses.filter(function (x) { return x.id === b.dataset.wr; })[0];
      var body2 = fRow('نام انبار', '<input id="whRn" value="' + esc(w.name) + '">');
      openModal('تغییر نام انبار', body2, [
        { label: 'ذخیره', cb: function (c) { var nm = val('whRn').trim(); if (nm) { w.name = nm; saveDB(); } c(); warehouseManager(); } },
        { label: 'انصراف', cls: 'gray', cb: function (c) { c(); warehouseManager(); } }
      ]);
    };
  });
  $$('#modalRoot [data-wd]').forEach(function (b) {
    b.onclick = function () {
      var w = DB.warehouses.filter(function (x) { return x.id === b.dataset.wd; })[0];
      var used = DB.products.some(function (p) { return whStock(p, w.id) !== 0; });
      if (used) { toast('این انبار موجودی دارد و حذف نمی‌شود'); return; }
      uiConfirm('انبار «' + w.name + '» حذف شود؟').then(function (ok) {
        if (!ok) return;
        DB.warehouses = DB.warehouses.filter(function (x) { return x.id !== w.id; });
        saveDB(); warehouseManager(); toast('انبار حذف شد');
      });
    };
  });
}
function stockOpsHtml() {
  var list = DB.stockOps.slice().sort(function (a, b) { return b.date < a.date ? -1 : b.date > a.date ? 1 : (b.seq || 0) - (a.seq || 0); });
  if (!list.length) return '<div class="empty">عملیات انباری ثبت نشده (ورود/خروج دستی).</div>';
  return list.map(function (op) {
    var p = prodById(op.pid);
    var label = op.kind === 'in' ? '📥 رسید ورود' : op.kind === 'out' ? '📤 حواله خروج' : op.kind === 'transfer' ? '🔀 انتقال' : '🔧 اصلاح موجودی';
    var whTxt = op.kind === 'transfer' ? whName(op.fromWh) + ' ← ' + whName(op.toWh) : whName(op.whId || defWh());
    return '<div class="listItem" data-op="' + op.id + '"><div class="main"><div class="t">' + label + ' · ' + esc(p ? p.name : 'کالای حذف‌شده') + '</div>' +
      '<div class="s">' + fd(op.date) + (whTxt ? ' · ' + esc(whTxt) : '') + (op.note ? ' · ' + esc(op.note) : '') + '</div></div><div class="amt">' + fn(op.qty) + '</div></div>';
  }).join('');
}
function wireStockOps() {
  $$('#view .tabs [data-t]').forEach(function (b) { b.onclick = function () { stockTab = b.dataset.t; renderStock(); }; });
  $$('#view [data-op]').forEach(function (el) {
    el.onclick = function () {
      var op = DB.stockOps.filter(function (x) { return x.id === el.dataset.op; })[0];
      if (op) stockOpEditor(op.pid, op.id);
    };
  });
}
function kardexHtml(arg) {
  var pid = arg && arg.indexOf('kardex:') === 0 ? arg.slice(7) : (DB.products[0] || {}).id;
  var h = fRow('انتخاب کالا', '<select id="kxSel">' + DB.products.map(function (p) {
    return '<option value="' + p.id + '"' + (p.id === pid ? ' selected' : '') + '>' + esc(p.name) + '</option>';
  }).join('') + '</select>');
  if (!pid) return h + '<div class="empty">کالایی وجود ندارد.</div>';
  var rows = productKardex(pid);
  h += '<div class="card"><div class="tblwrap"><table class="tbl"><tr><th>تاریخ</th><th>شرح</th><th class="n">ورود</th><th class="n">خروج</th><th class="n">مانده</th></tr>' +
    (rows.map(function (r) {
      return '<tr><td>' + fd(r.date) + '</td><td>' + esc(r.label) + '</td><td class="n">' + (r.inQ ? fn(r.inQ) : '') + '</td><td class="n">' + (r.outQ ? fn(r.outQ) : '') + '</td><td class="n">' + fn(r.bal) + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="mut">گردشی ثبت نشده.</td></tr>') + '</table></div></div>';
  setTimeout(function () {
    var s = $('#kxSel');
    if (s) s.onchange = function () { renderStock('kardex:' + s.value); };
  }, 0);
  return h;
}
function stockOpEditor(pid, opId) {
  var op = opId ? DB.stockOps.filter(function (x) { return x.id === opId; })[0] : null;
  var p = prodById(pid); if (!p) return;
  function whOpts(sel) {
    return DB.warehouses.map(function (w) { return '<option value="' + w.id + '"' + (w.id === sel ? ' selected' : '') + '>' + esc(w.name) + '</option>'; }).join('');
  }
  openModal('عملیات انبار · ' + p.name,
    fRow('نوع عملیات', '<select id="soKind"><option value="in"' + (op && op.kind === 'in' ? ' selected' : '') + '>رسید ورود (افزایش)</option><option value="out"' + (op && op.kind === 'out' ? ' selected' : '') + '>حواله خروج (کاهش: ضایعات، مصرف…)</option><option value="adjust"' + (op && op.kind === 'adjust' ? ' selected' : '') + '>اصلاح موجودی (عدد نهایی)</option><option value="transfer"' + (op && op.kind === 'transfer' ? ' selected' : '') + '>🔀 انتقال بین انبارها</option></select>') +
    '<div class="grid2">' + fRow('انبار', '<select id="soWh">' + whOpts(op ? (op.whId || op.fromWh) : defWh()) + '</select>') +
    fRow('انبار مقصد (فقط انتقال)', '<select id="soWhTo">' + whOpts(op ? (op.toWh || defWh()) : (DB.warehouses[1] || {}).id || defWh()) + '</select>') + '</div>' +
    '<div class="grid2">' + fRow('تعداد', '<input id="soQty" inputmode="decimal" value="' + (op ? faNum(op.qty) : '') + '">') +
    fRow('قیمت تمام‌شده (فقط ورود)', '<input id="soCost" inputmode="numeric" value="' + (op ? faNum(op.cost || 0) : fn(p.buyPrice)) + '">') + '</div>' +
    fRow('تاریخ', calField('soDate', op ? op.date : todayISO())) +
    '<div class="grid2">' + fRow('سری ساخت (بچ)', '<input id="soBatch" value="' + esc(op ? (op.batch || '') : '') + '">') +
    fRow('تاریخ انقضا', '<select id="soHasExp"><option value="">ندارد</option><option value="1"' + (op && op.expiry ? ' selected' : '') + '>دارد ↓</option></select>') + '</div>' +
    fRow('تاریخ انقضا', calField('soExp', (op && op.expiry) || todayISO())) +
    fRow('توضیحات', '<input id="soNote" value="' + esc(op ? op.note : '') + '">') +
    '<p class="mut small">موجودی فعلی: ' + fn(p._stock) + ' ' + esc(p.unit || '') + '</p><div class="err" id="soErr"></div>',
    [
      { label: 'ثبت عملیات', cb: function (close) {
          var iso = getCal('soDate');
          if (!iso) { $('#soErr').textContent = 'تاریخ نامعتبر است.'; return; }
          if (num('soQty') <= 0) { $('#soErr').textContent = 'تعداد معتبر وارد کنید.'; return; }
          var kind = val('soKind'), wA = val('soWh'), wB = val('soWhTo');
          if (kind === 'transfer' && wA === wB) { $('#soErr').textContent = 'انبار مبدأ و مقصد متفاوت باشند.'; return; }
          var data = { pid: pid, kind: kind, qty: num('soQty'), cost: num('soCost'), date: iso, note: val('soNote'), whId: wA,
            batch: val('soBatch').trim(), expiry: val('soHasExp') ? (getCal('soExp') || '') : '' };
          if (kind === 'transfer') { data.fromWh = wA; data.toWh = wB; }
          if (op) { for (var k in data) op[k] = data[k]; }
          else { data.id = newId('so'); data.seq = DB.seq++; DB.stockOps.push(data); }
          recompute(); saveDB(); close(); refresh(); toast('عملیات انبار ثبت شد');
        } },
      op ? { label: 'حذف', cls: 'danger', cb: function (close) {
          close();
          uiConfirm('این عملیات انبار حذف شود؟').then(function (ok) {
            if (!ok) return;
            DB.stockOps = DB.stockOps.filter(function (x) { return x.id !== op.id; });
            recompute(); saveDB(); refresh(); toast('حذف شد');
          });
        } } : { label: 'انصراف', cls: 'gray' }
    ]);
}

/* ---------- چک‌ها ---------- */
var chqTab = 'in';
var CHQ_STATUS = { pending: 'در جریان', cleared: 'وصول‌شده', paid: 'پرداخت‌شده', bounced: 'برگشتی', transferred: 'واگذارشده' };
function renderCheques() {
  var v = $('#view'), t = todayISO();
  var h = '<div class="secTitle">💳 ' + tr('چک‌ها') + '</div>' +
    '<div class="tabs"><button data-t="in" class="' + (chqTab === 'in' ? 'active' : '') + '">' + tr('چک‌های دریافتی') + '</button>' +
    '<button data-t="out" class="' + (chqTab === 'out' ? 'active' : '') + '">' + tr('چک‌های پرداختی') + '</button></div>' +
    '<button class="btn block" id="chNew" style="margin-bottom:12px">＋ ثبت چک ' + (chqTab === 'in' ? 'دریافتی' : 'پرداختی') + '</button>';
  var list = DB.cheques.filter(function (c) { return c.dir === chqTab; })
    .sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; });
  if (!list.length) h += '<div class="empty">چکی ثبت نشده.</div>';
  h += list.map(function (c) {
    var per = personById(c.personId);
    var stChip = c.status === 'pending'
      ? '<span class="chip ' + (c.dueDate < t ? 'red' : daysBetween(t, c.dueDate) <= 7 ? 'amber' : 'blue') + '">' + (c.dueDate < t ? 'سررسید گذشته' : 'سررسید ' + fd(c.dueDate)) + '</span>'
      : '<span class="chip ' + (c.status === 'bounced' ? 'red' : 'green') + '">' + (c.dir === 'in' && c.status === 'cleared' ? CHQ_STATUS.cleared : c.dir === 'out' && c.status === 'cleared' ? CHQ_STATUS.paid : CHQ_STATUS[c.status] || c.status) + '</span>';
    return '<div class="listItem" data-chq="' + c.id + '"><div class="main"><div class="t">چک ' + esc(c.number || '—') + ' · ' + esc(c.bank || '') + '</div>' +
      '<div class="s">' + (per ? esc(per.name) + ' · ' : '') + 'سررسید ' + fd(c.dueDate) + '</div></div>' +
      '<div><div class="amt">' + fm(c.amount) + '</div><div class="s" style="text-align:left">' + stChip + '</div></div></div>';
  }).join('');
  v.innerHTML = h;
  $$('#view .tabs [data-t]').forEach(function (b) { b.onclick = function () { chqTab = b.dataset.t; renderCheques(); }; });
  $('#chNew').onclick = function () { chequeEditor(); };
  $$('#view [data-chq]').forEach(function (el) { el.onclick = function () { chequeEditor(el.dataset.chq); }; });
}
function chequeEditor(id) {
  var c = id ? DB.cheques.filter(function (x) { return x.id === id; })[0] : null;
  var dir = c ? c.dir : chqTab;
  var body =
    '<div class="grid2">' + fRow('شماره چک', '<input id="cqNum" value="' + esc(c ? c.number : '') + '">') +
    fRow('بانک', '<input id="cqBank" value="' + esc(c ? c.bank : '') + '">') +
    fRow('مبلغ', '<input id="cqAmt" inputmode="numeric" value="' + (c ? fn(c.amount) : '') + '">') +
    fRow('طرف حساب', '<select id="cqPer">' + perOptions(c ? c.personId : '') + '</select>') +
    fRow('تاریخ صدور', calField('cqIssue', c ? c.issueDate : todayISO())) +
    fRow('تاریخ سررسید', calField('cqDue', c ? c.dueDate : todayISO())) + '</div>' +
    fRow('توضیحات', '<input id="cqNote" value="' + esc(c ? c.note : '') + '">') +
    (c && c.payId ? '<p class="mut small">این چک وصول شده و پرداخت مرتبط ثبت گردیده است.</p>' : '') +
    '<div class="err" id="cqErr"></div>';
  var btns = [
    { label: 'ذخیره', cb: function (close) {
        var isoI = getCal('cqIssue'), isoD = getCal('cqDue');
        if (num('cqAmt') <= 0) { $('#cqErr').textContent = 'مبلغ معتبر وارد کنید.'; return; }
        if (!isoI || !isoD) { $('#cqErr').textContent = 'تاریخ‌ها نامعتبرند.'; return; }
        var data = { number: val('cqNum').trim(), bank: val('cqBank').trim(), amount: num('cqAmt'), personId: val('cqPer'), issueDate: isoI, dueDate: isoD, note: val('cqNote') };
        if (c) { for (var k in data) c[k] = data[k]; }
        else { data.id = newId('chq'); data.dir = dir; data.status = 'pending'; data.accId = ''; data.payId = ''; DB.cheques.push(data); }
        saveDB(); close(); refresh(); toast('چک ذخیره شد');
      } },
    { label: 'بستن', cls: 'gray' }
  ];
  if (c && c.status === 'pending') {
    btns.splice(1, 0, { label: dir === 'in' ? '✔ وصول چک' : '✔ پرداخت شد', cls: 'blue', cb: function (close) { close(); clearChequeDialog(c); } });
    if (dir === 'in') btns.splice(2, 0, { label: 'برگشت خورد', cls: 'warn', cb: function (close) { c.status = 'bounced'; saveDB(); close(); refresh(); toast('چک برگشتی ثبت شد'); } });
    btns.push({ label: 'حذف', cls: 'danger', cb: function (close) {
      close();
      uiConfirm('این چک حذف شود؟').then(function (ok) {
        if (!ok) return;
        DB.cheques = DB.cheques.filter(function (x) { return x.id !== c.id; });
        saveDB(); refresh(); toast('حذف شد');
      });
    } });
  } else if (c && (c.status === 'cleared')) {
    btns.splice(1, 0, { label: 'برگرداندن به «در جریان»', cls: 'warn', cb: function (close) {
      if (c.payId) { DB.payments = DB.payments.filter(function (x) { return x.id !== c.payId; }); c.payId = ''; }
      c.status = 'pending'; c.accId = '';
      saveDB(); close(); refresh(); toast('به وضعیت در جریان برگشت');
    } });
  } else if (c && c.status === 'bounced') {
    btns.splice(1, 0, { label: 'برگرداندن به «در جریان»', cls: 'warn', cb: function (close) { c.status = 'pending'; saveDB(); close(); refresh(); } });
  }
  openModal((c ? 'ویرایش چک ' : 'چک جدید ') + (dir === 'in' ? 'دریافتی' : 'پرداختی'), body, btns);
}
function clearChequeDialog(c) {
  openModal(c.dir === 'in' ? 'وصول چک' : 'پرداخت چک',
    '<p>مبلغ ' + fm(c.amount) + ' به کدام حساب واریز/از کدام حساب برداشت شود؟</p>' +
    fRow('حساب', '<select id="ccAcc">' + accOptions((DB.accounts[0] || {}).id) + '</select>'),
    [
      { label: 'تأیید', cb: function (close) {
          var accId = val('ccAcc');
          var pay = { id: newId('pay'), seq: DB.seq++, personId: c.personId, dir: c.dir === 'in' ? 'receive' : 'pay',
            amount: c.amount, date: todayISO(), accId: accId, note: 'چک شماره ' + c.number + ' ' + c.bank };
          DB.payments.push(pay);
          c.status = 'cleared'; c.accId = accId; c.payId = pay.id;
          audit(c.dir === 'in' ? 'وصول چک' : 'پرداخت چک', 'شماره ' + c.number + ' · ' + fm(c.amount));
          saveDB(); close(); refresh(); toast('ثبت شد');
        } },
      { label: 'انصراف', cls: 'gray' }
    ]);
}

/* ---------- گزارش‌ها ---------- */
var repMode = 'month', repFrom = '', repTo = '';
function repRange() {
  var t = todayISO();
  if (repMode === 'today') return { from: t, to: t, label: 'امروز' };
  if (repMode === 'month') { var m = monthRange(0); return { from: m.from, to: m.to, label: 'این ماه (' + JM[m.jm - 1] + ' ' + faNum(m.jy) + ')' }; }
  if (repMode === 'lastmonth') { var m2 = monthRange(-1); return { from: m2.from, to: m2.to, label: 'ماه قبل (' + JM[m2.jm - 1] + ' ' + faNum(m2.jy) + ')' }; }
  if (repMode === 'custom' && repFrom && repTo) return { from: repFrom, to: repTo, label: fd(repFrom) + ' تا ' + fd(repTo) };
  return { from: '0000-01-01', to: '9999-12-31', label: 'همه دوره‌ها' };
}
function netRevenue(from, to) { /* درآمد عملیاتی فروش (بدون مالیات) */
  var s = 0;
  DB.invoices.forEach(function (inv) {
    if (inv.status !== 'final' || !invInRange(inv, from, to)) return;
    var rev = invoiceItemsTotal(inv) - nd(inv.gdisc) + nd(inv.shipping);
    if (inv.kind === 'sale') s += rev;
    else if (inv.kind === 'sale_ret') s -= rev;
  });
  return Math.round(s);
}
function cogsSum(from, to) {
  var s = 0;
  DB.invoices.forEach(function (inv) {
    if (inv.status !== 'final' || !invInRange(inv, from, to)) return;
    if (inv.kind === 'sale' || inv.kind === 'sale_ret') s += nd(inv.cogs);
  });
  return Math.round(s);
}
function renderReports() {
  var v = $('#view'), r = repRange();
  var h = '<div class="secTitle">📈 ' + tr('گزارش‌ها') + '</div>' +
    '<div class="tabs">' +
    [['today', 'امروز'], ['month', 'این ماه'], ['lastmonth', 'ماه قبل'], ['all', 'همه'], ['custom', 'بازه دلخواه']].map(function (x) {
      return '<button data-m="' + x[0] + '" class="' + (repMode === x[0] ? 'active' : '') + '">' + x[1] + '</button>';
    }).join('') + '</div>';
  if (repMode === 'custom') {
    h += '<div class="card"><div class="grid2">' + fRow('از تاریخ', calField('repF', repFrom || todayISO())) + fRow('تا تاریخ', calField('repT', repTo || todayISO())) + '</div>' +
      '<button class="btn block" id="repApply">نمایش گزارش</button></div>';
  }
  var rev = netRevenue(r.from, r.to), cogs = cogsSum(r.from, r.to), gross = rev - cogs;
  var exps = expenseSum(r.from, r.to), net = gross - exps;
  var saleT = salesSum(r.from, r.to, 'sale') - salesSum(r.from, r.to, 'sale_ret');
  var buyT = salesSum(r.from, r.to, 'purchase') - salesSum(r.from, r.to, 'purchase_ret');
  var saleInvs = DB.invoices.filter(function (i) { return i.kind === 'sale' && i.status === 'final' && i.date >= r.from && i.date <= r.to; });
  var bestDay = 0, byDay = {};
  saleInvs.forEach(function (i) { byDay[i.date] = (byDay[i.date] || 0) + invoiceTotal(i); if (byDay[i.date] > bestDay) bestDay = byDay[i.date]; });
  var avgInv = saleInvs.length ? Math.round(saleT / saleInvs.length) : 0;
  h += '<div class="kpis">' +
    kpi2('💰', 'icGreen', 'مجموع فروش', fm(saleT)) +
    kpi2('🧾', 'icOrange', 'تعداد فاکتور فروش', fn(saleInvs.length)) +
    kpi2('📊', 'icBlue', 'میانگین فاکتور', fm(avgInv)) +
    kpi2('👑', 'icPink', 'بیشترین فروش روزانه', fm(bestDay)) + '</div>';
  h += '<div class="card"><h3>📋 سود و زیان · ' + esc(r.label) + '</h3>' +
    prow('فروش کل (با مالیات و کسورات فاکتور)', fm(saleT)) +
    prow('خرید کل', fm(buyT)) +
    prow('درآمد فروش (بدون مالیات)', fm(rev)) +
    prow('بهای تمام‌شده کالای فروخته‌شده', fm(cogs)) +
    prow('سود ناخالص', '<b class="' + (gross < 0 ? 'neg' : 'pos') + '">' + fm(gross) + '</b>') +
    prow('هزینه‌های عملیاتی', fm(exps)) +
    prow('حاشیه سود ناخالص', faNum(rev ? Math.round(gross / rev * 100) : 0) + '٪') +
    '<div class="row" style="border-top:2px solid var(--line);padding-top:8px;margin-top:4px"><span class="grow"><b>سود خالص</b></span><b class="' + (net < 0 ? 'neg' : 'pos') + '" style="font-size:17px">' + fm(net) + '</b></div>' +
    '<p class="mut small">بهای تمام‌شده با روش «میانگین موزون» محاسبه شده است.</p>' +
    '<button class="btn gray sm" id="repPrint">🖨 چاپ گزارش سود و زیان</button></div>';
  /* هزینه به تفکیک دسته */
  var byCat = {};
  DB.expenses.forEach(function (e) { if (e.date >= r.from && e.date <= r.to) byCat[e.catId] = (byCat[e.catId] || 0) + nd(e.amount); });
  var catRows = Object.keys(byCat).map(function (cid) {
    var c = expCatById(cid);
    return prow(esc(c ? c.name : 'سایر'), fm(byCat[cid]));
  }).join('');
  if (catRows) h += '<div class="card"><h3>💸 هزینه‌ها به تفکیک دسته</h3>' + catRows + '</div>';
  var tops = topProducts(r.from, r.to, 8, true);
  if (tops.length) h += '<div class="card"><h3>🏆 پرسودترین کالاها</h3>' + tops.map(function (x) {
    return prow(esc(x.name) + ' <span class="mut small">(' + fn(x.qty) + ' عدد)</span>', '<span class="' + (x.profit < 0 ? 'neg' : 'pos') + '">' + fm(Math.round(x.profit)) + '</span>');
  }).join('') + '</div>';
  var pbp = profitByPerson(r.from, r.to).slice(0, 15);
  if (pbp.length) h += '<div class="card"><h3>👥 سود به تفکیک مشتری</h3>' + pbp.map(function (x) {
    return prow(esc(x.name) + ' <span class="mut small">(فروش ' + fm(x.rev) + ')</span>', '<span class="' + (x.profit < 0 ? 'neg' : 'pos') + '">' + fm(Math.round(x.profit)) + '</span>');
  }).join('') + '</div>';
  var pbc = profitByCategory(r.from, r.to).slice(0, 15);
  if (pbc.length) h += '<div class="card"><h3>🏷️ سود به تفکیک گروه کالا</h3>' + pbc.map(function (x) {
    return prow(esc(x.name) + ' <span class="mut small">(فروش ' + fm(x.rev) + ')</span>', '<span class="' + (x.profit < 0 ? 'neg' : 'pos') + '">' + fm(Math.round(x.profit)) + '</span>');
  }).join('') + '<p class="mut small">تخفیف کلی فاکتور در تفکیک گروهی لحاظ نشده است.</p></div>';
  var bySeller = {};
  DB.invoices.forEach(function (inv) {
    if (inv.status !== 'final' || inv.kind !== 'sale' || !invInRange(inv, r.from, r.to) || !inv.seller) return;
    if (!bySeller[inv.seller]) bySeller[inv.seller] = { cnt: 0, total: 0, profit: 0 };
    bySeller[inv.seller].cnt++;
    bySeller[inv.seller].total += invoiceTotal(inv);
    bySeller[inv.seller].profit += inv.profit || 0;
  });
  var sellerRows = Object.keys(bySeller).map(function (s) {
    var x = bySeller[s];
    return prow('👤 ' + esc(s) + ' <span class="mut small">(' + fn(x.cnt) + ' فاکتور)</span>', fm(x.total) + ' · سود ' + fm(x.profit));
  }).join('');
  if (sellerRows) h += '<div class="card"><h3>🧑‍💼 عملکرد فروشنده‌ها</h3>' + sellerRows + '</div>';
  var debtors = DB.persons.map(function (p) { return { p: p, b: personBalance(p.id) }; }).filter(function (x) { return x.b !== 0; })
    .sort(function (a, b) { return Math.abs(b.b) - Math.abs(a.b); }).slice(0, 12);
  if (debtors.length) h += '<div class="card"><h3>👥 مانده اشخاص</h3>' + debtors.map(function (x) {
    return '<div class="row" style="padding:4px 0;cursor:pointer" data-per="' + x.p.id + '"><span class="grow">' + esc(x.p.name) + '</span>' +
      (x.b > 0 ? '<span class="chip red">بدهکار ' + fm(x.b) + '</span>' : '<span class="chip blue">طلبکار ' + fm(-x.b) + '</span>') + '</div>';
  }).join('') + '</div>';
  h += '<div class="card"><h3>📦 گزارش انبار</h3>' +
    prow('تعداد اقلام کالا', fn(DB.products.length)) +
    prow('ارزش موجودی (بهای میانگین)', fm(inventoryValue())) +
    prow('کالاهای رو به اتمام', fn(lowStockList().length) + ' قلم') + '</div>';
  var dues = chequesDue(30);
  if (dues.length) h += '<div class="card"><h3>💳 چک‌های ۳۰ روز آینده</h3>' + dues.map(function (c) {
    var per = personById(c.personId);
    return prow((c.dir === 'in' ? 'دریافتی' : 'پرداختی') + ' · ' + esc(c.number || '') + (per ? ' · ' + esc(per.name) : ''), fm(c.amount) + ' <span class="mut small">' + fd(c.dueDate) + '</span>');
  }).join('') + '</div>';
  v.innerHTML = h;
  $$('#view .tabs [data-m]').forEach(function (b) { b.onclick = function () { repMode = b.dataset.m; renderReports(); }; });
  var ap = $('#repApply');
  if (ap) ap.onclick = function () {
    var f = getCal('repF'), tt = getCal('repT');
    if (f && tt) { repFrom = f; repTo = tt; renderReports(); } else toast('تاریخ‌ها نامعتبرند');
  };
  var rp = $('#repPrint');
  if (rp) rp.onclick = function () {
    PRINTING = true;
    doPrint('<div class="h"><div class="t">' + esc(DB.settings.shopName) + '</div><div>گزارش سود و زیان · ' + esc(r.label) + '</div></div>' +
      '<table><tr><th>شرح</th><th>مبلغ (' + esc(DB.settings.currency) + ')</th></tr>' +
      '<tr><td>درآمد فروش</td><td>' + fn(rev) + '</td></tr>' +
      '<tr><td>بهای تمام‌شده</td><td>' + fn(cogs) + '</td></tr>' +
      '<tr><td>سود ناخالص</td><td>' + fn(gross) + '</td></tr>' +
      '<tr><td>هزینه‌های عملیاتی</td><td>' + fn(exps) + '</td></tr>' +
      '<tr><td><b>سود خالص</b></td><td><b>' + fn(net) + '</b></td></tr></table>');
    PRINTING = false;
  };
  $$('#view [data-per]').forEach(function (el) { el.onclick = function () { personDetail(el.dataset.per); }; });
  accordionize(v);
}
/* بخش‌های بازشونده (آکاردئون): کارت‌هایی که h3 دارند */
function accordionize(view) {
  if (!view) return;
  var n = 0;
  view.querySelectorAll(':scope > .card').forEach(function (card) {
    var h3 = card.querySelector(':scope > h3');
    if (!h3) return;
    var key = 'rep:' + h3.textContent.replace(/\s+/g, ' ').trim();
    var body = document.createElement('div'); body.className = 'accBody';
    var inner = document.createElement('div'); inner.className = 'accIn';
    Array.prototype.slice.call(card.childNodes).forEach(function (node) {
      if (node !== h3) inner.appendChild(node);
    });
    body.appendChild(inner); card.appendChild(body);
    card.classList.add('acc');
    window.__accOpen = window.__accOpen || {};
    if (window.__accOpen[key] === true || (window.__accOpen[key] === undefined && n === 0)) card.classList.add('open');
    n++;
    h3.onclick = function () {
      var nowOpen = card.classList.toggle('open');
      window.__accOpen[key] = nowOpen;
    };
  });
}
function prow(l, val) { return '<div class="row" style="padding:4px 0"><span class="grow">' + l + '</span><span>' + val + '</span></div>'; }

/* ---------- پشتیبان‌گیری ---------- */
function renderBackup() {
  var v = $('#view'), st = DB.settings;
  var h = '<div class="secTitle">💾 ' + tr('پشتیبان‌گیری') + '</div>' +
    '<div class="card"><h3>نسخه پشتیبان</h3>' +
    '<p class="mut small">همه اطلاعات فروشگاه (کالاها، فاکتورها، اشخاص، چک‌ها و…) در یک فایل JSON ذخیره می‌شود. فایل را در جای امنی نگه دارید؛ با همان فایل می‌توانید روی همین گوشی یا گوشی جدید بازیابی کنید.</p>' +
    '<p>آخرین پشتیبان‌گیری: <b>' + (st.lastBackup ? fdt(st.lastBackup) : 'هرگز') + '</b></p>' +
    '<p class="mut small">🤖 پشتیبان‌گیری خودکار: هر روز هنگام باز شدن برنامه، یک نسخه در حافظه گوشی (پوشه Android/data/com.ihesab.app/files/iHesab-backups) ذخیره می‌شود و ۷ نسخه آخر نگه داشته می‌شود.' +
    (st.lastAutoBackup ? ' آخرین خودکار: <b>' + fdt(st.lastAutoBackup) + '</b>' : ' هنوز نسخه خودکاری ساخته نشده.') + '</p>' +
    fRow('گذرواژه رمزگذاری (اختیاری — خالی = بدون رمز)', '<input id="bkPass" type="password" autocomplete="off" placeholder="برای فایل رمزدار پر کنید">') +
    '<div class="row wrap"><button class="btn" id="bkExport">⬇️ خروجی پشتیبان</button>' +
    '<label class="btn gray" for="bkFile" style="cursor:pointer">⬆️ بازیابی از فایل</label>' +
    '<input type="file" id="bkFile" accept=".json,application/json" style="display:none"></div></div>' +
    '<div class="card"><h3>📜 سابقه عملیات حساس</h3>' +
    (DB.audit.slice(-30).reverse().map(function (a) {
      return '<div class="row" style="padding:3px 0"><span class="grow small">' + esc(a.action) + (a.detail ? ' · ' + esc(a.detail) : '') + '</span><span class="mut small">' + fdt(a.ts) + '</span></div>';
    }).join('') || '<p class="mut">هنوز سابقه‌ای ثبت نشده.</p>') + '</div>' +
    '<div class="card"><h3>📊 خروجی‌های اکسل</h3>' +
    '<p class="mut small">فایل‌های اکسل (.xlsx) در پوشه دانلودها/iHesab ذخیره می‌شوند.</p>' +
    '<div class="row wrap"><button class="btn gray" id="xlProducts">کالاها</button>' +
    '<button class="btn gray" id="xlInvoices">فاکتورها</button>' +
    '<button class="btn gray" id="xlPersons">اشخاص</button>' +
    '<button class="btn gray" id="xlPnL">سود و زیان این ماه</button></div></div>' +
    '<div class="card"><h3>داده نمونه و شروع تازه</h3>' +
    '<div class="row wrap"><button class="btn gray" id="bkSample">بارگذاری داده نمونه</button>' +
    '<button class="btn danger" id="bkWipe">🗑 حذف همه داده‌ها</button></div></div>';
  v.innerHTML = h;
  var xp = $('#xlProducts'); if (xp) xp.onclick = exportProductsXlsx;
  var xi = $('#xlInvoices'); if (xi) xi.onclick = exportInvoicesXlsx;
  var xpe = $('#xlPersons'); if (xpe) xpe.onclick = exportPersonsXlsx;
  var xl = $('#xlPnL'); if (xl) xl.onclick = exportPnLXlsx;
  $('#bkExport').onclick = function () {
    var pass = ($('#bkPass') || {}).value || '';
    var plain = JSON.stringify(DB, null, 1);
    var name = 'ihesab-backup-' + todayISO() + (pass ? '-encrypted' : '') + '.json';
    var content = pass ? JSON.stringify(encBackup(plain, pass)) : plain;
    var uri = doSaveFile(name, content, 'application/json');
    if (uri) { DB.settings.lastBackup = Date.now(); saveDB(); }
    toast(uri ? (pass ? 'فایل پشتیبان رمزدار ذخیره شد (پوشه دانلودها) 🔐' : 'فایل پشتیبان ذخیره شد (پوشه دانلودها)') : 'ذخیره فایل ممکن نشد');
    renderBackup();
  };
  $('#bkFile').onchange = function () {
    var f = this.files && this.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var data = JSON.parse(rd.result);
        if (data && data.enc === 'ihesab1') {
          openModal('🔐 فایل پشتیبان رمزدار است',
            fRow('گذرواژه فایل', '<input id="decPass" type="password" autocomplete="off">') + '<div class="err" id="decErr"></div>',
            [
              { label: 'رمزگشایی و بازیابی', cb: function (close) {
                  var txt = decBackup(data, val('decPass'));
                  if (!txt) { $('#decErr').textContent = 'گذرواژه اشتباه است یا فایل خراب شده.'; return; }
                  try {
                    var inner = JSON.parse(txt);
                    close(); restoreFromData(inner);
                  } catch (e) { $('#decErr').textContent = 'محتوای فایل معتبر نیست.'; }
                } },
              { label: 'انصراف', cls: 'gray', cb: function (close) { close(); } }
            ]);
          return;
        }
        restoreFromData(data);
      } catch (e) { toast('فایل پشتیبان معتبر نیست'); }
    };
    rd.readAsText(f);
  };
  $('#bkSample').onclick = function () {
    uiConfirm('داده نمونه به اطلاعات فعلی اضافه شود؟').then(function (ok) {
      if (ok) { loadSampleData(); toast('داده نمونه اضافه شد'); show('dash'); }
    });
  };
  $('#bkWipe').onclick = function () {
    uiConfirm('همه داده‌های فروشگاه حذف شود؟ این کار قابل برگشت نیست. (پیشنهاد: اول خروجی پشتیبان بگیرید)').then(function (ok) {
      if (!ok) return;
      uiConfirm('واقعاً مطمئنید؟ همه کالاها، فاکتورها، اشخاص و حساب‌ها پاک می‌شوند.', 'بله، همه حذف شود').then(function (ok2) {
        if (!ok2) return;
        var keep = DB.settings;
        DB = blankDB(); DB.settings.shopName = keep.shopName; DB.settings.owner = keep.owner;
        DB.settings.phone = keep.phone; DB.settings.address = keep.address; DB.settings.currency = keep.currency;
        DB.accounts.push({ id: newId('acc'), name: 'صندوق فروشگاه', type: 'cash', opening: 0 });
        audit('حذف همه داده‌ها', 'شروع تازه');
        saveDB(); toast('همه داده‌ها حذف شد'); show('dash');
      });
    });
  };
}

/* ---------- تنظیمات ---------- */
function renderSettings() {
  var v = $('#view'), st = DB.settings;
  var logoData = st.shopLogo || '';
  v.innerHTML = '<div class="secTitle">⚙️ ' + tr('تنظیمات') + '</div>' +
    '<div class="card"><h3>🎨 ' + tr('ظاهر و زبان') + '</h3>' +
    fRow(tr('فونت برنامه'), '<select id="stFont">' + Object.keys(FONTS).map(function (k) {
      return '<option value="' + k + '"' + (st.font === k ? ' selected' : '') + '>' + esc(FONTS[k].name) + '</option>';
    }).join('') + '</select>') +
    '<p id="stFontPrev" style="border:1px dashed var(--line);border-radius:10px;padding:10px 12px;margin:0 0 12px">پیش‌نمایش فونت: فروش امروز ۱۲٬۵۰۰ تومان · Sale 12,500</p>' +
    fRow('اندازه فونت', '<select id="stFontSize">' + FONT_SIZES.map(function (s) {
      return '<option value="' + s.v + '"' + ((st.fontSize || 100) === s.v ? ' selected' : '') + '>' + s.name + '</option>';
    }).join('') + '</select>') +
    fRow(tr('زبان برنامه'), '<select id="stLang"><option value="fa"' + (st.lang !== 'en' ? ' selected' : '') + '>فارسی</option><option value="en"' + (st.lang === 'en' ? ' selected' : '') + '>English</option></select>') +
    fRow('حالت نمایش', '<select id="stTheme"><option value="auto"' + (st.theme === 'auto' ? ' selected' : '') + '>خودکار (طبق گوشی)</option><option value="light"' + (st.theme === 'light' ? ' selected' : '') + '>روشن ☀️</option><option value="dark"' + (st.theme === 'dark' ? ' selected' : '') + '>تاریک 🌙</option></select>') +
    '<div class="f"><label>پالت رنگی برنامه</label><div class="palRow">' + Object.keys(PALETTES).map(function (k) {
      return '<button type="button" class="palSw' + (st.palette === k ? ' on' : '') + '" data-pal="' + k + '" title="' + esc(PALETTES[k].name) + '" style="background:linear-gradient(140deg,' + PALETTES[k].b + ',' + PALETTES[k].d + ')"></button>';
    }).join('') + '</div><div class="palName" id="palName">' + esc((PALETTES[st.palette] || PALETTES.sky).name) + '</div></div>' +
    '<p class="mut small">' + (st.lang === 'en' ? 'Note: Menus, titles and main buttons are translated. Invoice documents, data names and assistant answers stay in Persian.' : 'یادداشت: با انتخاب English منوها، عنوان‌ها و دکمه‌های اصلی انگلیسی و چیدمان چپ‌چین می‌شود؛ متن فاکتورها، نام داده‌ها و پاسخ‌های دستیار فارسی می‌ماند.') + '</p></div>' +
    '<div class="card"><h3>🎬 انیمیشن و جلوه‌ها</h3>' +
    '<div class="f"><label>افکت حرکت صفحه‌ها و پنجره‌ها</label><div class="animRow">' + Object.keys(ANIM_EFFECTS).map(function (k) {
      return '<button type="button" class="animChip' + (animSetting().effect === k ? ' on' : '') + '" data-anim-fx="' + k + '"><span class="animIc">' + ANIM_EFFECTS[k].ic + '</span>' + ANIM_EFFECTS[k].name + '</button>';
    }).join('') + '</div></div>' +
    fRow('سرعت انیمیشن', '<select id="stAnimSpeed">' + Object.keys(ANIM_SPEEDS).map(function (k) {
      return '<option value="' + k + '"' + (animSetting().speed === k ? ' selected' : '') + '>' + ANIM_SPEEDS[k].name + '</option>';
    }).join('') + '</select>') +
    '<div class="animPrev" id="animPrevBox">✨ کارت پیش‌نمایش<br><span class="mut small" style="font-weight:normal">این کارت با افکت و سرعت انتخابی شما حرکت می‌کند</span></div>' +
    '<button class="btn gray" id="animPrevBtn" type="button">▶️ پیش‌نمایش</button>' +
    '<p class="mut small" style="margin:10px 0 0">با انتخاب هر افکت، همان لحظه روی صفحه‌ها، پنجره‌ها و منوی کناری اعمال و ذخیره می‌شود.</p></div>' +
    '<div class="card"><h3>💾 نسخه و داده‌ها</h3>' +
    '<p style="margin:4px 0 10px">⭐ نسخه ۷٫۶ — <b>همه امکانات فعال است</b>؛ هیچ سقف و محدودیتی برای فاکتور، کالا و مشتری وجود ندارد.</p>' +
    '<p class="mut small" style="margin:0">داده‌ها در دیتابیس داخلی برنامه ذخیره می‌شود و هر روز یک پشتیبان خودکار در پوشه <b>iHesab-backups</b> گوشی نگه داشته می‌شود (۷ نسخه آخر).</p></div>' +
    '<div class="card"><h3>🔐 قفل برنامه (بدون نیاز به کاربر)</h3>' +
    (function () {
      var lk = st.appLock;
      var h = '<p class="mut small" style="margin-top:0">' + (lk && lk.hash ? 'وضعیت فعلی: <b>فعال</b> — ' + (lk.type === 'pin' ? 'رمز عددی' : 'رمز قوی (حروف)') + (lk.fp ? ' + اثر انگشت' : '') : 'وضعیت فعلی: <b>بدون قفل</b> — برنامه بدون رمز باز می‌شود.') + '</p>';
      if (lk && lk.hash) h += fRow('رمز فعلی (برای تغییر یا حذف قفل لازم است)', '<input id="lkCur" type="password" autocomplete="off" placeholder="رمز فعلی برنامه">');
      h += fRow('نوع قفل', '<select id="lkType"><option value="off"' + (!lk ? ' selected' : '') + '>بدون قفل</option><option value="pin"' + (lk && lk.type === 'pin' ? ' selected' : '') + '>رمز عددی (PIN)</option><option value="pass"' + (lk && lk.type === 'pass' ? ' selected' : '') + '>رمز قوی (حروف)</option></select>');
      h += '<div id="lkPinBox" style="display:none">' +
        fRow('رمز عددی جدید (۴ تا ۶ رقم)', '<input id="lkPin1" type="password" inputmode="numeric" maxlength="6" autocomplete="off">') +
        fRow('تکرار رمز عددی', '<input id="lkPin2" type="password" inputmode="numeric" maxlength="6" autocomplete="off">') + '</div>';
      h += '<div id="lkPassBox" style="display:none">' +
        fRow('رمز قوی جدید', '<input id="lkPass1" type="password" autocomplete="off" placeholder="مثلاً Shop@2026">') +
        fRow('تکرار رمز قوی', '<input id="lkPass2" type="password" autocomplete="off">') +
        '<div id="lkChecks" class="small" style="line-height:2;margin-bottom:10px"></div></div>';
      h += '<label class="row" style="align-items:center;gap:8px;margin:4px 0 12px"><input type="checkbox" id="lkFp"' + (lk && lk.fp ? ' checked' : '') + ' style="width:19px;height:19px"> ورود با اثر انگشت هم فعال باشد (اگر گوشی پشتیبانی کند)</label>';
      h += '<button class="btn" id="stLockSave">🔐 ذخیره تنظیمات قفل</button>';
      return h;
    })() + '</div>' +
    '<div class="card"><h3>📁 محل ذخیره فایل‌ها</h3>' +
    '<p class="mut small" style="margin-top:0">فایل‌های اکسل، خروجی فاکتورها و پشتیبان‌ها در این محل ذخیره می‌شوند.</p>' +
    '<p style="margin:6px 0 12px">محل فعلی: <b id="stFolderLabel">' + esc(folderLabelText()) + '</b></p>' +
    '<div class="row"><button class="btn gray" id="stFolderPick">📁 انتخاب پوشه دلخواه</button><button class="btn gray" id="stFolderReset">پیش‌فرض (دانلودها)</button></div></div>' +
    '<div class="card"><h3>' + tr('مشخصات فروشگاه') + (st.lang === 'en' ? '' : ' (روی فاکتور چاپ می‌شود)') + '</h3>' +
    fRow(tr('نام فروشگاه'), '<input id="stName" value="' + esc(st.shopName) + '">') +
    '<div class="grid2">' + fRow(tr('نام مالک'), '<input id="stOwner" value="' + esc(st.owner) + '">') +
    fRow(tr('تلفن'), '<input id="stPhone" inputmode="tel" value="' + esc(st.phone) + '">') + '</div>' +
    fRow(tr('آدرس'), '<input id="stAddr" value="' + esc(st.address) + '">') +
    fRow(tr('متن پایانی فاکتور'), '<input id="stFooter" value="' + esc(st.invoiceFooter) + '">') +
    '<div class="f"><label>لوگوی فروشگاه (روی فاکتور چاپ می‌شود)</label><div class="row" style="align-items:center">' +
    '<span id="stLogoPrev">' + (logoData ? '<img src="' + logoData + '" style="height:52px;border-radius:10px;background:#fff;padding:3px">' : '<span class="mut small">بدون لوگو</span>') + '</span>' +
    '<label class="btn gray sm" style="cursor:pointer">📷 انتخاب لوگو<input type="file" id="stLogo" accept="image/*" hidden></label>' +
    '<button class="btn gray sm" id="stLogoDel" type="button">حذف</button></div></div>' +
    fRow('اندازه کاغذ چاپ فاکتور', '<select id="stPrintSize"><option value="a4"' + (st.printSize === 'a4' ? ' selected' : '') + '>A4 (معمولی)</option><option value="t80"' + (st.printSize === 't80' ? ' selected' : '') + '>فیش حرارتی ۸۰ میلی</option><option value="t58"' + (st.printSize === 't58' ? ' selected' : '') + '>فیش حرارتی ۵۸ میلی</option></select>') +
    fRow('🎁 باشگاه مشتریان: هر چند ' + esc(st.currency) + ' خرید = ۱ امتیاز', '<input id="stClub" inputmode="numeric" value="' + faNum(st.clubToman || 10000) + '">') + '</div>' +
    '<div class="card"><h3>' + tr('تنظیمات مالی') + '</h3>' +
    fRow(tr('واحد پول'), '<select id="stCur"><option value="تومان"' + (st.currency === 'تومان' ? ' selected' : '') + '>تومان</option><option value="ریال"' + (st.currency === 'ریال' ? ' selected' : '') + '>ریال</option></select>') +
    fRow(tr('نرخ مالیات پیش‌فرض فروش (٪)'), '<input id="stTax" inputmode="decimal" value="' + faNum(st.defaultTax) + '">') + '</div>' +
    '<div class="card"><h3>🔗 بخش‌های دیگر</h3>' +
    '<button class="setRow" data-go="finance"><span class="sic">🏦</span><span class="grow">حساب‌ها و صندوق‌ها</span><span class="chev">‹</span></button>' +
    '<button class="setRow" data-go="products"><span class="sic">🏷️</span><span class="grow">دسته‌بندی کالاها</span><span class="chev">‹</span></button>' +
    '<button class="setRow" data-go="users"><span class="sic">🔒</span><span class="grow">کاربران و قفل برنامه</span><span class="chev">‹</span></button>' +
    '<button class="setRow" data-go="backup"><span class="sic">💾</span><span class="grow">پشتیبان‌گیری و بازیابی</span><span class="chev">‹</span></button></div>' +
    '<button class="btn block" id="stSave">' + tr('ذخیره تنظیمات') + '</button>' +
    '<div class="card" style="margin-top:12px"><p class="mut small">آی‌حساب نسخه ۷٫۶ · حسابداری فروشگاهی<br>داده‌ها فقط روی همین گوشی ذخیره می‌شود؛ بدون نیاز به هیچ ثبت‌نام یا حسابی.</p><button class="btn gray" id="stChanges" style="margin-top:8px">🆕 تازه‌های این نسخه</button></div>';
  var prevEl = $('#stFontPrev');
  function updPrev() { if (prevEl) prevEl.style.fontFamily = (FONTS[val('stFont')] || FONTS.tahoma).css; }
  $('#stFont').onchange = updPrev; updPrev();
  var fsSel = $('#stFontSize');
  if (fsSel) fsSel.onchange = function () { st.fontSize = +fsSel.value; applyFontSize(); saveDB(); };
  var stLogo = $('#stLogo');
  if (stLogo) stLogo.onchange = function () {
    var f = stLogo.files && stLogo.files[0]; if (!f) return;
    fileToDataUrl(f, 320, function (url) {
      logoData = url;
      var pv = $('#stLogoPrev');
      if (pv) pv.innerHTML = '<img src="' + url + '" style="height:52px;border-radius:10px;background:#fff;padding:3px">';
    });
  };
  var stLogoDel = $('#stLogoDel');
  if (stLogoDel) stLogoDel.onclick = function () { logoData = ''; var pv = $('#stLogoPrev'); if (pv) pv.innerHTML = '<span class="mut small">بدون لوگو</span>'; };
  $$('#view .palSw').forEach(function (b) {
    b.onclick = function () {
      st.palette = b.dataset.pal;
      $$('#view .palSw').forEach(function (x) { x.classList.toggle('on', x === b); });
      var pn = $('#palName'); if (pn) pn.textContent = PALETTES[st.palette].name;
      applyPalette(); saveDB();
    };
  });
  function animEnsure() {
    if (!st.anim || typeof st.anim !== 'object') st.anim = { effect: 'fade', speed: 'normal' };
    return st.anim;
  }
  $$('#view .animChip').forEach(function (b) {
    b.onclick = function () {
      animEnsure().effect = b.dataset.animFx;
      $$('#view .animChip').forEach(function (x) { x.classList.toggle('on', x === b); });
      applyAnim(); saveDB();
      playAnimOn($('#animPrevBox'));
    };
  });
  var aSpd = $('#stAnimSpeed');
  if (aSpd) aSpd.onchange = function () {
    animEnsure().speed = aSpd.value;
    applyAnim(); saveDB();
    playAnimOn($('#animPrevBox'));
  };
  var aPrevBtn = $('#animPrevBtn');
  if (aPrevBtn) aPrevBtn.onclick = function () { playAnimOn($('#animPrevBox')); };
  var stCh = $('#stChanges'); if (stCh) stCh.onclick = function () { showChangelog(); };
  var fpick = $('#stFolderPick');
  if (fpick) fpick.onclick = function () {
    try {
      if (typeof Android !== 'undefined' && Android.pickExportFolder) { Android.pickExportFolder(); toast('پوشه موردنظرتان را انتخاب و تأیید کنید'); }
      else toast('انتخاب پوشه فقط در نسخه اندروید ممکن است');
    } catch (e) { toast('انتخاب پوشه ممکن نشد'); }
  };
  var freset = $('#stFolderReset');
  if (freset) freset.onclick = function () {
    try { if (typeof Android !== 'undefined' && Android.clearExportFolder) Android.clearExportFolder(); } catch (e) {}
    var lb = $('#stFolderLabel'); if (lb) lb.textContent = folderLabelText();
    toast('محل ذخیره به پیش‌فرض برگشت: Downloads/iHesab');
  };
  (function wireAppLock() {
    var typeSel = $('#lkType'); if (!typeSel) return;
    function lkDrawChecks() {
      var box = $('#lkChecks'); if (!box) return;
      var c = strongPassCheck(val('lkPass1') || '');
      function row(ok, label) { return '<div>' + (ok ? '✅' : '⬜') + ' ' + label + '</div>'; }
      box.innerHTML = row(c.len, 'حداقل ۸ کاراکتر') + row(c.letter, 'شامل حرف') + row(c.digit, 'شامل عدد') + row(c.special, 'شامل کاراکتر خاص (مثل @ # $) ‏') + row(c.upper, 'شامل حداقل یک حرف بزرگ (A-Z)');
    }
    function lkSync() {
      var t = typeSel.value;
      var pb = $('#lkPinBox'); if (pb) pb.style.display = t === 'pin' ? '' : 'none';
      var sb = $('#lkPassBox'); if (sb) sb.style.display = t === 'pass' ? '' : 'none';
      lkDrawChecks();
    }
    typeSel.onchange = lkSync;
    var p1 = $('#lkPass1'); if (p1) p1.oninput = lkDrawChecks;
    lkSync();
    $('#stLockSave').onclick = function () {
      var cur = DB.settings.appLock;
      var type = typeSel.value;
      if (cur && cur.hash) {
        var curEl = $('#lkCur');
        if (!curEl || !curEl.value || pinHash(curEl.value) !== cur.hash) { toast('رمز فعلی برنامه درست نیست'); return; }
      }
      if (type === 'off') {
        DB.settings.appLock = null; saveDB(); toast('قفل برنامه برداشته شد'); renderSettings(); return;
      }
      var fp = !!($('#lkFp') && $('#lkFp').checked);
      if (type === 'pin') {
        var a = val('lkPin1'), b = val('lkPin2');
        if (!/^\d{4,6}$/.test(a)) { toast('رمز عددی باید ۴ تا ۶ رقم باشد'); return; }
        if (a !== b) { toast('تکرار رمز عددی یکی نیست'); return; }
        DB.settings.appLock = { type: 'pin', hash: pinHash(a), fp: fp };
      } else {
        var s1 = val('lkPass1'), s2 = val('lkPass2');
        if (!strongPassOk(s1)) { toast('رمز قوی شرایط لازم را ندارد؛ چک‌لیست را کامل کنید'); return; }
        if (s1 !== s2) { toast('تکرار رمز قوی یکی نیست'); return; }
        DB.settings.appLock = { type: 'pass', hash: pinHash(s1), fp: fp };
      }
      saveDB();
      toast('🔐 قفل برنامه فعال شد');
      renderSettings();
    };
  })();
  $('#stSave').onclick = function () {
    var langChanged = st.lang !== val('stLang');
    st.shopName = val('stName').trim() || 'فروشگاه من';
    st.owner = val('stOwner'); st.phone = val('stPhone'); st.address = val('stAddr');
    st.invoiceFooter = val('stFooter'); st.currency = val('stCur'); st.defaultTax = num('stTax');
    st.font = val('stFont'); st.lang = val('stLang'); st.theme = val('stTheme');
    st.shopLogo = logoData; st.printSize = val('stPrintSize');
    st.clubToman = Math.max(1, num('stClub') || 10000);
    saveDB(); $('#drawerShop').textContent = st.shopName;
    applyFont(); applyLang(); applyTheme();
    toast(st.lang === 'en' ? 'Settings saved' : 'تنظیمات ذخیره شد');
    if (langChanged) startApp();
    else renderSettings();
  };
  $$('#view [data-go]').forEach(function (b) { b.onclick = function () { show(b.dataset.go); }; });
}

/* ---------- راه‌اندازی ---------- */
var BOTTOM_NAV = [
  { id: 'dash', t: 'خانه', ic: '🏠' },
  { id: 'sale', t: 'فاکتورها', ic: '🧾' },
  { id: 'reports', t: 'گزارش‌ها', ic: '📊' }
];
function startApp() {
  applyFont();
  applyFontSize();
  applyLang();
  applyTheme();
  applyPalette();
  applyAnim();
  maybeAutoBackup();
  var bn = $('#bottomnav');
  if (bn) {
    /* نوار پایین ۷٫۴: تب‌ها + دکمه + برجسته در وسط (فاکتور فروش جدید) + تب «منو» (منوی کناری با همه بخش‌ها) */
    var bnTabs = BOTTOM_NAV.filter(function (m) { return canSee(m.id); }).map(function (m) {
      return '<button type="button" data-id="' + m.id + '"><span class="ic">' + m.ic + '</span>' + tr(m.t) + '</button>';
    });
    var bnHalf = Math.ceil(bnTabs.length / 2);
    bn.innerHTML = bnTabs.slice(0, bnHalf).join('') +
      '<button type="button" class="bnPlus" id="bnPlus" aria-label="فاکتور فروش جدید">＋</button>' +
      bnTabs.slice(bnHalf).join('') +
      '<button type="button" data-id="menu" id="bnMenu"><span class="ic">☰</span>' + tr('منو') + '</button>';
  }
  $$('#bottomnav button').forEach(function (b) {
    b.onclick = function () {
      if (b.id === 'bnPlus') { openInvoiceEditor('sale'); return; }
      if (b.id === 'bnMenu') { openDrawer(true); return; }
      show(b.dataset.id);
    };
  });
  (function buildDrawer() {
    var lastG = '', ix = 0;
    $('#drawerMenu').innerHTML = MENU.filter(function (m) { return canSee(m.id); }).map(function (m) {
      var gh = '';
      if (m.g && m.g !== lastG) { gh = '<div class="dGroup">' + m.g + '</div>'; lastG = m.g; }
      return gh + '<button class="dItem" data-id="' + m.id + '" style="--i:' + (ix++) + '"><span class="ic">' + m.ic + '</span><span class="grow">' + tr(m.t) + '</span><span class="dChev">‹</span></button>';
    }).join('');
    updateDrawerStats();
  })();
  $$('#drawerMenu .dItem').forEach(function (b) { b.onclick = function () { show(b.dataset.id); }; });
  $('#menuBtn').onclick = function () { openDrawer(true); };
  $('#drawerScrim').onclick = function () { openDrawer(false); };
  $('#homeBtn').onclick = function () { show('dash'); };
  var vb = $('#voiceBtn');
  if (vb) vb.onclick = function () { startVoice('global'); };
  if (!window.__slObserved) {
    window.__slObserved = true;
    try {
      var slObs = new MutationObserver(function () { syncScrollLock(); });
      slObs.observe(document.body, { childList: true });
      var mr = document.getElementById('modalRoot');
      if (mr) slObs.observe(mr, { childList: true });
    } catch (e) {}
  }
  syncScrollLock();
  setTimeout(function () { try { checkSharedText(); } catch (e) {} }, 700);
  if (!window.__micDelegated) {
    window.__micDelegated = true;
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-voice-field]') : null;
      if (b) startVoice('field:' + b.dataset.voiceField);
    });
    document.addEventListener('click', function (e) {
      var f = e.target && e.target.closest ? e.target.closest('[data-calfield]') : null;
      if (!f) return;
      openJalCalendar(CALF[f.id] || '', function (iso) {
        CALF[f.id] = iso || '';
        f.value = iso ? fd(iso) : '';
        f.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }
  $('#fab').onclick = function () { openInvoiceEditor('sale'); };
  var u = curUser();
  $('#drawerFoot').innerHTML = '<div class="row" style="align-items:center"><span class="grow">آی‌حساب · نسخه ۷٫۶</span><button class="btn gray sm" id="drawerChanges">🆕 تازه‌ها</button></div>' +
    (u ? '<div style="margin-top:7px">' + esc(u.name) + ' (' + ROLES[u.role] + ')</div><button class="btn gray sm" id="lgOut" style="margin-top:6px;width:100%">🚪 خروج از برنامه</button>' : '');
  var lo = $('#lgOut'); if (lo) lo.onclick = logoutUser;
  var dc = $('#drawerChanges'); if (dc) dc.onclick = function () { openDrawer(false); showChangelog(); };
  show('dash');
  try { maybeShowChangelog(); } catch (e) {}
}
function proceedAfterAppLock() {
  if (DB.users.length) {
    if (curUser()) startApp();
    else lockOverlay();
  } else startApp();
}
function boot() {
  loadDB(function () {
    recompute();
    if (DB.settings.appLock && DB.settings.appLock.hash) appLockOverlay();
    else proceedAfterAppLock();
  });
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { flushSaveDB(); } });
  window.addEventListener('pagehide', function () { flushSaveDB(); });
}

/* ================= دستیار هوشمند داخلی (کاملاً آفلاین، بدون API خارجی) =================
   پرسش فارسی کاربر را تجزیه می‌کند و جواب را فقط از داده‌های واقعی فروشگاه می‌سازد. */
function normFa(s) {
  return String(s || '').toLowerCase()
    .replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - FA_ZERO; })
    .replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - AR_ZERO; })
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه').replace(/ئ/g, 'ی')
    .replace(/‌/g, ' ').replace(/[؟?.,!،؛:«»]/g, ' ').replace(/\s+/g, ' ').trim();
}
function hasAny(txt, words) { return words.some(function (w) { return txt.indexOf(w) >= 0; }); }
function parsePeriod(txt) {
  var t = todayISO(), m0 = monthRange(0), m1 = monthRange(-1);
  if (txt.indexOf('دیروز') >= 0) return { from: addDays(t, -1), to: addDays(t, -1), label: 'دیروز', pf: addDays(t, -2), pt: addDays(t, -2), plabel: 'پریروز' };
  if (txt.indexOf('امروز') >= 0) return { from: t, to: t, label: 'امروز', pf: addDays(t, -1), pt: addDays(t, -1), plabel: 'دیروز' };
  if (txt.indexOf('ماه قبل') >= 0 || txt.indexOf('ماه گذشته') >= 0) { var m2 = monthRange(-2); return { from: m1.from, to: m1.to, label: 'ماه قبل', pf: m2.from, pt: m2.to, plabel: 'دو ماه قبل' }; }
  if (txt.indexOf('هفته') >= 0) return { from: addDays(t, -6), to: t, label: '۷ روز اخیر', pf: addDays(t, -13), pt: addDays(t, -7), plabel: 'هفته قبلش' };
  if (txt.indexOf('امسال') >= 0 || txt.indexOf('سال جاری') >= 0) {
    var j = iso2j(t);
    var prevToJd = (j.jm === 12 && j.jd === 30 && jalCal(j.jy - 1).leap !== 0) ? 29 : j.jd;
    return { from: j2iso(j.jy, 1, 1), to: t, label: 'امسال', pf: j2iso(j.jy - 1, 1, 1), pt: j2iso(j.jy - 1, j.jm, prevToJd), plabel: 'پارسال' };
  }
  return { from: m0.from, to: m0.to, label: 'این ماه', pf: m1.from, pt: m1.to, plabel: 'ماه قبل' };
}
function cmpTxt(cur, prev, plabel) {
  if (!prev) return cur > 0 ? 'دوره قبل فروشی نبوده.' : '';
  var d = Math.round((cur - prev) / Math.abs(prev) * 100);
  if (d === 0) return 'تقریباً مثل ' + plabel + ' بوده.';
  return (d > 0 ? '▲ ' : '▼ ') + faNum(Math.abs(d)) + '٪ ' + (d > 0 ? 'بیشتر' : 'کمتر') + ' از ' + plabel + ' (' + fm(prev) + ')';
}
function findPersonIn(txt) {
  var best = null, bl = 0;
  DB.persons.forEach(function (p) {
    var n = normFa(p.name);
    if (n.length >= 2 && txt.indexOf(n) >= 0 && n.length > bl) { best = p; bl = n.length; }
  });
  return best;
}
function findProductIn(txt) {
  var best = null, bl = 0;
  DB.products.forEach(function (p) {
    var n = normFa(p.name);
    if (n.length >= 2 && txt.indexOf(n) >= 0 && n.length > bl) { best = p; bl = n.length; }
  });
  return best;
}
function periodInvoices(from, to, kinds) {
  return DB.invoices.filter(function (inv) {
    return inv.status === 'final' && invInRange(inv, from, to) && kinds.indexOf(inv.kind) >= 0;
  });
}
function dailySalesRate(pid, days) {
  var to = todayISO(), from = addDays(to, -(days || 30) + 1), qty = 0;
  DB.invoices.forEach(function (inv) {
    if (inv.status !== 'final' || !invInRange(inv, from, to)) return;
    if (inv.kind !== 'sale' && inv.kind !== 'sale_ret') return;
    var s = inv.kind === 'sale' ? 1 : -1;
    inv.items.forEach(function (it) { if (it.pid === pid) qty += s * nd(it.qty); });
  });
  return qty / (days || 30);
}
function reorderSuggestions() {
  var out = [];
  DB.products.forEach(function (p) {
    var rate = dailySalesRate(p.id, 30);
    if (rate <= 0) return;
    var cover = p._stock / rate;
    if (cover < 14) out.push({ p: p, rate: rate, cover: cover, suggest: Math.max(0, Math.ceil(rate * 30 - p._stock)) });
  });
  return out.sort(function (a, b) { return a.cover - b.cover; });
}
function slowMovers(days) {
  var to = todayISO(), from = addDays(to, -(days || 30) + 1);
  return DB.products.filter(function (p) {
    if (p._stock <= 0) return false;
    var sold = 0;
    DB.invoices.forEach(function (inv) {
      if (inv.status !== 'final' || (inv.kind !== 'sale') || !invInRange(inv, from, to)) return;
      inv.items.forEach(function (it) { if (it.pid === p.id) sold += nd(it.qty); });
    });
    return sold === 0;
  });
}
function computeInsights() {
  var out = [], t = todayISO();
  var overdueChq = DB.cheques.filter(function (c) { return c.status === 'pending' && c.dueDate < t; });
  if (overdueChq.length) out.push({ ic: '💳', lvl: 'bad', text: fn(overdueChq.length) + ' چک از سررسید گذشته و هنوز تعیین تکلیف نشده.' });
  var soonChq = DB.cheques.filter(function (c) { return c.status === 'pending' && c.dueDate >= t && daysBetween(t, c.dueDate) <= 3; });
  if (soonChq.length) out.push({ ic: '⏰', lvl: 'warn', text: fn(soonChq.length) + ' چک ظرف ۳ روز آینده سررسید می‌شود.' });
  if (typeof dueInstallments === 'function') {
    var di = dueInstallments(0);
    if (di.overdue.length) out.push({ ic: '📅', lvl: 'bad', text: fn(di.overdue.length) + ' قسط عقب‌افتاده به مبلغ ' + fm(di.overdueAmt) + ' داری.' });
    else if (di.soon.length) out.push({ ic: '📅', lvl: 'warn', text: fn(di.soon.length) + ' قسط تا یک هفته آینده سررسید می‌شود.' });
  }
  var re = reorderSuggestions().filter(function (x) { return x.cover < 7; });
  if (re.length) out.push({ ic: '📦', lvl: 'warn', text: fn(re.length) + ' کالا کمتر از یک هفته دیگر تمام می‌شود؛ مهم‌ترینشان: «' + esc(re[0].p.name) + '».' });
  var m0 = monthRange(0);
  var byCat = {};
  DB.expenses.forEach(function (e) { if (e.date >= m0.from && e.date <= m0.to) byCat[e.catId] = (byCat[e.catId] || 0) + nd(e.amount); });
  Object.keys(byCat).forEach(function (cid) {
    var prevSum = 0, cnt = 0;
    for (var k = 1; k <= 3; k++) {
      var mm = monthRange(-k), s = 0;
      DB.expenses.forEach(function (e) { if (e.catId === cid && e.date >= mm.from && e.date <= mm.to) s += nd(e.amount); });
      prevSum += s; cnt++;
    }
    var avg = prevSum / cnt;
    if (avg > 0 && byCat[cid] > avg * 1.6) {
      var c = expCatById(cid);
      out.push({ ic: '💸', lvl: 'warn', text: 'هزینه «' + esc(c ? c.name : 'سایر') + '» این ماه ' + fm(byCat[cid]) + ' بوده؛ حدود ' + fn(Math.round(byCat[cid] / avg)) + ' برابر میانگین ماه‌های قبل است.' });
    }
  });
  var neg = [];
  DB.invoices.forEach(function (inv) {
    if (inv.status === 'final' && inv.kind === 'sale' && invInRange(inv, m0.from, m0.to) && (inv.profit || 0) < 0) neg.push(inv);
  });
  if (neg.length) out.push({ ic: '📉', lvl: 'bad', text: fn(neg.length) + ' فاکتور فروش این ماه با زیان ثبت شده — قیمت فروش یا هزینه خرید را بازبینی کن.' });
  return out;
}
function ansCard(title, rowsHtml, note) {
  return '<div class="card" style="margin:6px 0"><h3>' + title + '</h3>' + rowsHtml +
    (note ? '<p class="mut small">' + note + '</p>' : '') + '</div>';
}
function arow(l, v) { return '<div class="row" style="padding:3px 0"><span class="grow">' + l + '</span><b>' + v + '</b></div>'; }
function askAssistant(rawQ) {
  var q = normFa(rawQ);
  if (!q) return ansCard('🤖 دستیار', '<p>سؤالت را بنویس؛ مثلاً: «سود این ماه؟» یا «روغن چقدر داریم؟»</p>');
  if (typeof canProfit === 'function' && !canProfit() && hasAny(q, ['سود', 'زیان', 'پرسود']))
    return ansCard('🔒 دسترسی محدود', '<p>گزارش‌های سود برای نقش شما محدود شده است. از مدیر بخواهید سطح دسترسی را تغییر دهد.</p>');
  var P = parsePeriod(q);
  var person = findPersonIn(q), product = findProductIn(q);

  if (hasAny(q, ['سلام', 'درود']) && q.length < 14)
    return ansCard('🤖 سلام!', '<p>من دستیار داخلی فروشگاه‌ام و از روی داده‌های خودت جواب می‌دم. بپرس: فروش، سود، بدهکارها، موجودی کالا، چک‌ها یا پیشنهاد سفارش.</p>');

  if (person && hasAny(q, ['بدهکار', 'بدهی', 'مانده', 'حساب', 'صورتحساب', 'چقدر']) || person && q === normFa(person.name)) {
    var b = personBalance(person.id);
    var st = personStatement(person.id).slice(-4);
    var rows = arow('مانده فعلی', (b > 0 ? 'بدهکار ' : b < 0 ? 'طلبکار ' : '') + fm(Math.abs(b)));
    st.forEach(function (r) { rows += arow((r.date ? fd(r.date) + ' · ' : '') + esc(r.label), fn(r.bal)); });
    return ansCard('👤 ' + esc(person.name), rows, 'از بخش اشخاص می‌توانی صورت‌حساب کاملش را ببینی و ارسال کنی.');
  }
  if (product && hasAny(q, ['موجودی', 'داریم', 'داري', 'مانده', 'چند تا', 'چقدر'])) {
    var whRows = DB.warehouses.map(function (w) { return arow('🏭 ' + esc(w.name), fn(whStock(product, w.id)) + ' ' + esc(product.unit || 'عدد')); }).join('');
    var rate = dailySalesRate(product.id, 30);
    return ansCard('📦 ' + esc(product.name),
      arow('موجودی کل', fn(product._stock) + ' ' + esc(product.unit || 'عدد')) + whRows +
      arow('بهای میانگین', fm(Math.round(product._avg))) +
      arow('ارزش موجودی', fm(Math.round(product._stock * product._avg))) +
      (rate > 0 ? arow('پوشش موجودی', 'حدود ' + fn(Math.max(0, Math.round(product._stock / rate))) + ' روز') : ''),
      rate > 0 ? 'میانگین فروش روزانه این کالا در ۳۰ روز اخیر: ' + faNum(Math.round(rate * 100) / 100) : 'در ۳۰ روز اخیر فروشی نداشته.');
  }
  if (product && hasAny(q, ['سود'])) {
    var tp = topProducts(P.from, P.to, 999, true).filter(function (x) { return x.pid === product.id; })[0];
    return ansCard('📈 سود «' + esc(product.name) + '» در ' + P.label,
      tp ? arow('تعداد فروش', fn(tp.qty)) + arow('مبلغ فروش', fm(Math.round(tp.amount))) + arow('سود', fm(Math.round(tp.profit))) : '<p>در این بازه فروشی ثبت نشده.</p>');
  }
  if (hasAny(q, ['سفارش', 'دوباره بخر', 'باید بخر', 'پیشنهاد خرید', 'چی بخرم', 'تموم']))
    {
      var recs = reorderSuggestions();
      if (!recs.length) return ansCard('🛒 پیشنهاد سفارش', '<p>فعلاً کالایی در آستانه اتمام نیست؛ موجودی همه کالاها برای بیش از دو هفته کافی است. 👍</p>');
      var rows2 = recs.slice(0, 8).map(function (x) {
        return arow('📦 ' + esc(x.p.name) + ' <span class="mut small">(موجودی ' + fn(x.p._stock) + ' · پوشش ' + fn(Math.max(0, Math.round(x.cover))) + ' روز)</span>', 'سفارش ' + fn(x.suggest) + ' ' + esc(x.p.unit || 'عدد'));
      }).join('');
      return ansCard('🛒 پیشنهاد سفارش مجدد', rows2, 'مبنای محاسبه: سرعت فروش ۳۰ روز اخیر و هدفِ پوشش یک ماهه.');
    }
  if (hasAny(q, ['راکد', 'کم فروش', 'کم‌فروش', 'نمی فروش', 'نمی‌فروش', 'فروش نرفت'])) {
    var sm = slowMovers(30);
    if (!sm.length) return ansCard('🐢 کالاهای راکد', '<p>کالای راکدی نداری؛ همه کالاهای موجود در ۳۰ روز اخیر فروش داشته‌اند. 🎉</p>');
    return ansCard('🐢 کالاهای بدون فروش در ۳۰ روز اخیر',
      sm.slice(0, 8).map(function (p) { return arow('📦 ' + esc(p.name), 'موجودی ' + fn(p._stock) + ' · ' + fm(Math.round(p._stock * p._avg)) + ' خواب سرمایه'); }).join(''));
  }
  if (hasAny(q, ['پرفروش', 'بیشترین فروش', 'بهترین فروش'])) {
    var tt = topProducts(P.from, P.to, 5, false);
    if (!tt.length) return ansCard('🏆 پرفروش‌ها', '<p>در ' + P.label + ' فروشی ثبت نشده.</p>');
    return ansCard('🏆 پرفروش‌ترین‌ها در ' + P.label, tt.map(function (x, i) {
      return arow(faNum(i + 1) + '. ' + esc(x.name), fn(x.qty) + ' عدد · ' + fm(Math.round(x.amount)));
    }).join(''));
  }
  if (hasAny(q, ['چک'])) {
    var duesA = chequesDue(7);
    var totIn = 0, totOut = 0;
    DB.cheques.forEach(function (c) { if (c.status === 'pending') { if (c.dir === 'in') totIn += nd(c.amount); else totOut += nd(c.amount); } });
    var rr = arow('چک‌های دریافتی در جریان', fm(totIn)) + arow('چک‌های پرداختی در جریان', fm(totOut)) + arow('سررسید تا یک هفته آینده', fn(duesA.length) + ' فقره');
    duesA.slice(0, 5).forEach(function (c) { rr += arow('💳 ' + (c.dir === 'in' ? 'دریافتی' : 'پرداختی') + ' · ' + fd(c.dueDate), fm(c.amount)); });
    return ansCard('💳 وضعیت چک‌ها', rr);
  }
  if (hasAny(q, ['بدهکار', 'بدهی مشتری', 'طلب ما', 'کیا بدهکار', 'چه کسانی بدهکار'])) {
    var ds = DB.persons.map(function (p) { return { p: p, b: personBalance(p.id) }; }).filter(function (x) { return x.b > 0; })
      .sort(function (a, b) { return b.b - a.b; });
    if (!ds.length) return ansCard('👥 بدهکاران', '<p>هیچ‌کس به فروشگاه بدهکار نیست. 🎉</p>');
    var sum = ds.reduce(function (s, x) { return s + x.b; }, 0);
    return ansCard('👥 بدهکاران (جمع: ' + fm(sum) + ')', ds.slice(0, 7).map(function (x) {
      return arow(esc(x.p.name), fm(x.b));
    }).join(''), ds.length > 7 ? 'و ' + fn(ds.length - 7) + ' نفر دیگر.' : '');
  }
  if (hasAny(q, ['طلبکار', 'بدهی ما', 'بدهکاریم', 'به کی بدهکار', 'به تامین کننده'])) {
    var cs = DB.persons.map(function (p) { return { p: p, b: personBalance(p.id) }; }).filter(function (x) { return x.b < 0; })
      .sort(function (a, b) { return a.b - b.b; });
    if (!cs.length) return ansCard('🏭 طلبکاران', '<p>به هیچ‌کس بدهی نداری. 🎉</p>');
    var sum2 = cs.reduce(function (s, x) { return s - x.b; }, 0);
    return ansCard('🏭 طلبکاران از ما (جمع: ' + fm(sum2) + ')', cs.slice(0, 7).map(function (x) {
      return arow(esc(x.p.name), fm(-x.b));
    }).join(''));
  }
  if (hasAny(q, ['هزینه'])) {
    var es = expenseSum(P.from, P.to), pp = expenseSum(P.pf, P.pt);
    var byCat2 = {};
    DB.expenses.forEach(function (e) { if (e.date >= P.from && e.date <= P.to) byCat2[e.catId] = (byCat2[e.catId] || 0) + nd(e.amount); });
    var top = Object.keys(byCat2).sort(function (a, b) { return byCat2[b] - byCat2[a]; })[0];
    var cat = top ? expCatById(top) : null;
    return ansCard('💸 هزینه‌ها در ' + P.label,
      arow('جمع هزینه‌ها', fm(es)) + (cat ? arow('بیشترین دسته: ' + esc(cat.name), fm(byCat2[top])) : '') +
      '<p class="mut small" style="margin:4px 0">' + cmpTxt(es, pp, P.plabel) + '</p>');
  }
  if (hasAny(q, ['صندوق', 'بانک', 'نقدینگی', 'موجودی حساب', 'پول چقدر'])) {
    var rr2 = DB.accounts.map(function (a) { return arow((a.type === 'cash' ? '💵 ' : '🏦 ') + esc(a.name), fm(accountBalance(a.id))); }).join('');
    return ansCard('🏦 نقدینگی', rr2 + arow('جمع کل', fm(accountsTotal())));
  }
  if (hasAny(q, ['ارزش انبار', 'موجودی انبار', 'سرمایه انبار'])) {
    return ansCard('📦 انبار', arow('ارزش کل موجودی', fm(inventoryValue())) + arow('تعداد اقلام', fn(DB.products.length)) + arow('کالاهای رو به اتمام', fn(lowStockList().length) + ' قلم'));
  }
  if (hasAny(q, ['پرسود', 'بیشترین سود', 'سود کالا'])) {
    var tp2 = topProducts(P.from, P.to, 5, true);
    if (!tp2.length) return ansCard('💹 پرسودترین‌ها', '<p>در ' + P.label + ' فروشی ثبت نشده.</p>');
    return ansCard('💹 پرسودترین کالاها در ' + P.label, tp2.map(function (x, i) {
      return arow(faNum(i + 1) + '. ' + esc(x.name), fm(Math.round(x.profit)));
    }).join(''));
  }
  if (hasAny(q, ['سود', 'زیان'])) {
    var g = profitSum(P.from, P.to), ex = expenseSum(P.from, P.to), net = g - ex;
    var gp = profitSum(P.pf, P.pt), exp2 = expenseSum(P.pf, P.pt);
    return ansCard('📈 سود و زیان ' + P.label,
      arow('سود ناخالص', fm(g)) + arow('هزینه‌ها', fm(ex)) + arow('سود خالص', '<span class="' + (net < 0 ? 'neg' : 'pos') + '">' + fm(net) + '</span>') +
      '<p class="mut small" style="margin:4px 0">دوره قبل (' + P.plabel + '): سود خالص ' + fm(gp - exp2) + '</p>',
      'سود ناخالص با بهای تمام‌شده میانگین موزون محاسبه شده.');
  }
  if (hasAny(q, ['فروش', 'فروختم', 'درآمد', 'فاکتور'])) {
    var s1 = salesSum(P.from, P.to, 'sale') - salesSum(P.from, P.to, 'sale_ret');
    var s0 = salesSum(P.pf, P.pt, 'sale') - salesSum(P.pf, P.pt, 'sale_ret');
    var cnt = periodInvoices(P.from, P.to, ['sale']).length, cntR = periodInvoices(P.from, P.to, ['sale_ret']).length;
    return ansCard('🧾 فروش ' + P.label,
      arow('فروش خالص (با مالیات)', fm(s1)) + arow('تعداد فاکتور فروش', fn(cnt)) + (cntR ? arow('برگشت از فروش', fn(cntR) + ' فاکتور') : '') +
      (cnt ? arow('میانگین هر فاکتور', fm(Math.round(s1 / cnt))) : '') +
      '<p class="mut small" style="margin:4px 0">' + cmpTxt(s1, s0, P.plabel) + '</p>');
  }
  return ansCard('🤖 متوجه نشدم', '<p>این‌ها را می‌توانم جواب بدهم:</p>' +
    ['امروز چقدر فروختم؟', 'سود این ماه چقدر بوده؟', 'کیا بهم بدهکارن؟', 'پرسودترین کالا چیه؟', 'چی باید سفارش بدم؟', 'چک‌ها چه وضعی دارن؟', 'هزینه‌های این ماه؟', 'کالاهای راکد کدومان؟', 'موجودی «نام کالا» چقدره؟'].map(function (s) {
      return '<div style="padding:2px 0">• ' + s + '</div>';
    }).join(''));
}

/* ---------- صفحه دستیار ---------- */
var chatLog = [];
function renderAssistant() {
  var v = $('#view');
  var ins = computeInsights();
  var h = '<div class="secTitle">🤖 حسابیار — دستیار هوشمند آی‌حساب</div>' +
    '<p class="mut" style="margin:-6px 2px 10px">کاملاً داخلی و آفلاین؛ جواب‌ها فقط از داده‌های فروشگاه خودت ساخته می‌شوند.</p>' +
    '<div class="card" style="margin-bottom:12px"><h3>🎤 فرمان‌های صوتی حسابیار</h3>' +
    '<p class="small" style="line-height:2.1;margin:0">دکمه «حسابیار» بالای برنامه را بزن و مثلاً بگو:<br>' +
    '• «فاکتور خرید به اسم آقای محمدی بزن شامل سه کارتن نوشابه و دو تا چیپس»<br>' +
    '• «از آقای محمدی پانصد هزار تومان بگیر»<br>' +
    '• «هزینه برق سیصد هزار تومان» یا «برو به گزارش‌ها» یا «سود این ماه چقدره؟»</p></div>';
  if (ins.length) {
    h += '<div class="card"><h3>💡 بینش‌های امروز</h3>' + ins.map(function (x) {
      return '<div class="row" style="padding:4px 0"><span>' + x.ic + '</span><span class="grow">' + x.text + '</span></div>';
    }).join('') + '</div>';
  }
  h += '<div class="card"><h3>💬 بپرس</h3><div class="row">' +
    '<input id="aiQ" class="grow" placeholder="مثلاً: سود این ماه چقدره؟" style="padding:11px;border:1px solid var(--line);border-radius:11px">' +
    '<button class="btn" id="aiSend">بپرس</button></div>' +
    '<div class="row wrap" style="margin-top:10px">' +
    ['امروز چقدر فروختم؟', 'سود این ماه؟', 'کیا بدهکارن؟', 'پرسودترین کالا؟', 'چی سفارش بدم؟', 'چک‌های نزدیک سررسید', 'کالاهای راکد', 'هزینه این ماه؟'].map(function (s) {
      return '<button class="chip" style="border:1px solid var(--line);cursor:pointer;padding:6px 12px" data-q="' + esc(s) + '">' + esc(s) + '</button>';
    }).join('') + '</div></div>';
  h += '<div id="aiLog">' + chatLog.map(function (m) {
    return '<div class="card" style="background:var(--green-l)"><b>🙋 ' + esc(m.q) + '</b></div>' + m.a;
  }).join('') + '</div>';
  v.innerHTML = h;
  function ask(q) {
    if (!q || !q.trim()) return;
    var a = askAssistant(q);
    chatLog.unshift({ q: q, a: a });
    if (chatLog.length > 20) chatLog.pop();
    renderAssistant();
  }
  $('#aiSend').onclick = function () { ask(val('aiQ')); };
  $('#aiQ').addEventListener('keydown', function (e) { if (e.key === 'Enter') ask(val('aiQ')); });
  $$('#view [data-q]').forEach(function (b) { b.onclick = function () { ask(b.dataset.q); }; });
}

/* ================= کاربران، نقش‌ها، قفل برنامه ================= */
var ROLES = { admin: 'مدیر', seller: 'فروشنده', stock: 'انباردار', accountant: 'حسابدار' };
var PERMS = {
  admin: '*',
  seller: ['dash', 'assistant', 'search', 'sale', 'persons'],
  stock: ['dash', 'assistant', 'buy', 'products', 'stock'],
  accountant: ['dash', 'assistant', 'search', 'persons', 'finance', 'ledger', 'cheques', 'reports', 'backup']
};
function pinHash(s) {
  var h = 5381;
  for (var i = 0; i < String(s).length; i++) h = ((h << 5) + h + String(s).charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(16);
}
function curUser() {
  try {
    if (!DB || !DB.users || !DB.users.length) return null;
    var id = localStorage.getItem('ihesab2_sess');
    if (!id) return null;
    return DB.users.filter(function (u) { return u.id === id; })[0] || null;
  } catch (e) { return null; }
}
var PERM_DEFS = [
  { k: 'dash', t: 'داشبورد' }, { k: 'assistant', t: 'دستیار هوشمند' }, { k: 'search', t: 'جست‌وجوی فاکتور' },
  { k: 'sale', t: 'فروش' }, { k: 'buy', t: 'خرید' }, { k: 'products', t: 'کالاها' },
  { k: 'stock', t: 'انبار' }, { k: 'persons', t: 'اشخاص' }, { k: 'finance', t: 'امور مالی' },
  { k: 'cheques', t: 'چک‌ها' }, { k: 'ledger', t: 'حسابداری دوطرفه' }, { k: 'reports', t: 'گزارش‌ها' }, { k: 'backup', t: 'پشتیبان‌گیری' },
  { k: 'settings', t: 'تنظیمات' }, { k: 'users', t: 'مدیریت کاربران' },
  { k: 'profit', t: 'مشاهده سود و قیمت خرید', sens: 1 },
  { k: 'void', t: 'ابطال فاکتور', sens: 1 },
  { k: 'delete', t: 'حذف (کالا، فاکتور، شخص و…)', sens: 1 }
];
var ALL_PERMS = PERM_DEFS.map(function (d) { return d.k; });
function rolePerms(role) {
  if (role === 'admin') return ALL_PERMS.slice();
  var base = (PERMS[role] || []).slice();
  if (role === 'accountant') base.push('profit');
  return base;
}
function userPerms(u) {
  if (!u) return ALL_PERMS.slice();
  if (u.perms && u.perms.length) return u.perms;
  return rolePerms(u.role);
}
function canDo(key) {
  var u = curUser();
  if (!u) return true;
  return userPerms(u).indexOf(key) >= 0;
}
function canSee(sec) { return canDo(sec); }
function canProfit() { return canDo('profit'); }
function canEditPrices() { return canDo('profit'); }
function canDelete() { return canDo('delete'); }
function canVoid() { return canDo('void'); }

function renderUsers() {
  if (!canSee('users')) { toast('دسترسی ندارید'); show('dash'); return; }
  var v = $('#view');
  var h = '<div class="secTitle">👤 ' + tr('کاربران') + '</div>' +
    '<p class="mut small">با تعریف حداقل یک کاربر (مدیر)، برنامه هنگام باز شدن رمز (PIN) می‌خواهد و هر نقش فقط به بخش‌های خودش دسترسی دارد.</p>' +
    '<button class="btn block" id="uNew" style="margin-bottom:12px">＋ کاربر جدید</button>';
  if (!DB.users.length) h += '<div class="empty">کاربری تعریف نشده — همه به همه بخش‌ها دسترسی دارند.</div>';
  h += DB.users.map(function (u) {
    return '<div class="listItem" data-uid="' + u.id + '"><div class="main"><div class="t">' + esc(u.name) + '</div>' +
      '<div class="s">' + ROLES[u.role] + (u.pin ? ' · دارای رمز' : ' · بدون رمز') + ' · ' + faNum(userPerms(u).length) + ' دسترسی' + (u.perms ? ' (سفارشی)' : '') + '</div></div><span>✏️</span></div>';
  }).join('') +
    '<div class="card"><h3>دسترسی کاربران</h3>' +
    '<p class="small">نقش‌ها فقط پیش‌فرض‌اند؛ موقع ساخت یا ویرایش هر کاربر می‌توانید تک‌تک دسترسی‌ها را با تیک انتخاب کنید — از جمله مشاهده سود، ابطال و حذف.</p>' +
    '<p class="small"><b>مدیر:</b> همه دسترسی‌ها · <b>فروشنده:</b> فروش، اشخاص و داشبورد (بدون سود) · ' +
    '<b>انباردار:</b> خرید، کالاها و انبار · <b>حسابدار:</b> مالی، چک‌ها، گزارش‌ها و سود</p>' +
    '<p class="mut small">حداقل یک کاربر همیشه باید دسترسی «مدیریت کاربران» داشته باشد.</p></div>';
  if ((DB.logins || []).length) {
    h += '<div class="card"><h3>🕓 سابقه ورودها</h3>' + DB.logins.slice(-15).reverse().map(function (l) {
      return '<div class="row" style="padding:4px 0"><span class="grow">' + esc(l.user) + '</span><span class="mut small">' + (l.method === 'fingerprint' ? '👆 اثر انگشت' : '🔢 رمز') + ' · ' + fdt(l.at) + '</span></div>';
    }).join('') + '</div>';
  }
  v.innerHTML = h;
  $('#uNew').onclick = function () { userEditor(); };
  $$('#view [data-uid]').forEach(function (el) { el.onclick = function () { userEditor(el.dataset.uid); }; });
}
function userEditor(id) {
  var u = id ? DB.users.filter(function (x) { return x.id === id; })[0] : null;
  var defRole = u ? u.role : (DB.users.length ? 'seller' : 'admin');
  var curPerms = u ? userPerms(u) : rolePerms(defRole);
  function permBoxes(sel) {
    var sec = PERM_DEFS.filter(function (d) { return !d.sens; }).map(function (d) {
      return '<label class="permBox"><input type="checkbox" class="usPerm" value="' + d.k + '"' + (sel.indexOf(d.k) >= 0 ? ' checked' : '') + '> ' + d.t + '</label>';
    }).join('');
    var sens = PERM_DEFS.filter(function (d) { return d.sens; }).map(function (d) {
      return '<label class="permBox sens"><input type="checkbox" class="usPerm" value="' + d.k + '"' + (sel.indexOf(d.k) >= 0 ? ' checked' : '') + '> ' + d.t + '</label>';
    }).join('');
    return '<div class="permGrid">' + sec + '</div><p class="mut small" style="margin:10px 0 4px">دسترسی‌های حساس:</p><div class="permGrid">' + sens + '</div>';
  }
  openModal(u ? 'ویرایش کاربر' : 'کاربر جدید',
    fRow('نام کاربر *', '<input id="usName" value="' + esc(u ? u.name : '') + '">') +
    fRow('نقش (پیش‌فرض دسترسی)', '<select id="usRole">' + Object.keys(ROLES).map(function (r) {
      return '<option value="' + r + '"' + (defRole === r ? ' selected' : '') + '>' + ROLES[r] + '</option>';
    }).join('') + '</select>') +
    '<div class="f"><label>دسترسی‌های این کاربر</label><div id="usPerms">' + permBoxes(curPerms) + '</div>' +
    '<div class="row" style="margin-top:8px"><button type="button" class="btn gray sm" id="usAll">همه</button><button type="button" class="btn gray sm" id="usNone">هیچکدام</button><span class="mut small grow">تغییر نقش، تیک‌ها را به پیش‌فرض همان نقش برمی‌گرداند.</span></div></div>' +
    fRow('رمز (PIN — ۴ تا ۶ رقم)', '<input id="usPin" inputmode="numeric" placeholder="خالی = بدون رمز" value="">') +
    '<div class="err" id="usErr"></div>',
    [
      { label: 'ذخیره', cb: function (close) {
          var name = val('usName').trim();
          if (!name) { $('#usErr').textContent = 'نام کاربر را وارد کنید.'; return; }
          var pin = val('usPin').trim();
          if (pin && !/^\d{4,6}$/.test(pin)) { $('#usErr').textContent = 'رمز باید ۴ تا ۶ رقم باشد.'; return; }
          var role = val('usRole');
          var perms = $$('#usPerms .usPerm').filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
          var admins = DB.users.filter(function (x) { return x.role === 'admin' && (!u || x.id !== u.id); }).length;
          if (u && u.role === 'admin' && role !== 'admin' && admins === 0) { $('#usErr').textContent = 'حداقل یک مدیر باید باقی بماند.'; return; }
          var othersWithUsers = DB.users.filter(function (x) { return (!u || x.id !== u.id) && userPerms(x).indexOf('users') >= 0; }).length;
          if (perms.indexOf('users') < 0 && othersWithUsers === 0) { $('#usErr').textContent = 'حداقل یک کاربر باید دسترسی «مدیریت کاربران» داشته باشد.'; return; }
          if (u) { u.name = name; u.role = role; u.perms = perms; if (pin) u.pin = pinHash(pin); }
          else DB.users.push({ id: newId('usr'), name: name, role: role, pin: pin ? pinHash(pin) : '', perms: perms });
          saveDB(); close(); renderUsers(); toast('کاربر ذخیره شد');
        } },
      u ? { label: 'حذف', cls: 'danger', cb: function (close) {
          var admins = DB.users.filter(function (x) { return x.role === 'admin' && x.id !== u.id; }).length;
          if (u.role === 'admin' && admins === 0) { toast('حداقل یک مدیر باید باقی بماند'); return; }
          close();
          uiConfirm('کاربر «' + u.name + '» حذف شود؟').then(function (ok) {
            if (!ok) return;
            DB.users = DB.users.filter(function (x) { return x.id !== u.id; });
            try { if (localStorage.getItem('ihesab2_sess') === u.id) localStorage.removeItem('ihesab2_sess'); } catch (e) {}
            saveDB(); renderUsers(); toast('حذف شد');
          });
        } } : { label: 'انصراف', cls: 'gray' }
    ]);
  var roleSel = $('#usRole');
  if (roleSel) roleSel.onchange = function () {
    var box = $('#usPerms'); if (!box) return;
    box.innerHTML = permBoxes(rolePerms(roleSel.value));
    wirePermBtns();
  };
  function wirePermBtns() {
    var all = $('#usAll'), none = $('#usNone');
    if (all) all.onclick = function () { $$('#usPerms .usPerm').forEach(function (c) { c.checked = true; }); };
    if (none) none.onclick = function () { $$('#usPerms .usPerm').forEach(function (c) { c.checked = false; }); };
  }
  wirePermBtns();
}
function lockOverlay() {
  var ov = document.createElement('div');
  ov.id = 'lockOv';
  ov.style.cssText = 'position:fixed;inset:0;background:var(--green);z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;padding:24px;gap:14px';
  var lockUid = DB.users.length === 1 ? DB.users[0].id : '';
  var fpAvail = false;
  try { fpAvail = typeof Android !== 'undefined' && !!Android.isFingerprintAvailable && Android.isFingerprintAvailable(); } catch (e) {}
  function unlock(u, method) {
    try {
      DB.logins = DB.logins || [];
      DB.logins.push({ user: u.name, at: Date.now(), method: method || 'pin' });
      if (DB.logins.length > 100) DB.logins = DB.logins.slice(-100);
      saveDB();
    } catch (e) {}
    try { localStorage.setItem('ihesab2_sess', u.id); } catch (e) {}
    window.__fpResult = null;
    ov.remove();
    startApp();
  }
  var pinBuf = '';
  function selUser() { return DB.users.filter(function (x) { return x.id === lockUid; })[0] || null; }
  function err(msg) { var e1 = ov.querySelector('#lkErr'); if (e1) e1.textContent = msg || ''; }
  function shake() {
    var d = ov.querySelector('#lkDots');
    if (d) { d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); }
  }
  function renderDots(state) {
    var d = ov.querySelector('#lkDots'); if (!d) return;
    var h = '';
    for (var i = 0; i < 6; i++) h += '<span class="d' + (i < pinBuf.length ? ' on' : '') + '"></span>';
    d.innerHTML = h;
    d.classList.toggle('ok', state === 'ok');
  }
  function success(u, method) {
    renderDots('ok');
    var chk = ov.querySelector('#lkCheck'); if (chk) chk.classList.add('show');
    var pad = ov.querySelector('#lkPadWrap'); if (pad) pad.classList.add('fadeOut');
    err('');
    setTimeout(function () { ov.classList.add('bye'); }, 480);
    setTimeout(function () { unlock(u, method); }, 900);
  }
  function attempt() {
    var u = selUser();
    if (!u) { err('اول کاربر را انتخاب کنید'); shake(); pinBuf = ''; renderDots(); return; }
    if (!u.pin) { success(u, 'pin'); return; }
    if (pinHash(pinBuf) === u.pin) { success(u, 'pin'); return; }
    if (pinBuf.length >= 6) { err('رمز اشتباه است؛ دوباره تلاش کنید'); shake(); pinBuf = ''; setTimeout(renderDots, 60); }
  }
  window.__fpResult = function (ok) {
    if (!ok) { err('اثر انگشت تأیید نشد؛ با رمز وارد شوید.'); shake(); return; }
    var u = selUser() || DB.users[0];
    if (u) success(u, 'fingerprint');
  };
  function draw() {
    pinBuf = '';
    var u0 = selUser();
    var chips = DB.users.map(function (u) {
      return '<button class="lkChip' + (lockUid === u.id ? ' sel' : '') + '" data-lu="' + u.id + '">' + esc(u.name) + '</button>';
    }).join('');
    var keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button class="lkKey" data-k="' + n + '">' + faNum(n) + '</button>'; }).join('');
    ov.innerHTML = '<div class="lkWrap">' +
      '<img class="lkLogo" src="logo.png" alt="">' +
      '<h2 class="lkTitle">آی‌حساب</h2>' +
      '<div class="lkSub">' + (DB.users.length > 1 ? 'کاربر را انتخاب و رمز را وارد کنید' : 'رمز ورود را وارد کنید') + '</div>' +
      (DB.users.length > 1 ? '<div class="lkChips">' + chips + '</div>' : '<div class="lkUserName">' + esc(DB.users[0].name) + '</div>') +
      '<div class="lkDots" id="lkDots"></div>' +
      '<div class="lkErr" id="lkErr"></div>' +
      '<div id="lkPadWrap">' +
      (u0 && !u0.pin
        ? '<button class="lkEnter" id="lkEnter">ورود بدون رمز ←</button>' +
          (fpAvail ? '<div style="margin-top:18px;display:flex;flex-direction:column;align-items:center;gap:7px"><button class="lkKey lkFpKey" id="lkFp">👆</button><div class="small" style="color:rgba(255,255,255,.85)">ورود با اثر انگشت</div></div>' : '')
        : '<div class="lkPad">' + keys +
          (fpAvail ? '<button class="lkKey lkFpKey" id="lkFp">👆</button>' : '<span></span>') +
          '<button class="lkKey" data-k="0">' + faNum(0) + '</button>' +
          '<button class="lkKey" data-k="del">⌫</button></div>') +
      (fpAvail && u0 && u0.pin ? '' : '') +
      '</div>' +
      '<div class="lkCheck" id="lkCheck">✓</div>' +
      '</div>';
    renderDots();
    ov.querySelectorAll('[data-lu]').forEach(function (b) { b.onclick = function () { lockUid = b.dataset.lu; draw(); }; });
    var ent = ov.querySelector('#lkEnter');
    if (ent) ent.onclick = function () { var u = selUser(); if (u) success(u, 'pin'); };
    ov.querySelectorAll('[data-k]').forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.k;
        if (k === 'del') { pinBuf = pinBuf.slice(0, -1); renderDots(); err(''); return; }
        if (pinBuf.length >= 6) return;
        pinBuf += k;
        renderDots();
        var u = selUser();
        if (!u || !u.pin || pinBuf.length >= 4) attempt();
      };
    });
    var fpBtn = ov.querySelector('#lkFp');
    if (fpBtn) fpBtn.onclick = function () {
      if (!lockUid && DB.users.length > 1) { err('اول کاربر را انتخاب کنید'); shake(); return; }
      try { Android.authenticateFingerprint(); } catch (e) { err('اثر انگشت در دسترس نیست.'); }
    };
  }
  draw();
  document.body.appendChild(ov);
  syncScrollLock();
}
function logoutUser() {
  try { localStorage.removeItem('ihesab2_sess'); } catch (e) {}
  $('#view').innerHTML = '';
  if (DB.settings.appLock && DB.settings.appLock.hash) appLockOverlay();
  else lockOverlay();
}
/* افزودن نام کاربر به سوابق */
var _auditOrig = audit;
audit = function (action, detail) {
  var u = curUser();
  _auditOrig(action, (u ? u.name + ' · ' : '') + (detail || ''));
};

/* ================= فروش اقساطی ================= */
function instRef(planId, ix) { return 'i_' + planId + '_' + ix; }
function instItemPaid(plan, ix) {
  var inv = invById(plan.invId); if (!inv) return 0;
  var s = 0, ref = instRef(plan.id, ix);
  (inv.paidBy || []).forEach(function (p) { if (p.ref === ref) s += nd(p.amount); });
  return s;
}
function instPlanRemain(plan) {
  var s = 0;
  plan.items.forEach(function (it, ix) { s += nd(it.amount) - instItemPaid(plan, ix); });
  return Math.max(0, Math.round(s));
}
function dueInstallments(days) {
  var t = todayISO(), lim = addDays(t, days || 0), res = { overdue: [], soon: [], overdueAmt: 0, soonAmt: 0 };
  (DB.installments || []).forEach(function (plan) {
    plan.items.forEach(function (it, ix) {
      var rem = nd(it.amount) - instItemPaid(plan, ix);
      if (rem <= 0) return;
      if (it.due < t) { res.overdue.push({ plan: plan, ix: ix, rem: rem }); res.overdueAmt += rem; }
      else if (it.due <= lim) { res.soon.push({ plan: plan, ix: ix, rem: rem }); res.soonAmt += rem; }
    });
  });
  return res;
}
function createInstallments(inv, count, firstDue, mode) {
  /* mode: 'month' (ماهانه) یا عدد روز بین اقساط */
  var remain = invoiceRemain(inv);
  if (remain <= 0 || count < 1) return null;
  var each = Math.floor(remain / count), items = [];
  for (var i = 0; i < count; i++) {
    var amt = i === count - 1 ? remain - each * (count - 1) : each;
    var due = mode === 'month' ? addMonthsISO(firstDue, i) : addDays(firstDue, i * nd(mode || 30));
    items.push({ due: due, amount: amt });
  }
  var plan = { id: newId('ins'), invId: inv.id, invNo: inv.no, personId: inv.personId, date: todayISO(), items: items };
  DB.installments.push(plan);
  audit('فروش اقساطی', 'فاکتور ' + fn(inv.no) + ' · ' + fn(count) + ' قسط');
  saveDB();
  return plan;
}
function payInstallment(planId, ix) {
  var plan = DB.installments.filter(function (x) { return x.id === planId; })[0]; if (!plan) return;
  var inv = invById(plan.invId); if (!inv) { toast('فاکتور مرتبط پیدا نشد'); return; }
  var it = plan.items[ix], rem = nd(it.amount) - instItemPaid(plan, ix);
  var per = personById(plan.personId);
  openModal('پرداخت قسط ' + faNum(ix + 1) + ' · فاکتور ' + fn(plan.invNo),
    '<p class="mut">' + (per ? esc(per.name) + ' · ' : '') + 'سررسید: ' + fdm(it.due) + ' · مانده این قسط: <b>' + fm(rem) + '</b></p>' +
    fRow('مبلغ پرداختی', '<input id="ipAmt" inputmode="numeric" value="' + fn(rem) + '">') +
    fRow('حساب دریافت', '<select id="ipAcc">' + accOptions((DB.accounts[0] || {}).id) + '</select>') +
    '<div class="err" id="ipErr"></div>',
    [
      { label: 'ثبت پرداخت', cb: function (close) {
          var amt = num('ipAmt');
          if (amt <= 0) { $('#ipErr').textContent = 'مبلغ معتبر وارد کنید.'; return; }
          inv.paidBy.push({ accId: val('ipAcc'), amount: amt, ref: instRef(plan.id, ix), date: todayISO(), note: 'قسط ' + (ix + 1) });
          audit('پرداخت قسط', 'فاکتور ' + fn(plan.invNo) + ' · قسط ' + fn(ix + 1) + ' · ' + fm(amt));
          saveDB(); close(); refresh(); toast('قسط ثبت شد');
        } },
      { label: 'انصراف', cls: 'gray' }
    ]);
}
function installmentsHtml() {
  var t = todayISO();
  var h = '<p class="mut small">از جزئیات هر فاکتور فروش، دکمه «📅 فروش اقساطی» را بزنید تا برای مانده‌اش برنامه اقساط بسازید.</p>';
  var plans = (DB.installments || []).slice().reverse();
  if (!plans.length) h += '<div class="empty">برنامه اقساطی ثبت نشده.</div>';
  h += plans.map(function (plan) {
    var per = personById(plan.personId), rem = instPlanRemain(plan);
    var rows = plan.items.map(function (it, ix) {
      var paid = instItemPaid(plan, ix), done = paid >= nd(it.amount);
      var overdue = !done && it.due < t;
      return '<div class="row" style="padding:4px 0;border-bottom:1px dashed var(--line)"><span class="grow">قسط ' + faNum(ix + 1) + ' · سررسید ' + fd(it.due) +
        (overdue ? ' <span class="chip red">عقب‌افتاده</span>' : '') + '</span><span>' + fm(it.amount) + '</span>' +
        (done ? '<span class="chip green">پرداخت شد</span>' : '<button class="btn sm" data-ipay="' + plan.id + ':' + ix + '">پرداخت</button>') + '</div>';
    }).join('');
    return '<div class="card"><div class="row"><b class="grow">فاکتور ' + fn(plan.invNo) + (per ? ' · ' + esc(per.name) : '') + '</b>' +
      (rem > 0 ? '<span class="chip amber">مانده ' + fm(rem) + '</span>' : '<span class="chip green">تسویه کامل</span>') +
      ' <button class="btn danger sm" data-idel="' + plan.id + '">حذف برنامه</button></div>' + rows + '</div>';
  }).join('');
  return h;
}
function wireInstallments() {
  $$('#view [data-ipay]').forEach(function (b) {
    b.onclick = function () { var p = b.dataset.ipay.split(':'); payInstallment(p[0], +p[1]); };
  });
  $$('#view [data-idel]').forEach(function (b) {
    b.onclick = function () {
      var plan = DB.installments.filter(function (x) { return x.id === b.dataset.idel; })[0];
      if (!plan) return;
      uiConfirm('برنامه اقساط فاکتور ' + plan.invNo + ' حذف شود؟ پرداخت‌های ثبت‌شده روی فاکتور باقی می‌مانند.').then(function (ok) {
        if (!ok) return;
        DB.installments = DB.installments.filter(function (x) { return x.id !== plan.id; });
        saveDB(); refresh(); toast('حذف شد');
      });
    };
  });
}
function installmentDialog(invId) {
  var inv = invById(invId); if (!inv) return;
  var exist = (DB.installments || []).some(function (p) { return p.invId === invId; });
  if (exist) { toast('برای این فاکتور قبلاً برنامه اقساط ساخته شده'); show('finance', 'inst'); return; }
  openModal('📅 فروش اقساطی · فاکتور ' + fn(inv.no),
    '<p>مانده فاکتور: <b>' + fm(invoiceRemain(inv)) + '</b></p>' +
    '<div class="grid2">' + fRow('تعداد اقساط', '<input id="icCount" inputmode="numeric" value="۳">') +
    fRow('فاصله اقساط', '<select id="icMode"><option value="month">ماهانه</option><option value="30">هر ۳۰ روز</option><option value="15">هر ۱۵ روز</option><option value="7">هفتگی</option></select>') + '</div>' +
    fRow('سررسید قسط اول', calField('icFirst', addMonthsISO(todayISO(), 1))) +
    '<div class="err" id="icErr"></div>',
    [
      { label: 'ساخت برنامه اقساط', cb: function (close) {
          var cnt = Math.round(num('icCount')), fdue = getCal('icFirst');
          if (cnt < 1 || cnt > 60) { $('#icErr').textContent = 'تعداد اقساط بین ۱ تا ۶۰ باشد.'; return; }
          if (!fdue) { $('#icErr').textContent = 'تاریخ سررسید اول نامعتبر است.'; return; }
          var plan = createInstallments(inv, cnt, fdue, val('icMode'));
          if (!plan) { $('#icErr').textContent = 'ساخت برنامه ممکن نشد.'; return; }
          close(); toast('برنامه اقساط ساخته شد'); show('finance', 'inst');
        } },
      { label: 'انصراف', cls: 'gray' }
    ]);
}

/* ================= فونت و زبان ================= */
var FONTS = {
  tahoma: { name: 'پیش‌فرض (Tahoma)', css: "Tahoma, 'Segoe UI', sans-serif" },
  vazir: { name: 'وزیرمتن (Vazirmatn)', css: "'Vazirmatn', Tahoma, sans-serif" },
  shabnam: { name: 'شبنم (Shabnam)', css: "'Shabnam', Tahoma, sans-serif" },
  samim: { name: 'صمیم (Samim)', css: "'Samim', Tahoma, sans-serif" },
  roboto: { name: 'Roboto', css: "'Roboto', Tahoma, sans-serif" },
  inter: { name: 'Inter', css: "'Inter', Tahoma, sans-serif" }
};
function applyFont() {
  if (typeof document === 'undefined' || !DB) return;
  var f = FONTS[DB.settings.font] || FONTS.tahoma;
  document.body.style.fontFamily = f.css;
  /* بارگذاری صریح فونت انتخابی (جاسازی‌شده به‌صورت data URI) و اعمال دوباره بعد از آماده‌شدن */
  try {
    if (document.fonts && document.fonts.load) {
      var fam = f.css.split(',')[0].replace(/['"]/g, '').trim();
      if (fam && fam !== 'Tahoma') {
        document.fonts.load('16px "' + fam + '"').then(function () { document.body.style.fontFamily = f.css; });
        document.fonts.load('bold 16px "' + fam + '"');
      }
    }
  } catch (e) {}
}
var T = {
  'داشبورد': 'Dashboard', 'دستیار هوشمند': 'Smart Assistant', 'فروش': 'Sales', 'خرید': 'Purchases',
  'کالاها': 'Products', 'انبار': 'Inventory', 'اشخاص': 'Contacts', 'مالی': 'Finance', 'چک‌ها': 'Cheques',
  'کاربران': 'Users', 'گزارش‌ها': 'Reports', 'پشتیبان‌گیری': 'Backup', 'تنظیمات': 'Settings',
  'جست‌وجوی فاکتور': 'Invoice Search',
  'فروش امروز': "Today's Sales", 'خرید امروز': "Today's Purchases",
  'سود ناخالص این ماه': 'Gross Profit (Month)', 'سود خالص این ماه': 'Net Profit (Month)',
  'موجودی صندوق': 'Cash Balance', 'موجودی بانک': 'Bank Balance',
  'بدهی مشتریان': 'Customer Debts', 'بدهی به تأمین‌کنندگان': 'Supplier Debts',
  'ارزش موجودی انبار': 'Inventory Value', 'تعداد کالاها': 'Product Count',
  'کالای رو به اتمام': 'Low Stock Items', 'چک نزدیک سررسید': 'Cheques Due Soon',
  'فاکتور فروش': 'Sale Invoice', 'فاکتور خرید': 'Purchase Invoice', 'کالای جدید': 'New Product',
  'ثبت هزینه': 'Add Expense', 'هشدارها': 'Alerts', 'فروش ۷ روز اخیر': 'Sales — Last 7 Days',
  'پرفروش‌ترین‌های این ماه': 'Top Sellers This Month', 'آخرین فاکتورها': 'Recent Invoices',
  'بینش‌های دستیار': 'Assistant Insights', 'جست‌وجوی فاکتورهای گذشته': 'Search Past Invoices',
  'فهرست کالاها': 'Product List', 'دسته‌بندی‌ها': 'Categories',
  'صندوق و بانک': 'Accounts', 'دریافت و پرداخت': 'Receipts & Payments', 'هزینه‌ها': 'Expenses',
  'درآمدها': 'Incomes', 'انتقال وجه': 'Transfers', 'اقساط': 'Installments',
  'فاکتورهای فروش': 'Sale Invoices', 'پیش‌فاکتورها': 'Proformas', 'برگشت از فروش': 'Sales Returns',
  'فاکتورهای خرید': 'Purchase Invoices', 'برگشت از خرید': 'Purchase Returns',
  'همه': 'All', 'مشتریان': 'Customers', 'تأمین‌کنندگان': 'Suppliers', 'بدهکاران': 'Debtors',
  'مشتری': 'Customer', 'تأمین‌کننده': 'Supplier', 'تاریخ (شمسی)': 'Date (Jalali)',
  'شخص جدید': 'New Contact', 'چک‌های دریافتی': 'Received Cheques', 'چک‌های پرداختی': 'Issued Cheques',
  'ذخیره': 'Save', 'بستن': 'Close', 'حذف': 'Delete', 'انصراف': 'Cancel', 'ویرایش': 'Edit', 'ثبت': 'Submit',
  'موجودی': 'Stock', 'کاردکس کالا': 'Product Ledger', 'عملیات انبار': 'Stock Operations',
  'نسخه پشتیبان': 'Backup File', 'سابقه عملیات حساس': 'Activity Log',
  'مشخصات فروشگاه': 'Shop Details', 'تنظیمات مالی': 'Financial Settings',
  'ظاهر و زبان': 'Appearance & Language', 'فونت برنامه': 'App Font', 'زبان برنامه': 'App Language',
  'واحد پول': 'Currency', 'ذخیره تنظیمات': 'Save Settings', 'نام فروشگاه': 'Shop Name',
  'نام مالک': 'Owner Name', 'تلفن': 'Phone', 'آدرس': 'Address', 'متن پایانی فاکتور': 'Invoice Footer Text',
  'نرخ مالیات پیش‌فرض فروش (٪)': 'Default Sales Tax Rate (%)',
  'ورود': 'Sign In', 'رمز ورود (PIN)': 'PIN Code', 'فروشنده/صادرکننده': 'Seller',
  'اقلام': 'Items', 'جمع‌بندی': 'Totals', 'پرداخت به تأمین‌کننده': 'Pay Supplier',
  'دریافت از مشتری': 'Receive from Customer',
  'سود این ماه': 'Profit This Month',
  'هزینه امروز': "Today's Expenses", 'سود امروز': "Today's Profit",
  'فروش و هزینه (۷ روز اخیر)': 'Sales & Expenses (Last 7 Days)', 'آخرین تراکنش‌ها': 'Recent Activity', 'محدود شده': 'Restricted'
};
function tr(s) {
  return (DB && DB.settings.lang === 'en' && T[s]) ? T[s] : s;
}
function applyLang() {
  if (typeof document === 'undefined' || !DB) return;
  var en = DB.settings.lang === 'en';
  document.documentElement.lang = en ? 'en' : 'fa';
  document.documentElement.dir = en ? 'ltr' : 'rtl';
  document.body.classList.toggle('ltr', en);
}
function applyTheme() {
  if (typeof document === 'undefined' || !DB) return;
  document.body.classList.toggle('dark', DB.settings.theme === 'dark');
  document.body.classList.toggle('light', DB.settings.theme === 'light');
}
var FONT_SIZES = [
  { v: 90, name: 'کوچک' },
  { v: 100, name: 'معمولی' },
  { v: 115, name: 'بزرگ' },
  { v: 130, name: 'خیلی بزرگ' }
];
function applyFontSize() {
  if (typeof document === 'undefined' || !DB) return;
  var pct = DB.settings.fontSize || 100;
  try {
    if (typeof Android !== 'undefined' && Android && Android.setTextZoom) { Android.setTextZoom(pct); return; }
  } catch (e) {}
  document.body.style.zoom = pct === 100 ? '' : String(pct / 100);
}
var PALETTES = {
  sky: { name: 'آبی آسمانی', g: '#2E7CF6', d: '#1B5FD9', dd: '#0F3D91', l: '#E7F1FE', b: '#56A8FF' },
  emerald: { name: 'سبز زمردی', g: '#0F7D58', d: '#0B5C43', dd: '#083d2b', l: '#E8F5EE', b: '#12a06b' },
  ocean: { name: 'آبی اقیانوسی', g: '#1565C0', d: '#0D47A1', dd: '#072f66', l: '#E3F0FA', b: '#1E88E5' },
  teal: { name: 'فیروزه‌ای', g: '#0E7C86', d: '#095A61', dd: '#063C40', l: '#E2F4F5', b: '#14A3AE' },
  grape: { name: 'بنفش', g: '#6D4AC8', d: '#4A2B8F', dd: '#2E1A5E', l: '#EEE9FA', b: '#7E57C2' },
  amber: { name: 'کهربایی', g: '#B45309', d: '#92400E', dd: '#5F2A06', l: '#FBF0E1', b: '#D97706' },
  ruby: { name: 'زرشکی', g: '#B0324A', d: '#7E2236', dd: '#521525', l: '#FAE8EC', b: '#C94F6D' },
  graphite: { name: 'گرافیتی', g: '#47596B', d: '#2F3E4D', dd: '#1D2833', l: '#E9EEF2', b: '#647C93' }
};
function applyPalette() {
  if (typeof document === 'undefined' || !DB) return;
  var p = PALETTES[DB.settings.palette] || PALETTES.sky;
  var r = document.documentElement.style;
  r.setProperty('--green', p.g);
  r.setProperty('--green-d', p.d);
  r.setProperty('--green-dd', p.dd);
  r.setProperty('--green-b', p.b);
  /* توکن‌های طراحی ۷٫۴: رنگ اصلی و مشتقاتش از همان پالت کاربر می‌آیند */
  r.setProperty('--pri', p.g);
  r.setProperty('--pri-b', p.b);
  r.setProperty('--pri-d', p.d);
  if (DB.settings.theme !== 'dark') { r.setProperty('--green-l', p.l); r.setProperty('--pri-l', p.l); }
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', p.g);
}
/* ---------- انیمیشن و جلوه‌های حرکتی (قابل انتخاب توسط کاربر — ۷٫۳) ---------- */
var ANIM_EFFECTS = {
  fade: { name: 'محو شدن', ic: '🌫️' },
  slide: { name: 'لغزش', ic: '↔️' },
  zoom: { name: 'بزرگنمایی', ic: '🔍' },
  flip: { name: 'برگردان', ic: '🔄' },
  up: { name: 'از پایین', ic: '⬆️' },
  none: { name: 'بدون انیمیشن', ic: '🚫' }
};
var ANIM_SPEEDS = {
  slow: { name: 'کند', ms: 450 },
  normal: { name: 'معمولی', ms: 280 },
  fast: { name: 'سریع', ms: 150 }
};
function animSetting() {
  var a = (DB && DB.settings && DB.settings.anim) || {};
  return {
    effect: ANIM_EFFECTS[a.effect] ? a.effect : 'fade',
    speed: ANIM_SPEEDS[a.speed] ? a.speed : 'normal'
  };
}
var __animApplied = '';
function applyAnim() {
  if (typeof document === 'undefined' || !DB) return;
  var a = animSetting();
  var key = a.effect + '|' + a.speed;
  if (key === __animApplied) return;
  __animApplied = key;
  document.body.setAttribute('data-anim', a.effect);
  document.body.setAttribute('data-anim-speed', a.speed);
  document.documentElement.style.setProperty('--anim-dur', ANIM_SPEEDS[a.speed].ms + 'ms');
}
/* پخش افکت فعلی روی یک عنصر (جعبه پیش‌نمایش تنظیمات) */
function playAnimOn(el) {
  if (!el) return;
  try { applyAnim(); } catch (e) {}
  el.classList.remove('animPlay');
  void el.offsetWidth;
  el.classList.add('animPlay');
}
function thumbColor(name) {
  var h = 0; name = String(name || '?');
  for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return 'hsl(' + h + ',45%,42%)';
}
function fileToDataUrl(file, maxSize, cb) {
  var reader = new FileReader();
  reader.onload = function () {
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      var cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(img.width * scale));
      cv.height = Math.max(1, Math.round(img.height * scale));
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = function () { toast('خواندن عکس ممکن نشد'); };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
function prodThumbHtml(p, sm) {
  if (p && p.img) return '<img src="' + p.img + '" class="thumb' + (sm ? ' sm' : '') + '" style="object-fit:cover" alt="">';
  return thumbHtml(p ? p.name : '؟', sm);
}
function thumbHtml(name, sm) {
  var c = String(name || '؟').trim().charAt(0) || '؟';
  return '<div class="thumb' + (sm ? ' sm' : '') + '" style="background:' + thumbColor(name) + '">' + esc(c) + '</div>';
}

/* ================= اکسل (SheetJS آفلاین) ================= */
function xlsxOk() { return typeof XLSX !== 'undefined'; }
function downloadXlsx(filename, sheets) {
  if (!xlsxOk()) { toast('کتابخانه اکسل لود نشده است'); return; }
  try {
    var wb = XLSX.utils.book_new();
    sheets.forEach(function (s) { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.aoa), s.name); });
    var b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    if (typeof Android !== 'undefined' && Android.saveBase64) {
      var r = Android.saveBase64(filename, b64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      toast(r ? 'فایل اکسل در دانلودها/iHesab ذخیره شد' : 'ذخیره فایل ممکن نشد');
    } else {
      var bin = atob(b64), arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = filename; a.click();
      toast('فایل اکسل دانلود شد');
    }
  } catch (e) { toast('ساخت فایل اکسل ممکن نشد'); }
}
function exportProductsXlsx() {
  var aoa = [['نام کالا', 'کد', 'بارکد', 'بارکدهای دیگر', 'دسته‌بندی', 'قیمت خرید', 'قیمت فروش', 'قیمت عمده', 'واحد', 'حداقل موجودی', 'موجودی فعلی', 'توضیحات']];
  DB.products.forEach(function (p) {
    var bars = allBarcodes(p);
    aoa.push([p.name, p.code || '', bars[0] || '', bars.slice(1).join(','), catName(p.catId), nd(p.buyPrice), nd(p.sellPrice), nd(p.wsPrice), p.unit || 'عدد', nd(p.minStock), p._stock, p.note || '']);
  });
  downloadXlsx('ihesab-products-' + todayISO() + '.xlsx', [{ name: 'کالاها', aoa: aoa }]);
}
function exportInvoicesXlsx() {
  var aoa = [['شماره', 'نوع', 'تاریخ', 'طرف حساب', 'جمع کل', 'پرداخت‌شده', 'مانده', 'وضعیت']];
  DB.invoices.slice().sort(function (a, b) { return a.no - b.no; }).forEach(function (inv) {
    var per = personById(inv.personId);
    aoa.push([inv.no, KIND_LABEL[inv.kind], fd(inv.date), per ? per.name : '', invoiceTotal(inv), invoicePaid(inv), invoiceRemain(inv), inv.status === 'void' ? 'باطل' : 'ثبت‌شده']);
  });
  downloadXlsx('ihesab-invoices-' + todayISO() + '.xlsx', [{ name: 'فاکتورها', aoa: aoa }]);
}
function exportPersonsXlsx() {
  var aoa = [['نام', 'نوع', 'تلفن', 'آدرس', 'مانده (مثبت=بدهکار)', 'سقف اعتبار', 'توضیحات']];
  DB.persons.forEach(function (p) {
    aoa.push([p.name, KIND_PERSON[p.kind] || p.kind, p.phone || '', p.address || '', personBalance(p.id), nd(p.creditLimit), p.note || '']);
  });
  downloadXlsx('ihesab-persons-' + todayISO() + '.xlsx', [{ name: 'اشخاص', aoa: aoa }]);
}
function exportPnLXlsx() {
  var mr = monthRange(0);
  var rev = netRevenue(mr.from, mr.to), cogs = cogsSum(mr.from, mr.to), gross = rev - cogs;
  var exps = expenseSum(mr.from, mr.to), net = gross - exps;
  var aoa = [['شرح', 'مبلغ (' + DB.settings.currency + ')'],
    ['درآمد فروش', rev], ['بهای تمام‌شده', cogs], ['سود ناخالص', gross], ['هزینه‌های عملیاتی', exps], ['سود خالص', net]];
  downloadXlsx('ihesab-pnl-' + todayISO() + '.xlsx', [{ name: 'سود و زیان', aoa: aoa }]);
}
function exportTemplateXlsx() {
  var aoa = [['نام کالا', 'کد', 'بارکد', 'دسته‌بندی', 'قیمت خرید', 'قیمت فروش', 'قیمت عمده', 'واحد', 'حداقل موجودی', 'موجودی اولیه'],
    ['روغن سرخ‌کردنی ۱ لیتری', '1001', '6260100100001', 'مواد غذایی', 95000, 125000, 115000, 'عدد', 5, 24],
    ['برنج ایرانی ۱۰ کیلویی', '1002', '', 'مواد غذایی', 780000, 950000, 900000, 'بسته', 2, 10]];
  downloadXlsx('ihesab-products-template.xlsx', [{ name: 'کالاها', aoa: aoa }]);
}
var XL_HEAD = {
  name: ['نام کالا', 'نام', 'name'], code: ['کد', 'کد کالا', 'code'], barcode: ['بارکد', 'barcode'],
  cat: ['دسته‌بندی', 'دسته', 'category'], buy: ['قیمت خرید', 'buyprice'], sell: ['قیمت فروش', 'sellprice'],
  ws: ['قیمت عمده', 'wholesale'], unit: ['واحد', 'unit'], min: ['حداقل موجودی', 'minstock'], stock: ['موجودی اولیه', 'موجودی', 'stock']
};
function xlNorm(s) { return String(s || '').replace(/[\s‌_]/g, '').toLowerCase(); }
function importProductsFile(file) {
  if (!xlsxOk()) { toast('کتابخانه اکسل لود نشده است'); return; }
  var rd = new FileReader();
  rd.onload = function () {
    try {
      var wb = XLSX.read(new Uint8Array(rd.result), { type: 'array' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (!rows.length) { toast('فایل خالی است'); return; }
      var head = rows[0].map(xlNorm), col = {};
      Object.keys(XL_HEAD).forEach(function (k) {
        col[k] = -1;
        XL_HEAD[k].forEach(function (cand) { var i = head.indexOf(xlNorm(cand)); if (i >= 0 && col[k] < 0) col[k] = i; });
      });
      if (col.name < 0) { toast('ستون «نام کالا» در فایل پیدا نشد'); return; }
      var items = [], skipped = 0;
      for (var r = 1; r < rows.length; r++) {
        var row = rows[r], nm = String(col.name >= 0 ? row[col.name] : '').trim();
        if (!nm) { skipped++; continue; }
        function gv(k) { return col[k] >= 0 ? row[col[k]] : ''; }
        items.push({
          name: nm, code: String(gv('code') || ''), barcode: String(gv('barcode') || ''),
          catName: String(gv('cat') || ''), buy: nd(gv('buy')) || 0, sell: nd(gv('sell')) || 0,
          ws: nd(gv('ws')) || 0, unit: String(gv('unit') || 'عدد') || 'عدد',
          min: nd(gv('min')) || 0, stock: nd(gv('stock')) || 0
        });
      }
      if (!items.length) { toast('کالای معتبری در فایل نیست'); return; }
      uiConfirm(fn(items.length) + ' کالا خوانده شد' + (skipped ? ' (' + fn(skipped) + ' ردیف خالی رد شد)' : '') + '. وارد شوند؟ دسته‌های جدید هم ساخته می‌شوند و موجودی اولیه ثبت می‌شود.').then(function (ok) {
        if (!ok) return;
        var t = todayISO();
        items.forEach(function (it) {
          var catId = '';
          if (it.catName) {
            var c = DB.categories.filter(function (x) { return x.name === it.catName; })[0];
            if (!c) { c = { id: newId('cat'), name: it.catName, parentId: '' }; DB.categories.push(c); }
            catId = c.id;
          }
          var np = { id: newId('prd'), name: it.name, code: it.code, barcode: it.barcode, barcodes: it.barcode ? [it.barcode] : [], img: '',
            catId: catId, buyPrice: it.buy, sellPrice: it.sell, wsPrice: it.ws, stock: 0, minStock: it.min, unit: it.unit, note: '', avgCost: it.buy };
          DB.products.push(np);
          if (it.stock > 0) DB.stockOps.push({ id: newId('so'), pid: np.id, date: t, seq: DB.seq++, kind: 'in', qty: it.stock, cost: it.buy, note: 'موجودی اولیه (ورود از اکسل)', whId: defWh() });
        });
        recompute(); saveDB(); refresh();
        toast(fn(items.length) + ' کالا وارد شد');
      });
    } catch (e) { toast('خواندن فایل اکسل ممکن نشد'); }
  };
  rd.readAsArrayBuffer(file);
}

/* ================= پشتیبان‌گیری خودکار ================= */
function maybeAutoBackup() {
  try {
    if (typeof Android === 'undefined' || !Android.autoBackupSave) return;
    if (!DB.products.length && !DB.invoices.length) return;
    if (Date.now() - (DB.settings.lastAutoBackup || 0) < 20 * 3600 * 1000) return;
    var r = Android.autoBackupSave(JSON.stringify(DB), todayISO());
    if (r) {
      DB.settings.lastAutoBackup = Date.now();
      DB.settings.lastBackup = Date.now();
      saveDB();
    }
  } catch (e) {}
}

/* ================= سود به تفکیک مشتری و گروه کالا ================= */
function invoiceItemsNet(inv) { return invoiceItemsTotal(inv) - nd(inv.gdisc); }
function profitByPerson(from, to) {
  var m = {};
  DB.invoices.forEach(function (inv) {
    if (inv.status !== 'final' || (inv.kind !== 'sale' && inv.kind !== 'sale_ret')) return;
    if (inv.date < from || inv.date > to) return;
    var per = personById(inv.personId);
    var key = inv.personId || '__none', s = inv.kind === 'sale' ? 1 : -1, net = invoiceItemsNet(inv);
    if (!m[key]) m[key] = { name: per ? per.name : 'بدون طرف حساب', rev: 0, profit: 0 };
    m[key].rev += s * net;
    m[key].profit += s * net - nd(inv.cogs);
  });
  return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.profit - a.profit; });
}
function profitByCategory(from, to) {
  var m = {};
  DB.invoices.forEach(function (inv) {
    if (inv.status !== 'final' || (inv.kind !== 'sale' && inv.kind !== 'sale_ret')) return;
    if (inv.date < from || inv.date > to) return;
    var s = inv.kind === 'sale' ? 1 : -1;
    inv.items.forEach(function (it) {
      var p = prodById(it.pid);
      var key = p ? (catName(p.catId) || 'بدون دسته') : 'کالای حذف‌شده';
      if (!m[key]) m[key] = { name: key, rev: 0, profit: 0 };
      m[key].rev += s * lineTotal(it);
      m[key].profit += s * (lineTotal(it) - nd(it.cogs));
    });
  });
  return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.profit - a.profit; });
}

/* ================= شمارش انیمیشنی اعداد داشبورد ================= */
function countUps() {
  if (typeof document === 'undefined' || !DB || DB.settings.hideAmts) return;
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    $$('#view .cntUp').forEach(function (el) {
      var to = nd(el.dataset.v);
      if (!to || typeof requestAnimationFrame === 'undefined') return;
      var dur = 650, t0 = null;
      function frame(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = fm(Math.round(to * e));
        if (p < 1) requestAnimationFrame(frame);
        else el.textContent = fm(to);
      }
      requestAnimationFrame(frame);
    });
  } catch (e) {}
}

/* ================= انبارگردانی ================= */
var takeWh = '', takeCounts = {}, takeQ = '';
function stockTakeHtml() {
  var wh = takeWh || defWh();
  var list = DB.products.filter(function (p) {
    return !takeQ || normFa(p.name).indexOf(normFa(takeQ)) >= 0;
  });
  var h = '<div class="card"><h3>🧮 انبارگردانی</h3>' +
    '<p class="mut small">موجودی واقعی هر کالا را بشمارید و وارد کنید؛ خانه‌های خالی دست نمی‌خورند. با اسکن بارکد هم می‌توانید بشمارید. در پایان، اختلاف‌ها با «اصلاح موجودی» ثبت می‌شوند.</p>' +
    '<div class="row"><select id="takeWhSel" style="flex:1;padding:9px;border:1px solid var(--line);border-radius:9px">' +
    DB.warehouses.map(function (w) { return '<option value="' + w.id + '"' + (w.id === wh ? ' selected' : '') + '>' + esc(w.name) + '</option>'; }).join('') + '</select>' +
    '<button class="btn gray" id="takeScan">📷 اسکن</button></div>' +
    '<div class="row" style="align-items:center;margin-top:8px"><input class="searchBox grow" style="margin-bottom:0" id="takeSearch" placeholder="جست‌وجوی کالا…" value="' + esc(takeQ) + '"><button class="btn gray sm" type="button" data-voice-field="takeSearch" title="جست‌وجوی صوتی">🎤</button></div></div>';
  if (!list.length) h += '<div class="empty">کالایی نیست.</div>';
  h += list.map(function (p) {
    var sys = whStock(p, wh);
    var cnt = takeCounts[p.id];
    return '<div class="listItem"><div class="main"><div class="t">' + esc(p.name) + '</div>' +
      '<div class="s">موجودی سیستم: ' + fn(sys) + ' ' + esc(p.unit || '') + '</div></div>' +
      '<input data-take="' + p.id + '" inputmode="decimal" placeholder="' + faNum(sys) + '" value="' + (cnt === undefined ? '' : faNum(cnt)) + '" style="width:92px;padding:9px;border:1px solid var(--line);border-radius:9px;text-align:center"></div>';
  }).join('');
  var entered = Object.keys(takeCounts).length;
  h += '<button class="btn block" id="takeApply" style="margin-top:12px">ثبت انبارگردانی (' + fn(entered) + ' قلم شمرده‌شده)</button>';
  return h;
}
function wireStockTake() {
  $$('#view .tabs [data-t]').forEach(function (b) { b.onclick = function () { stockTab = b.dataset.t; renderStock(); }; });
  var ws = $('#takeWhSel'); if (ws) ws.onchange = function () { takeWh = this.value; takeCounts = {}; renderStock(); };
  var sq = $('#takeSearch'); if (sq) sq.oninput = function () { takeQ = this.value; var pos = this.selectionStart; renderStock(); var nq = $('#takeSearch'); if (nq) { nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (e) {} } };
  $$('#view [data-take]').forEach(function (inp) {
    inp.oninput = function () {
      var v = inp.value.trim();
      if (v === '') delete takeCounts[inp.dataset.take];
      else takeCounts[inp.dataset.take] = nd(v);
    };
    inp.onchange = function () { renderStock(); };
  });
  var sc = $('#takeScan');
  if (sc) sc.onclick = function () {
    Scanner.open({
      title: 'اسکن برای شمارش', continuous: true, mode: 'lookup',
      onCode: function (code, ctl) {
        var p = productByBarcode(code);
        if (!p) { ctl.note('کالایی با این بارکد نیست', 'err'); return; }
        var cur = takeCounts[p.id];
        takeCounts[p.id] = (cur === undefined ? 0 : nd(cur)) + 1;
        ctl.note('➕ ' + p.name + ': ' + fn(takeCounts[p.id]), 'ok');
      },
      onClose: function () { takeQ = ''; renderStock(); }
    });
  };
  var ap = $('#takeApply');
  if (ap) ap.onclick = function () {
    var wh = takeWh || defWh();
    var diffs = [];
    Object.keys(takeCounts).forEach(function (pid) {
      var p = prodById(pid); if (!p) return;
      var sys = whStock(p, wh), cnt = nd(takeCounts[pid]);
      if (cnt !== sys) diffs.push({ p: p, sys: sys, cnt: cnt, d: cnt - sys });
    });
    if (!Object.keys(takeCounts).length) { toast('هنوز چیزی نشمرده‌اید'); return; }
    if (!diffs.length) { toast('✅ اختلافی نیست؛ موجودی‌ها درست‌اند'); takeCounts = {}; renderStock(); return; }
    var totVal = diffs.reduce(function (s, x) { return s + x.d * (x.p._avg || 0); }, 0);
    openModal('نتیجه انبارگردانی · ' + whName(wh),
      diffs.map(function (x) {
        return '<div class="row" style="padding:5px 0"><span class="grow">' + esc(x.p.name) + '<br><span class="mut small">سیستم ' + fn(x.sys) + ' ← شمارش ' + fn(x.cnt) + '</span></span><span class="chip ' + (x.d > 0 ? 'green' : 'red') + '">' + (x.d > 0 ? '+' : '') + fn(x.d) + '</span></div>';
      }).join('') +
      '<div class="row" style="padding-top:8px"><span class="grow"><b>ارزش خالص اختلاف</b></span><b>' + fm(Math.round(totVal)) + '</b></div>',
      [
        { label: 'ثبت اصلاح موجودی', cb: function (close) {
            diffs.forEach(function (x) {
              DB.stockOps.push({ id: newId('so'), pid: x.p.id, date: todayISO(), seq: DB.seq++, kind: 'adjust', qty: x.cnt, cost: x.p._avg || 0, note: 'انبارگردانی', whId: wh, expiry: '', batch: '' });
            });
            audit('انبارگردانی ' + whName(wh) + ': ' + fn(diffs.length) + ' اختلاف ثبت شد');
            takeCounts = {}; recompute(); saveDB(); close(); renderStock(); toast('انبارگردانی ثبت شد');
          } },
        { label: 'انصراف', cls: 'gray', cb: function (close) { close(); } }
      ]);
  };
}

/* ================= باشگاه مشتریان ================= */
function clubPoints(pid) {
  var per = Math.max(1, nd(DB.settings.clubToman) || 10000), pts = 0;
  DB.invoices.forEach(function (inv) {
    if (inv.personId !== pid || inv.status === 'void') return;
    if (inv.kind === 'sale') pts += Math.floor(invoiceTotal(inv) / per);
    else if (inv.kind === 'sale_ret') pts -= Math.floor(invoiceTotal(inv) / per);
  });
  return Math.max(0, pts);
}
function clubLevel(pts) {
  if (pts >= 300) return { name: 'طلایی', ic: '🥇', next: 0 };
  if (pts >= 100) return { name: 'نقره‌ای', ic: '🥈', next: 300 - pts };
  return { name: 'برنزی', ic: '🥉', next: 100 - pts };
}

/* ================= مغایرت‌گیری بانکی ================= */
var reconAcc = '', reconResult = null;
function accountLedger(accId) {
  var out = [];
  DB.invoices.forEach(function (inv) {
    if (inv.status === 'void') return;
    (inv.paidBy || []).forEach(function (pb, ix) {
      if (pb.accId !== accId || !nd(pb.amount)) return;
      var into = (inv.kind === 'sale' || inv.kind === 'purchase_ret');
      out.push({ key: 'ip:' + inv.id + ':' + ix, date: inv.date, amount: into ? nd(pb.amount) : -nd(pb.amount), label: KIND_LABEL[inv.kind] + ' ' + (inv.no || '') });
    });
  });
  DB.payments.forEach(function (p) {
    if (p.accId !== accId) return;
    out.push({ key: 'pay:' + p.id, date: p.date, amount: p.dir === 'receive' ? nd(p.amount) : -nd(p.amount), label: p.dir === 'receive' ? 'دریافت وجه' : 'پرداخت وجه' });
  });
  DB.expenses.forEach(function (e) {
    if (e.accId === accId) out.push({ key: 'exp:' + e.id, date: e.date, amount: -nd(e.amount), label: 'هزینه' });
  });
  DB.incomes.forEach(function (e) {
    if (e.accId === accId) out.push({ key: 'inc:' + e.id, date: e.date, amount: nd(e.amount), label: 'درآمد' });
  });
  DB.transfers.forEach(function (t) {
    if (t.fromId === accId) out.push({ key: 'trf:' + t.id, date: t.date, amount: -nd(t.amount), label: 'انتقال خروجی' });
    if (t.toId === accId) out.push({ key: 'trt:' + t.id, date: t.date, amount: nd(t.amount), label: 'انتقال ورودی' });
  });
  return out;
}
function parseFaDateStr(s) {
  if (!s) return '';
  if (s instanceof Date && !isNaN(s)) return s.toISOString().slice(0, 10);
  var str = String(s).replace(/[۰-۹]/g, function (c) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(c); }).replace(/[٠-٩]/g, function (c) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(c); });
  var m = str.match(/(\d{3,4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (!m) return '';
  var y = +m[1], mo = +m[2], d = +m[3];
  if (y > 1500) return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  try {
    var g = d2g(j2d(y, mo, d));
    return g.gy + '-' + String(g.gm).padStart(2, '0') + '-' + String(g.gd).padStart(2, '0');
  } catch (e) { return ''; }
}
function statementRows(aoa) {
  var hdr = -1, cAmt = -1, cDeb = -1, cCred = -1, cDate = -1, cDesc = -1;
  for (var r = 0; r < Math.min(6, aoa.length); r++) {
    (aoa[r] || []).forEach(function (c, ix) {
      var t = String(c == null ? '' : c);
      if (/مبلغ/.test(t) && cAmt < 0 && !/مانده/.test(t)) cAmt = ix;
      if (/بدهکار|برداشت/.test(t)) cDeb = ix;
      if (/بستانکار|واریز/.test(t)) cCred = ix;
      if (/تاریخ/.test(t)) cDate = ix;
      if (/شرح|توضیح/.test(t)) cDesc = ix;
    });
    if (cAmt >= 0 || (cDeb >= 0 && cCred >= 0)) { hdr = r; break; }
  }
  var start = hdr >= 0 ? hdr + 1 : 0;
  if (cAmt < 0 && cDeb < 0 && cCred < 0) {
    /* بدون سرفصل: عددی‌ترین ستون = مبلغ، اولین ستون تاریخ‌دار = تاریخ */
    var counts = {};
    aoa.forEach(function (row) { (row || []).forEach(function (c, ix) { if (c !== '' && c != null && !isNaN(nd(String(c).replace(/[٬,]/g, '')))) counts[ix] = (counts[ix] || 0) + 1; }); });
    var best = -1, bn = 0;
    Object.keys(counts).forEach(function (k) { if (counts[k] > bn) { bn = counts[k]; best = +k; } });
    cAmt = best;
    for (var r2 = start; r2 < aoa.length && cDate < 0; r2++) (aoa[r2] || []).forEach(function (c, ix) { if (cDate < 0 && parseFaDateStr(c)) cDate = ix; });
  }
  var rows = [];
  for (var i = start; i < aoa.length; i++) {
    var row = aoa[i] || [], amt = 0;
    if (cDeb >= 0 || cCred >= 0) amt = (cCred >= 0 ? nd(String(row[cCred] == null ? '' : row[cCred]).replace(/[٬,]/g, '')) : 0) - (cDeb >= 0 ? nd(String(row[cDeb] == null ? '' : row[cDeb]).replace(/[٬,]/g, '')) : 0);
    else if (cAmt >= 0) amt = nd(String(row[cAmt] == null ? '' : row[cAmt]).replace(/[٬,]/g, ''));
    if (!amt) continue;
    rows.push({ date: cDate >= 0 ? parseFaDateStr(row[cDate]) : '', amount: amt, desc: cDesc >= 0 ? String(row[cDesc] || '') : '' });
  }
  return rows;
}
function matchRecon(accId, rows) {
  var done = {};
  (DB.recon || []).forEach(function (k) { done[k] = 1; });
  var ledger = accountLedger(accId).filter(function (e) { return !done[e.key]; });
  var used = {}, matchedKeys = [], unmatchedRows = [];
  rows.forEach(function (r) {
    var found = null;
    ledger.forEach(function (e) {
      if (found || used[e.key] || e.amount !== r.amount) return;
      if (r.date && e.date) {
        var dd = Math.abs((new Date(r.date) - new Date(e.date)) / 86400000);
        if (dd > 4) return;
      }
      found = e;
    });
    if (found) { used[found.key] = 1; matchedKeys.push(found.key); }
    else unmatchedRows.push(r);
  });
  var unmatchedLedger = ledger.filter(function (e) { return !used[e.key]; });
  return { matchedKeys: matchedKeys, unmatchedRows: unmatchedRows, unmatchedLedger: unmatchedLedger, totalRows: rows.length };
}
function reconHtml() {
  var banks = DB.accounts;
  var h = '<div class="card"><h3>🏦 مغایرت‌گیری بانکی</h3>' +
    '<p class="mut small">صورت‌حساب بانک را از اینترنت‌بانک به‌صورت اکسل (xlsx/csv) بگیرید و اینجا بارگذاری کنید؛ برنامه تراکنش‌ها را با دفتر حساب تطبیق می‌دهد. ستون‌های «تاریخ»، «مبلغ» یا «بدهکار/بستانکار» و «شرح» کافی است.</p>' +
    fRow('حساب', '<select id="rcAcc">' + banks.map(function (a) { return '<option value="' + a.id + '"' + (reconAcc === a.id ? ' selected' : '') + '>' + esc(a.name) + ' — ' + fm(accountBalance(a.id)) + '</option>'; }).join('') + '</select>') +
    '<button class="btn block" id="rcPick">📥 بارگذاری صورت‌حساب (اکسل/CSV)</button>' +
    '<input type="file" id="rcFile" accept=".xlsx,.xls,.csv" style="display:none">' +
    '<div id="reconOut" style="margin-top:12px"></div></div>';
  return h;
}
function wireRecon() {
  var sel = $('#rcAcc'); if (sel) sel.onchange = function () { reconAcc = this.value; };
  reconAcc = reconAcc || (DB.accounts[0] || {}).id || '';
  var pick = $('#rcPick'), file = $('#rcFile');
  if (pick && file) pick.onclick = function () { file.click(); };
  if (file) file.onchange = function () {
    if (!file.files || !file.files[0]) return;
    readSheetFile(file.files[0], function (aoa) {
      var rows = statementRows(aoa);
      if (!rows.length) { toast('تراکنشی در فایل پیدا نشد'); return; }
      reconResult = matchRecon(reconAcc, rows);
      renderReconResult();
    });
  };
}
function renderReconResult() {
  var out = $('#reconOut'); if (!out || !reconResult) return;
  var r = reconResult;
  var h = '<div class="row"><span class="chip green">✅ ' + fn(r.matchedKeys.length) + ' تراکنش مطابق</span>' +
    '<span class="chip amber">' + fn(r.unmatchedRows.length) + ' قلم بانکیِ بی‌تطابق</span>' +
    '<span class="chip blue">' + fn(r.unmatchedLedger.length) + ' قلم دفتریِ بی‌تطابق</span></div>';
  if (r.matchedKeys.length) h += '<button class="btn block" id="rcSave" style="margin:10px 0">✔️ ثبت تطابق‌ها (دیگر نشان داده نشوند)</button>';
  if (r.unmatchedRows.length) {
    h += '<h3 style="margin:10px 0 6px">در بانک هست، در دفتر نیست:</h3>' + r.unmatchedRows.map(function (x, ix) {
      return '<div class="row" style="padding:5px 0"><span class="grow">' + (x.date ? fd(x.date) + ' · ' : '') + esc(x.desc || '—') + '<br><b class="' + (x.amount > 0 ? 'pos' : 'neg') + '">' + fm(x.amount) + '</b></span>' +
        '<button class="btn gray sm" data-rcadd="' + ix + '">' + (x.amount > 0 ? 'ثبت درآمد' : 'ثبت هزینه') + '</button></div>';
    }).join('');
  }
  if (r.unmatchedLedger.length) {
    h += '<h3 style="margin:10px 0 6px">در دفتر هست، در بانک نیست:</h3>' + r.unmatchedLedger.slice(0, 30).map(function (e) {
      return '<div class="row" style="padding:4px 0"><span class="grow">' + (e.date ? fd(e.date) + ' · ' : '') + esc(e.label) + '</span><b class="' + (e.amount > 0 ? 'pos' : 'neg') + '">' + fm(e.amount) + '</b></div>';
    }).join('');
  }
  out.innerHTML = h;
  var sv = $('#rcSave');
  if (sv) sv.onclick = function () {
    DB.recon = (DB.recon || []).concat(r.matchedKeys);
    saveDB(); toast('تطابق‌ها ثبت شد'); reconResult = null; out.innerHTML = '<p class="mut">✅ مغایرت‌گیری انجام شد.</p>';
  };
  $$('#reconOut [data-rcadd]').forEach(function (b) {
    b.onclick = function () {
      var x = r.unmatchedRows[+b.dataset.rcadd];
      var base = { id: newId(x.amount > 0 ? 'inc' : 'exp'), date: x.date || todayISO(), amount: Math.abs(x.amount), accId: reconAcc, note: 'از صورت‌حساب بانکی' + (x.desc ? ' · ' + x.desc : '') };
      if (x.amount > 0) { base.title = x.desc || 'واریز بانکی'; DB.incomes.push(base); }
      else { base.catId = (DB.expCats[DB.expCats.length - 1] || {}).id || ''; base.title = x.desc || 'برداشت بانکی'; DB.expenses.push(base); }
      recompute(); saveDB(); toast('ثبت شد');
      r.unmatchedRows.splice(+b.dataset.rcadd, 1);
      renderReconResult();
    };
  });
}

/* ================= بازیابی + رمزگذاری پشتیبان ================= */
function restoreFromData(data) {
  if (!data || !(data.v >= 2 && data.v <= 6) || !data.settings) { toast('فایل پشتیبان معتبر نیست'); return; }
  uiConfirm('بازیابی انجام شود؟ همه اطلاعات فعلی با فایل پشتیبان جایگزین می‌شود.').then(function (ok) {
    if (!ok) return;
    DB = data; migrateDB(); recompute(); saveDB();
    toast('بازیابی کامل شد'); show('dash');
  });
}
/* SHA-256 خالص (برای رمزگذاری آفلاین پشتیبان) */
function sha256Bytes(ascii) {
  function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  var bytes = [];
  for (var i = 0; i < ascii.length; i++) bytes.push(ascii.charCodeAt(i) & 0xff);
  var bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  bytes.push(0, 0, 0, 0);
  bytes.push((bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);
  var w = new Array(64);
  for (var b = 0; b < bytes.length; b += 64) {
    for (var t = 0; t < 16; t++) w[t] = (bytes[b + t * 4] << 24) | (bytes[b + t * 4 + 1] << 16) | (bytes[b + t * 4 + 2] << 8) | bytes[b + t * 4 + 3];
    for (t = 16; t < 64; t++) {
      var s0 = rr(w[t - 15], 7) ^ rr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      var s1 = rr(w[t - 2], 17) ^ rr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    var a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], hh = H[7];
    for (t = 0; t < 64; t++) {
      var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
      var ch = (e & f) ^ (~e & g);
      var t1 = (hh + S1 + ch + K[t] + w[t]) | 0;
      var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
      var mj = (a & bb) ^ (a & c) ^ (bb & c);
      var t2 = (S0 + mj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + hh) | 0;
  }
  var out = [];
  H.forEach(function (x) { out.push((x >>> 24) & 0xff, (x >>> 16) & 0xff, (x >>> 8) & 0xff, x & 0xff); });
  return out;
}
function utf8Bytes(str) {
  var u = unescape(encodeURIComponent(str)), out = [];
  for (var i = 0; i < u.length; i++) out.push(u.charCodeAt(i));
  return out;
}
function b64Enc(bytes) { return btoa(bytesToStr(bytes)); }
function b64Dec(b64) {
  var s = atob(b64), out = [];
  for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
  return out;
}
function bytesToStr(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.slice(i, i + 8192));
  return s;
}
function hmacSha(keyBytes, msgBytes) {
  var k = keyBytes.slice();
  if (k.length > 64) k = sha256Bytes(bytesToStr(k));
  while (k.length < 64) k.push(0);
  var ipad = k.map(function (b) { return b ^ 0x36; }), opad = k.map(function (b) { return b ^ 0x5c; });
  var inner = sha256Bytes(bytesToStr(ipad) + bytesToStr(msgBytes));
  return sha256Bytes(bytesToStr(opad) + bytesToStr(inner));
}
function backupKey(pass, saltBytes) {
  var key = utf8Bytes(pass).concat(saltBytes);
  for (var i = 0; i < 4000; i++) key = sha256Bytes(bytesToStr(key.concat(utf8Bytes(pass))));
  return key;
}
function xorStream(dataBytes, key, saltBytes) {
  var out = [], ctr = 0;
  for (var off = 0; off < dataBytes.length; off += 32) {
    var block = hmacSha(key, saltBytes.concat([ctr & 0xff, (ctr >> 8) & 0xff]));
    for (var j = 0; j < 32 && off + j < dataBytes.length; j++) out.push(dataBytes[off + j] ^ block[j]);
    ctr++;
  }
  return out;
}
function encBackup(plainText, pass) {
  var salt = [];
  for (var i = 0; i < 16; i++) salt.push(Math.floor(Math.random() * 256));
  var key = backupKey(pass, salt);
  var ct = xorStream(utf8Bytes(plainText), key, salt);
  var tag = hmacSha(key, sha256Bytes(bytesToStr(ct)));
  return { enc: 'ihesab1', salt: b64Enc(salt), data: b64Enc(ct), tag: b64Enc(tag) };
}
function decBackup(env, pass) {
  try {
    var salt = b64Dec(env.salt), ct = b64Dec(env.data), tag = b64Dec(env.tag);
    var key = backupKey(pass, salt);
    var myTag = hmacSha(key, sha256Bytes(bytesToStr(ct)));
    if (myTag.map(String).join() !== tag.map(String).join()) return null;
    var pt = xorStream(ct, key, salt);
    return decodeURIComponent(escape(bytesToStr(pt)));
  } catch (e) { return null; }
}

/* ================= فرمان صوتی هوشمند ================= */
var FA_NUMWORDS = { 'یک': 1, 'یه': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10, 'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15, 'شانزده': 16, 'هفده': 17, 'هجده': 18, 'نوزده': 19, 'بیست': 20, 'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70, 'هشتاد': 80, 'نود': 90, 'نیم': 0.5 };
var FA_HUND = { 'صد': 100, 'دویست': 200, 'سیصد': 300, 'چهارصد': 400, 'پانصد': 500, 'ششصد': 600, 'هفتصد': 700, 'هشتصد': 800, 'نهصد': 900 };
/* خواندن عدد از روی توکن‌ها با پشتیبانی «یک و نیم» → {v, used} */
function faNumAt(toks, i) {
  var t = toks[i];
  if (t === undefined) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return { v: nd(t), used: 1 };
  var base = FA_NUMWORDS[t] !== undefined ? FA_NUMWORDS[t] : FA_HUND[t];
  if (base === undefined) return null;
  if (toks[i + 1] === 'و' && (toks[i + 2] === 'نیم' || toks[i + 2] === 'ربع')) {
    return { v: base + (toks[i + 2] === 'نیم' ? 0.5 : 0.25), used: 3 };
  }
  return { v: base, used: 1 };
}
/* مبلغ گفتاری: «پانصد و بیست هزار تومان» ← ۵۲۰۰۰۰ */
function parseSpokenAmount(text) {
  var toks = normFa(text).split(/\s+/).filter(Boolean);
  var total = 0, seg = 0, found = false;
  function mult(m) { total += (seg || 1) * m; seg = 0; found = true; }
  toks.forEach(function (t) {
    if (/^\d/.test(t)) { seg += nd(t); found = true; return; }
    if (FA_NUMWORDS[t] !== undefined) { seg += FA_NUMWORDS[t]; found = true; return; }
    if (FA_HUND[t] !== undefined) { seg += FA_HUND[t]; found = true; return; }
    if (t === 'هزار') { mult(1000); return; }
    if (t === 'میلیون') { mult(1000000); return; }
    if (t === 'میلیارد') { mult(1000000000); return; }
    if (t === 'و') return;
    total += seg; seg = 0;
  });
  total += seg;
  return found ? total : 0;
}
function parseVoiceInvoice(text) {
  if (!D || !D.items) return [];
  var work = ' ' + normFa(text).replace(/[،,؛]/g, ' ') + ' ';
  var added = [];
  /* شخص: اول نام کامل در متن، بعد نام خانوادگی یکتا، بعد الگوی «برای/به اسم …» */
  var perHit = null;
  var sortedPer = DB.persons.slice().sort(function (a, b) { return normFa(b.name).length - normFa(a.name).length; });
  for (var pi = 0; pi < sortedPer.length && !perHit; pi++) {
    var pnm = normFa(sortedPer[pi].name);
    if (pnm && pnm.length >= 2 && work.indexOf(pnm) >= 0) { perHit = sortedPer[pi]; work = work.replace(pnm, ' '); }
  }
  if (!perHit) {
    var fp = findPersonInText(work);
    if (fp) {
      perHit = fp;
      var lp = normFa(fp.name).split(/\s+/).filter(Boolean).pop();
      if (lp) work = work.replace(lp, ' ');
    }
  }
  if (!perHit) {
    var pm = work.match(/\s(?:برای|به اسم|بنام|به نام)\s+(.+?)\s*$/);
    if (pm) {
      var pname2 = pm[1].trim();
      var per2 = DB.persons.filter(function (x) { return normFa(x.name).indexOf(pname2) >= 0 || pname2.indexOf(normFa(x.name)) >= 0; })[0];
      if (per2) { perHit = per2; work = work.slice(0, pm.index) + ' '; }
    }
  }
  if (perHit) {
    D.personId = perHit.id;
    try { var ps = $('#ivPer'); if (ps) ps.value = perHit.id; } catch (e) {}
  }
  var prods = DB.products.slice().sort(function (a, b) { return normFa(b.name).length - normFa(a.name).length; });
  prods.forEach(function (p) {
    var name = normFa(p.name);
    if (!name || name.length < 2) return;
    var idx = work.indexOf(name);
    if (idx < 0) return;
    var bToks = work.slice(0, idx).trim().split(/\s+/).filter(Boolean).slice(-6);
    var aToks = work.slice(idx + name.length).trim().split(/\s+/).filter(Boolean).slice(0, 4);
    var win = bToks.concat(aToks).join(' ');
    /* واحد گفته‌شده */
    var unit = 'base', unitLabel = '';
    if (p.packSize > 1 && (win.indexOf(' کارتن') >= 0 || win.indexOf(' بسته') >= 0 || (p.packName && win.indexOf(' ' + normFa(p.packName)) >= 0))) { unit = 'pack'; unitLabel = p.packName || 'بسته'; }
    else if (win.indexOf(' جین') >= 0) unit = 'dozen';
    else if (/ کیلو(گرم)? /.test(' ' + win + ' ')) unit = 'kg';
    else if (/ گرم /.test(' ' + win + ' ')) unit = 'g';
    /* تعداد: نزدیک‌ترین عدد — اول قبل از نام، بعد بعد از نام */
    var qty = null;
    for (var i = bToks.length - 1; i >= 0 && qty === null; i--) {
      if ((bToks[i] === 'نیم' || bToks[i] === 'ربع') && i >= 2 && bToks[i - 1] === 'و') {
        var rawBase = FA_NUMWORDS[bToks[i - 2]] !== undefined ? FA_NUMWORDS[bToks[i - 2]] : FA_HUND[bToks[i - 2]];
        if (rawBase !== undefined) { qty = rawBase + (bToks[i] === 'نیم' ? 0.5 : 0.25); break; }
      }
      var r = faNumAt(bToks, i);
      if (r) qty = r.v;
      else if (/^(تا|عدد|دونه|دانه|بسته|کارتن|جین|کیلو|کیلوگرم|گرم|واحد|از)$/.test(bToks[i])) continue;
      else break;
    }
    if (qty === null) {
      for (var j = 0; j < aToks.length; j++) {
        var r2 = faNumAt(aToks, j);
        if (r2) { qty = r2.v; break; }
        if (/^(تا|عدد|دونه|دانه|بسته|کارتن|جین|کیلو|کیلوگرم|گرم|واحد|از)$/.test(aToks[j])) continue;
        break;
      }
    }
    if (qty === null) qty = 1;
    /* تبدیل واحد به واحد پایه کالا */
    var baseQty = qty, dispUnit = 'base';
    if (unit === 'pack') { baseQty = qty * p.packSize; dispUnit = 'pack'; }
    else if (unit === 'dozen') baseQty = qty * 12;
    else if (unit === 'kg' && /گرم/.test(p.unit || '') && !/کیلو/.test(p.unit || '')) baseQty = qty * 1000;
    else if (unit === 'g' && /کیلو/.test(p.unit || '')) baseQty = qty / 1000;
    var price = (D.kind === 'purchase' || D.kind === 'purchase_ret') ? p.buyPrice : p.sellPrice;
    if (dispUnit === 'pack') {
      var exP = D.items.filter(function (it) { return it.pid === p.id && it.unit === 'pack'; })[0];
      if (exP) exP.qty = nd(exP.qty) + qty * p.packSize;
      else D.items.push({ pid: p.id, name: p.name, qty: qty * p.packSize, price: price, disc: 0, unit: 'pack' });
    } else {
      var ex = D.items.filter(function (it) { return it.pid === p.id && it.unit !== 'pack'; })[0];
      if (ex) ex.qty = nd(ex.qty) + baseQty;
      else D.items.push({ pid: p.id, name: p.name, qty: baseQty, price: price, disc: 0 });
    }
    added.push(fn(qty) + ' ' + (unitLabel || (unit === 'dozen' ? 'جین' : unit === 'kg' ? 'کیلو' : unit === 'g' ? 'گرم' : '')) + ' ' + p.name);
    work = work.slice(0, idx) + ' ' + work.slice(idx + name.length);
  });
  try { renderIvItems(); renderIvTotals(); } catch (e) {}
  try {
    if (added.length) toast('🎤 اضافه شد: ' + added.join('، '));
    else toast('کالایی از صحبت‌تان پیدا نشد: «' + String(text).slice(0, 60) + '»');
  } catch (e) {}
  return added;
}
/* مسیریاب فرمان صوتی سراسری */
function findPersonInText(t) {
  var persons = DB.persons.slice().sort(function (a, b) { return normFa(b.name).length - normFa(a.name).length; });
  for (var i = 0; i < persons.length; i++) {
    var nm = normFa(persons[i].name);
    if (nm && nm.length >= 2 && t.indexOf(nm) >= 0) return persons[i];
  }
  /* تطبیق تقریبی: فقط نام خانوادگی (آخرین بخش اسم) اگر یکتا باشد */
  for (var j = 0; j < persons.length; j++) {
    var parts = normFa(persons[j].name).split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue;
    var last = parts[parts.length - 1];
    if (last.length < 3) continue;
    if (t.indexOf(last) < 0) continue;
    var dup = persons.some(function (x) { return x.id !== persons[j].id && normFa(x.name).split(/\s+/).pop() === last; });
    if (!dup) return persons[j];
  }
  return null;
}
function voiceCommand(rawText) {
  var t = normFa(rawText);
  var NAV = [
    [/حسابداری|دفتر کل|تراز آزمایشی|ترازنامه/, 'ledger'], [/گزارش/, 'reports'], [/انبارگردان/, 'stock'], [/انبار/, 'stock'], [/چک|سررسید/, 'cheques'],
    [/بدهی|بدهکار|طلبکار|طلب‌ها/, 'persons'],
    [/مالی|حساب‌ها|حساب ها/, 'finance'], [/مشتری|اشخاص|شخص‌ها/, 'persons'], [/کالا/, 'products'],
    [/خرید/, 'buy'], [/فروش/, 'sale'], [/تنظیم/, 'settings'], [/پشتیبان/, 'backup'],
    [/جستجو|جست‌وجو/, 'search'], [/دستیار|حسابیار/, 'assistant'], [/خانه|داشبورد|اصلی/, 'dash'], [/کاربر/, 'users']
  ];
  /* ۱) ساخت فاکتور با شخص و اقلام: «فاکتور خرید به اسم فلانی بزن شامل سه کارتن نوشابه» */
  if (/فاکتور/.test(t)) {
    var kind = /خرید/.test(t) ? 'purchase' : 'sale';
    openInvoiceEditor(kind);
    var rest = t.replace(/فاکتور/g, ' ').replace(/خرید/g, ' ').replace(/فروش/g, ' ')
      .replace(/جدید/g, ' ').replace(/بزن|بساز|ایجاد کن|ثبت کن/g, ' ').replace(/شامل|حاوی/g, ' ');
    var added = parseVoiceInvoice(rest);
    try {
      toast('🤖 حسابیار: فاکتور ' + (kind === 'purchase' ? 'خرید' : 'فروش') + ' آماده شد' +
        (added && added.length ? ' — ' + added.join('، ') : '') + '؛ بررسی و ثبتش کنید');
    } catch (e) {}
    return 'invoice-make';
  }
  /* ۲) دریافت/پرداخت از شخص: «از آقای محمدی پانصد هزار بگیر» */
  var isRecv = /(دریافت|بگیر|وصول)/.test(t);
  var isPay = !isRecv && /(پرداخت|بده|تسویه)/.test(t);
  if (isRecv || isPay) {
    var vper = findPersonInText(t);
    var vamt = parseSpokenAmount(t);
    if (vper && vamt > 0) {
      paymentEditor(null, { dir: isRecv ? 'receive' : 'pay', personId: vper.id, amount: vamt, note: 'فرمان صوتی حسابیار' });
      try { toast('🤖 حسابیار: فرم ' + (isRecv ? 'دریافت از' : 'پرداخت به') + ' «' + vper.name + '» آماده شد؛ بررسی و ثبت کنید'); } catch (e) {}
      return 'payment';
    }
  }
  /* ۳) ساخت موجودیت تازه */
  if (/کالا|محصول/.test(t) && /جدید|اضافه|ثبت|بساز/.test(t)) { productEditor(); try { toast('🤖 حسابیار: فرم کالای جدید باز شد'); } catch (e) {} return 'product-new'; }
  if (/مشتری|شخص/.test(t) && /جدید|اضافه|ثبت|بساز/.test(t)) { personEditor(); try { toast('🤖 حسابیار: فرم شخص جدید باز شد'); } catch (e) {} return 'person-new'; }
  if (/چک/.test(t) && /جدید|اضافه|ثبت|بساز/.test(t)) { chequeEditor(null); try { toast('🤖 حسابیار: فرم چک جدید باز شد'); } catch (e) {} return 'cheque-new'; }
  /* ۴) جست‌وجوی مستقیم */
  if (/جستجو|جست‌وجو|بگرد/.test(t)) {
    var q = t.replace(/.*(جستجو|جست‌وجو|بگرد)/, '').replace(/کن|بکن/g, '').trim();
    IS.q = q; IS.ran = true; IS.kind = ''; IS.status = '';
    show('search');
    return 'search';
  }
  var em = t.match(/هزینه\s+(.+)/);
  if (em || /^هزینه/.test(t)) {
    var rest = em ? em[1] : t.replace(/هزینه/, '').trim();
    var amt = parseSpokenAmount(rest);
    if (amt > 0) {
      var title = rest.replace(/[\d۰-۹٠-٩]+/g, ' ').replace(/هزار|میلیون|میلیارد|تومان|ریال|و\s/g, ' ').trim() || 'هزینه';
      var cat = DB.expCats.filter(function (c) { return title.indexOf(c.name) >= 0; })[0] ||
        DB.expCats.filter(function (c) { return c.name === 'سایر'; })[0] || DB.expCats[DB.expCats.length - 1];
      var acc = DB.accounts.filter(function (a) { return a.type === 'cash'; })[0] || DB.accounts[0];
      DB.expenses.push({ id: newId('exp'), catId: cat ? cat.id : '', amount: amt, date: todayISO(), accId: acc ? acc.id : '', note: title });
      audit('هزینه با فرمان صوتی', fm(amt));
      saveDB();
      toast('🎤 هزینه «' + title + '» به مبلغ ' + fm(amt) + ' ثبت شد');
      show('finance');
      return 'expense';
    }
  }
  for (var i = 0; i < NAV.length; i++) {
    if (NAV[i][0].test(t)) { show(NAV[i][1]); toast('🎤 ' + rawText); return NAV[i][1]; }
  }
  /* بقیه: پرسش از دستیار هوشمند */
  show('assistant');
  var a = askAssistant(rawText);
  chatLog.unshift({ q: rawText, a: a });
  if (chatLog.length > 20) chatLog.pop();
  renderAssistant();
  return 'assistant';
}
function startVoice(target) {
  if (typeof window !== 'undefined') window.__voiceTarget = target;
  try {
    if (typeof Android === 'undefined' || !Android.startVoiceInput) { toast('تشخیص صدا روی این دستگاه در دسترس نیست'); return; }
    if (Android.isVoiceAvailable && !Android.isVoiceAvailable()) { toast('سرویس تشخیص صدای فارسی روی گوشی فعال نیست'); return; }
    toast('🎤 حسابیار گوش می‌ده… دستور یا سؤالتان را بگویید');
    Android.startVoiceInput();
  } catch (e) { toast('خطا در میکروفون'); }
}
function __voiceResultFn(text, ok) {
  if (!ok || !text) { try { toast('صدایی تشخیص داده نشد؛ دوباره تلاش کنید'); } catch (e) {} return; }
  var target = (typeof window !== 'undefined' && window.__voiceTarget) || 'global';
  try {
    if (target === 'invoice') parseVoiceInvoice(text);
    else if (target.indexOf('field:') === 0) {
      var el = document.getElementById(target.slice(6));
      if (el) {
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else voiceCommand(text);
  } catch (e) { try { toast('خطای فرمان صوتی'); } catch (e2) {} }
}
if (typeof window !== 'undefined') window.__voiceResult = __voiceResultFn;

/* ================= اسکن فاکتور خرید (OCR داخلی) ================= */
function ocrNumbers(line) {
  var norm = String(line).replace(/[۰-۹]/g, function (c) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(c); })
    .replace(/[٠-٩]/g, function (c) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(c); })
    .replace(/[٬،]/g, '');
  var out = [];
  var re = /\d+(?:\.\d+)?/g, m;
  while ((m = re.exec(norm))) out.push({ v: nd(m[0]), at: m.index, len: m[0].length });
  return { norm: norm, nums: out };
}
function ocrParseLines(lines) {
  var items = [];
  lines.forEach(function (line) {
    var t = String(line || '').trim();
    if (t.length < 3) return;
    if (/جمع|مبلغ کل|مالیات|ارزش افزوده|قابل پرداخت|تخفیف|کرایه|تلفن|نشانی|صورتحساب|فاکتور فروش|ردیف/.test(t) && !/^(کالا|قلم)/.test(t)) return;
    var r = ocrNumbers(t);
    if (!r.nums.length) return;
    var name = r.norm.replace(/\d+(?:\.\d+)?/g, ' ').replace(/[|×*xX:؛;«»()\-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (name.length < 2) return;
    var qty = 1, price = 0;
    var vs = r.nums.map(function (x) { return x.v; }).filter(function (x) { return x > 0; });
    if (!vs.length) return;
    if (vs.length >= 3) {
      var a = vs[0], b = vs[1], c = vs[vs.length - 1];
      if (Math.abs(a * b - c) <= Math.max(50, c * 0.06)) { qty = a; price = b; }
      else if (Math.abs(b * a - c) <= Math.max(50, c * 0.06)) { qty = b; price = a; }
      else { qty = a; price = c; }
    } else if (vs.length === 2) {
      if (vs[0] <= 1000 && vs[1] > vs[0]) { qty = vs[0]; price = vs[1]; }
      else price = vs[vs.length - 1];
    } else price = vs[0];
    if (price <= 0) return;
    var matched = null;
    DB.products.forEach(function (p) { if (!matched && normFa(p.name) === normFa(name)) matched = p; });
    if (!matched) DB.products.forEach(function (p) { if (!matched && (normFa(name).indexOf(normFa(p.name)) >= 0 || normFa(p.name).indexOf(normFa(name)) >= 0) && normFa(p.name).length >= 3) matched = p; });
    items.push({ pid: matched ? matched.id : '', name: matched ? matched.name : name, qty: qty || 1, price: price });
  });
  return items;
}
function loadTesseract() {
  return new Promise(function (res, rej) {
    if (window.Tesseract) { res(); return; }
    var s = document.createElement('script');
    s.src = 'ocr/tesseract.min.js';
    s.onload = function () { res(); };
    s.onerror = function () { rej(new Error('load')); };
    document.head.appendChild(s);
  });
}
function ocrInvoice() {
  var imgData = '';
  openModal('📷 اسکن فاکتور خرید',
    '<p class="mut small">از فاکتور کاغذی تأمین‌کننده عکس بگیرید؛ برنامه متن و اقلام را استخراج می‌کند و قبل از ساخت فاکتور، همه را برای بازبینی و اصلاح نشان می‌دهد. پردازش کاملاً روی خود گوشی انجام می‌شود.</p>' +
    '<label class="btn gray block" for="ocrFile" style="cursor:pointer">📸 انتخاب یا گرفتن عکس</label>' +
    '<input type="file" id="ocrFile" accept="image/*" style="display:none">' +
    '<div id="ocrPrev" style="margin:10px 0"></div>' +
    '<div id="ocrStat" class="small mut"></div>',
    [
      { label: '🔍 شروع پردازش', cb: function (close) {
          if (!imgData) { toast('اول عکس فاکتور را انتخاب کنید'); return; }
          $('#ocrStat').textContent = 'در حال بارگذاری موتور تشخیص متن…';
          loadTesseract().then(function () {
            $('#ocrStat').textContent = 'در حال خواندن فاکتور… (کمی صبر کنید)';
            return Tesseract.createWorker('fas+eng', 1, {
              workerPath: 'ocr/worker.min.js',
              corePath: 'ocr/tesseract-core-simd-lstm.wasm.js',
              langPath: 'ocr/', gzip: true, cacheMethod: 'none', workerBlobURL: true
            });
          }).then(function (worker) {
            return worker.recognize(imgData).then(function (r) {
              return worker.terminate().then(function () { return r; });
            });
          }).then(function (r) {
            var lines = (r.data.lines && r.data.lines.length) ? r.data.lines.map(function (l) { return l.text; }) : String(r.data.text || '').split('\n');
            close();
            ocrReview(ocrParseLines(lines), imgData);
          }).catch(function (e) {
            $('#ocrStat').textContent = 'موتور تشخیص متن روی این گوشی اجرا نشد؛ می‌توانید اقلام را دستی وارد کنید.';
            setTimeout(function () { close(); ocrReview([], imgData); }, 1600);
          });
        } },
      { label: 'انصراف', cls: 'gray', cb: function (close) { close(); } }
    ]);
  var f = $('#ocrFile');
  f.onchange = function () {
    var file = f.files && f.files[0]; if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var sc = Math.min(1, 1600 / img.width);
        var cv = document.createElement('canvas');
        cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        imgData = cv.toDataURL('image/jpeg', 0.85);
        $('#ocrPrev').innerHTML = '<img src="' + imgData + '" style="width:100%;border-radius:12px">';
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  };
}
function harvestOcrRows() {
  var out = [];
  $$('#ocrRows [data-or]').forEach(function (el) {
    var ix = +el.dataset.ix;
    out[ix] = out[ix] || { pid: '', name: '', qty: 1, price: 0 };
    out[ix][el.dataset.or] = el.tagName === 'SELECT' ? el.value : (el.dataset.or === 'name' ? el.value : nd(el.value));
  });
  return out.filter(Boolean);
}
function ocrReview(items, imgData) {
  if (!items.length) items = [{ pid: '', name: '', qty: 1, price: 0 }];
  var prodOpts = function (sel) {
    return '<option value="">＋ کالای جدید با همین نام</option>' + DB.products.map(function (p) { return '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('');
  };
  var body = (imgData ? '<img src="' + imgData + '" style="width:100%;border-radius:12px;margin-bottom:10px">' : '') +
    '<p class="mut small">اقلام استخراج‌شده را بررسی و اصلاح کنید؛ بعد فاکتور خرید ساخته می‌شود تا پرداخت و انبارش را نهایی کنید.</p>' +
    fRow('تأمین‌کننده', '<select id="ocrPer">' + perOptions('', 'supplier') + '</select>') +
    '<div id="ocrRows">' + items.map(function (it, ix) {
      return '<div class="invItem"><div class="gridRow">' +
        '<label class="small mut">کالا<select data-or="pid" data-ix="' + ix + '">' + prodOpts(it.pid) + '</select></label>' +
        '<label class="small mut">نام (اگر جدید)<input data-or="name" data-ix="' + ix + '" value="' + esc(it.name) + '"></label>' +
        '<label class="small mut">تعداد<input data-or="qty" data-ix="' + ix + '" inputmode="decimal" value="' + faNum(it.qty) + '"></label>' +
        '<label class="small mut">قیمت خرید<input data-or="price" data-ix="' + ix + '" inputmode="numeric" value="' + fn(it.price) + '"></label>' +
        '</div></div>';
    }).join('') + '</div>' +
    '<button class="btn gray sm" id="ocrAdd">＋ ردیف دیگر</button>';
  openModal('بازبینی فاکتور اسکن‌شده', body, [
    { label: 'ساخت فاکتور خرید', cb: function (close) {
        var out = harvestOcrRows();
        var final = [];
        out.forEach(function (r) {
          if (!r) return;
          var pid = r.pid, price = nd(r.price);
          if (!pid) {
            var nm = String(r.name || '').trim();
            if (!nm || price <= 0) return;
            var np = { id: newId('p'), code: '', barcode: '', barcodes: [], catId: '', name: nm, buyPrice: price, sellPrice: price, wsPrice: 0, unit: 'عدد', minStock: 0, note: '', img: '', packSize: 0, packName: '' };
            DB.products.push(np); pid = np.id;
          }
          var pp = prodById(pid);
          final.push({ pid: pid, name: pp ? pp.name : r.name, qty: nd(r.qty) || 1, price: price || (pp ? pp.buyPrice : 0), disc: 0 });
        });
        if (!final.length) { toast('قلم معتبری نیست'); return; }
        var per = val('ocrPer');
        close();
        openInvoiceEditor('purchase');
        D.items = final;
        if (per) { D.personId = per; var ps = $('#ivPerson'); if (ps) ps.value = per; }
        renderIvItems(); renderIvTotals();
        toast('فاکتور خرید از روی اسکن ساخته شد؛ بررسی و ثبت کنید');
      } },
    { label: 'انصراف', cls: 'gray', cb: function (close) { close(); } }
  ]);
  var add = $('#ocrAdd');
  if (add) add.onclick = function () {
    var cur = harvestOcrRows();
    cur.push({ pid: '', name: '', qty: 1, price: 0 });
    ocrReview(cur, imgData);
  };
}

/* ================= چاپ بلوتوثی حرارتی ================= */
function btLines(inv) {
  var per = inv.personId ? personById(inv.personId) : null;
  var L = [];
  L.push({ t: DB.settings.shopName || 'فروشگاه', b: 1, c: 1 });
  if (DB.settings.phone) L.push({ t: DB.settings.phone, c: 1, s: 1 });
  L.push({ t: KIND_LABEL[inv.kind] + ' شماره ' + faNum(inv.no || '') + ' · ' + fd(inv.date), c: 1, s: 1 });
  if (per) L.push({ t: (inv.kind === 'purchase' || inv.kind === 'purchase_ret' ? 'تأمین‌کننده: ' : 'مشتری: ') + per.name, s: 1 });
  L.push({ t: '- - - - - - - - - - - - - - -', c: 1, s: 1 });
  inv.items.forEach(function (it) {
    L.push({ t: it.name, s: 1 });
    L.push({ t: '  ' + faNum(it.qty) + ' × ' + fn(it.price), l: faNum(Math.round(lineTotal(it))), s: 1 });
  });
  L.push({ t: '- - - - - - - - - - - - - - -', c: 1, s: 1 });
  L.push({ t: 'جمع اقلام', l: faNum(Math.round(invoiceItemsTotal(inv))), s: 1 });
  if (nd(inv.gdisc)) L.push({ t: 'تخفیف', l: faNum(-nd(inv.gdisc)), s: 1 });
  if (nd(inv.tax)) L.push({ t: 'مالیات', l: faNum(invoiceTax(inv)), s: 1 });
  if (nd(inv.shipping)) L.push({ t: 'حمل', l: faNum(nd(inv.shipping)), s: 1 });
  L.push({ t: 'جمع کل (' + DB.settings.currency + ')', l: faNum(invoiceTotal(inv)), b: 1 });
  L.push({ t: 'پرداخت‌شده', l: faNum(invoicePaid(inv)), s: 1 });
  if (invoiceRemain(inv) > 0) L.push({ t: 'مانده', l: faNum(invoiceRemain(inv)), b: 1 });
  L.push({ t: DB.settings.invoiceFooter || '', c: 1, s: 1 });
  return L;
}
function btCanvas(inv, mm) {
  var W = mm === 58 ? 384 : 576;
  var lines = btLines(inv);
  var fs = mm === 58 ? 21 : 24;
  var cv = document.createElement('canvas');
  var ctx = cv.getContext('2d');
  if (!ctx) return null;
  var fam = (getComputedStyle(document.body).fontFamily || 'Tahoma');
  function setF(l) { ctx.font = (l.b ? 'bold ' : '') + (l.s ? Math.round(fs * 0.88) : fs) + 'px ' + fam; }
  var heights = lines.map(function (l) { setF(l); return (l.s ? Math.round(fs * 0.88) : fs) * 1.55; });
  var H = Math.ceil(heights.reduce(function (s, x) { return s + x; }, 16));
  cv.width = W; cv.height = H;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000'; ctx.textBaseline = 'middle';
  var y = 8;
  lines.forEach(function (l, i) {
    var h = heights[i]; setF(l);
    if (l.l !== undefined) {
      ctx.textAlign = 'left'; ctx.fillText(l.l, 4, y + h / 2);
      ctx.textAlign = 'right'; ctx.fillText(l.t, W - 4, y + h / 2);
    } else if (l.c) { ctx.textAlign = 'center'; ctx.fillText(l.t, W / 2, y + h / 2); }
    else { ctx.textAlign = 'right'; ctx.fillText(l.t, W - 4, y + h / 2); }
    y += h;
  });
  return cv;
}
function btEscpos(inv) {
  var mm = DB.settings.printSize === 't58' ? 58 : 80;
  var cv = btCanvas(inv, mm);
  if (!cv) return '';
  var ctx = cv.getContext('2d');
  var W = cv.width, H = cv.height, wb = W / 8;
  var img = ctx.getImageData(0, 0, W, H).data;
  var bytes = [0x1B, 0x40, 0x1D, 0x76, 0x30, 0x00, wb & 0xff, (wb >> 8) & 0xff, H & 0xff, (H >> 8) & 0xff];
  for (var yy = 0; yy < H; yy++) {
    for (var xb = 0; xb < wb; xb++) {
      var byte = 0;
      for (var bit = 0; bit < 8; bit++) {
        var px = (yy * W + xb * 8 + bit) * 4;
        var lum = (img[px] + img[px + 1] + img[px + 2]) / 3;
        if (lum < 150) byte |= (0x80 >> bit);
      }
      bytes.push(byte);
    }
  }
  bytes.push(0x1B, 0x64, 0x03, 0x1D, 0x56, 0x01);
  var bin = '';
  bytes.forEach(function (b) { bin += String.fromCharCode(b); });
  return btoa(bin);
}
function btPrintInvoice(id) {
  var inv = DB.invoices.filter(function (x) { return x.id === id; })[0];
  if (!inv) return;
  if (typeof Android === 'undefined' || !Android.btPrint) { toast('چاپ بلوتوثی در این نسخه فعال نیست'); return; }
  var devs = [];
  try { devs = JSON.parse(Android.btList() || '[]'); } catch (e) {}
  if (!devs.length) { toast('چاپگر جفت‌شده‌ای پیدا نشد؛ اول چاپگر را از تنظیمات بلوتوث گوشی جفت کنید'); return; }
  openModal('🖨 انتخاب چاپگر بلوتوثی',
    devs.map(function (d) { return '<button class="btn gray block" style="margin-bottom:8px" data-bt="' + esc(d.address) + '">🖨 ' + esc(d.name || d.address) + '</button>'; }).join(''),
    [{ label: 'انصراف', cls: 'gray', cb: function (close) { close(); } }]);
  $$('#modalRoot [data-bt]').forEach(function (b) {
    b.onclick = function () {
      var addr = b.dataset.bt;
      $('#modalRoot').innerHTML = '';
      var payload = '';
      try { payload = btEscpos(inv); } catch (e) {}
      if (!payload) { toast('آماده‌سازی چاپ روی این گوشی ممکن نشد'); return; }
      toast('در حال چاپ…');
      try { Android.btPrint(addr, payload); }
      catch (e) { toast('خطا در آماده‌سازی چاپ'); }
    };
  });
}
function __btResultFn(msg) { if (msg) try { toast(msg); } catch (e) {} }
if (typeof window !== 'undefined') window.__btResult = __btResultFn;

/* ================= تقویم جلالی (انتخاب تاریخ) ================= */
function jalMonthDays(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return jalCal(jy).leap === 0 ? 30 : 29;
}
var CALF = {};
function calField(id, iso, ph) {
  CALF[id] = iso || '';
  return '<input id="' + id + '" readonly class="calIn" data-calfield="1" placeholder="' + (ph || '📅 انتخاب از تقویم') + '" value="' + (iso ? fd(iso) : '') + '">';
}
function getCal(id) { return CALF[id] || ''; }
function openJalCalendar(currentIso, cb) {
  var old = document.getElementById('calOv');
  if (old) old.remove();
  var ov = document.createElement('div');
  ov.id = 'calOv';
  ov.innerHTML = '<div class="calCard"><div class="calTitle">📅 انتخاب تاریخ</div><div id="calBox"></div>' +
    '<div class="row" style="margin-top:12px"><button class="btn gray grow" id="calToday" type="button">📍 امروز</button>' +
    '<button class="btn gray grow" id="calClear" type="button">✕ بدون تاریخ</button>' +
    '<button class="btn gray grow" id="calClose" type="button">بستن</button></div></div>';
  document.body.appendChild(ov);
  syncScrollLock();
  syncScrollLock();
  function cleanup() { ov.remove(); syncScrollLock(); }
  ov.addEventListener('click', function (e) { if (e.target === ov) cleanup(); });
  ov.querySelector('#calClose').onclick = cleanup;
  ov.querySelector('#calToday').onclick = function () { cleanup(); cb(todayISO()); };
  ov.querySelector('#calClear').onclick = function () { cleanup(); cb(''); };
  var start = currentIso ? iso2j(currentIso) : iso2j(todayISO());
  var st = { jy: start.jy, jm: start.jm, sel: currentIso || '' };
  var todayJ = iso2j(todayISO());
  function grid() {
    var first = d2g(j2d(st.jy, st.jm, 1));
    var offset = (new Date(first.gy, first.gm - 1, first.gd).getDay() + 1) % 7;
    var days = jalMonthDays(st.jy, st.jm);
    var cells = '';
    ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].forEach(function (d) { cells += '<div class="calW">' + d + '</div>'; });
    for (var i = 0; i < offset; i++) cells += '<div></div>';
    for (var d = 1; d <= days; d++) {
      var iso = j2iso(st.jy, st.jm, d);
      var cls = 'calD' + (iso === st.sel ? ' sel' : '') + (st.jy === todayJ.jy && st.jm === todayJ.jm && d === todayJ.jd ? ' today' : '');
      cells += '<div class="' + cls + '" data-cald="' + d + '">' + faNum(d) + '</div>';
    }
    return cells;
  }
  function draw() {
    var box = $('#calBox'); if (!box) return;
    box.innerHTML = '<div class="row" style="align-items:center;margin-bottom:8px">' +
      '<button class="btn gray sm" id="calPrev">‹ ماه قبل</button>' +
      '<span class="grow" style="text-align:center"><b>' + JM[st.jm - 1] + ' ' + faNum(st.jy) + '</b></span>' +
      '<button class="btn gray sm" id="calNext">ماه بعد ›</button></div>' +
      '<div class="row" style="margin-bottom:10px"><select id="calMonth" style="flex:1;padding:8px;border:1px solid var(--line);border-radius:9px">' +
      JM.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (st.jm === i + 1 ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>' +
      '<select id="calYear" style="flex:1;padding:8px;border:1px solid var(--line);border-radius:9px">' +
      (function () { var o = ''; for (var y = 1398; y <= 1412; y++) o += '<option value="' + y + '"' + (st.jy === y ? ' selected' : '') + '>' + faNum(y) + '</option>'; return o; })() + '</select></div>' +
      '<div class="calGrid">' + grid() + '</div>';
    $('#calPrev').onclick = function () { st.jm--; if (st.jm < 1) { st.jm = 12; st.jy--; } draw(); };
    $('#calNext').onclick = function () { st.jm++; if (st.jm > 12) { st.jm = 1; st.jy++; } draw(); };
    $('#calMonth').onchange = function () { st.jm = +this.value; draw(); };
    $('#calYear').onchange = function () { st.jy = +this.value; draw(); };
    $$('#calBox [data-cald]').forEach(function (el) {
      el.onclick = function () {
        var iso = j2iso(st.jy, st.jm, +el.dataset.cald);
        cleanup();
        cb(iso);
      };
    });
  }
  draw();
}

/* ================= تازه‌های نسخه (Changelog) ================= */
var APP_VERSION = '7.6';
var CHANGELOG = [
  {
    v: '۷٫۶', items: [
      '📷 اسکنر بارکد و QR کامل شد: در ویرایش فاکتور (فروش و خرید) با دکمه «اسکن» کالاها را پشت‌سرهم با دوربین اضافه کنید — هر اسکن موفق با صدا و لرزش تأیید می‌شود و برای کد ناشناس، همان‌جا ساخت کالای جدید با همان بارکد پیشنهاد می‌شود',
      '🔦 صفحه اسکن تازه با قاب راهنما، چراغ‌قوه و ورود دستی کد؛ اگر دوربین در دسترس نباشد یا گوشی تشخیص خودکار نداشته باشد، اسکنر کتابخانه داخلی خودش را به کار می‌گیرد و هیچ‌وقت بن‌بست نیست',
      '📦 اسکن به فهرست کالاها (یافتن و بازکردن کالا) و فیلدهای بارکد فرم کالا هم رسید؛ انبارگردانی هم حالا با اسکن پیوسته می‌شمارد (دکمه اسکن انبارگردانی که از کار افتاده بود، درست شد)'
    ]
  },
  {
    v: '۷٫۵', items: [
      '🫧 منوی پایین استوانه‌ای شد: نوار ناوبری حالا یک استوانه شیشه‌ای شناور (لیکویید گلس) است — با نوار نور در بالا، سایه‌روشن لوله‌ای و انحنای دو سر؛ بخش فعال مثل یک عدسی شیشه‌ای داخل استوانه می‌نشیند و دکمه «+» وسط مثل دستگیره روی آن قرار دارد',
      '🧊 منوی کناری هم لیکویید گلس شد: کشوی منو حالا شیشه‌ای و نیمه‌شفاف است — هدر فروشگاه و آمار، بلوک‌های شیشه‌ای نرم‌اند، آیتم‌ها ردیف‌های شیشه‌ای با حالت فعال هم‌رنگ پالت شما هستند و ته‌رنگ شیشه با رنگ اصلی برنامه هماهنگ می‌شود؛ در تم تیره هم کشو شیشه دودی تیره با متن روشن است'
    ]
  },
  {
    v: '۷٫۴', items: [
      '🎨 طراحی تازه و روشن: کارت‌های سفید شیشه‌ای با گوشه‌های گردتر، سایه‌های نرم و پس‌زمینه آبی پاستلی در کل برنامه',
      '🧭 نوار پایین جدید: خانه، فاکتورها، دکمه «+» برجسته در وسط برای فاکتور فروش جدید، گزارش‌ها و منو — همه بخش‌ها مثل قبل از منوی کناری هم در دسترس‌اند',
      '💍 روی کارت اصلی داشبورد، حلقه «وصول فاکتورها» درصد وصول‌شده از فاکتورهای فروش را نشان می‌دهد',
      '💙 رنگ پیش‌فرض برنامه «آبی آسمانی» شد؛ بقیه پالت‌ها و تم تیره هم با همین طراحی تازه کار می‌کنند (تنظیمات ← پالت رنگی)'
    ]
  },
  {
    v: '۷٫۳', items: [
      '🎬 انیمیشن قابل انتخاب: در تنظیمات ← «انیمیشن و جلوه‌ها» افکت حرکت صفحه‌ها و پنجره‌ها را خودتان انتخاب کنید: محو شدن، لغزش، بزرگنمایی، برگردان، از پایین یا بدون انیمیشن',
      '⏩ سرعت انیمیشن هم قابل تنظیم است (کند، معمولی یا سریع) و با دکمه «پیش‌نمایش» همان‌جا افکت را زنده می‌بینید؛ انتخابتان فوراً روی کل برنامه اعمال و ذخیره می‌شود'
    ]
  },
  {
    v: '۷٫۲', items: [
      '🛍 کاتالوگ آنلاین: در بخش فروش، دکمه «کاتالوگ آنلاین» از کالاهایتان یک صفحه فروشگاه تک‌فایل می‌سازد (عکس، قیمت، دسته‌بندی، جست‌وجو و سبد خرید) — فایل را روی هر هاستی بگذارید یا مستقیم برای مشتری بفرستید',
      '📲 مشتری در کاتالوگ سفارش می‌دهد و سفارش با واتساپ برایتان می‌آید؛ کافی است پیام را با آی‌حساب به اشتراک بگذارید تا فاکتور فروش، مشتری و ردیف‌ها کاملاً خودکار ثبت شوند',
      '📥 ثبت دستی هم هست: بخش فروش ← «ثبت سفارش آنلاین» ← چسباندن متن سفارش ← ثبت خودکار فاکتور (مشتری تکراری با همان موبایل ساخته نمی‌شود)'
    ]
  },
  {
    v: '۷٫۱', items: [
      '🚪 حذف کامل ورود و ثبت‌نام به درخواست شما: ورود با جیمیل (گوگل) و ساخت حساب کاربری به‌طور کامل برداشته شد؛ برنامه بدون هیچ ثبت‌نامی مستقیم باز می‌شود',
      '☁️ همگام‌سازی ابری گوگل حذف شد؛ اطلاعات فقط روی همین گوشی ذخیره می‌شود و پشتیبان‌گیری خودکار روزانه مثل قبل کار می‌کند',
      '🔐 قفل برنامه (رمز و اثر انگشت) و کاربران داخلی برنامه سر جای خودشان هستند و فقط وقتی خودتان فعالشان کنید نمایش داده می‌شوند'
    ]
  },
  {
    v: '۷٫۰', items: [
      '🧮 حسابداری دوطرفه (دوبل) اضافه شد: بخش جدید «حسابداری دوطرفه» در منوی کناری با کدینگ استاندارد حساب‌ها',
      '📓 برای همه رویدادها (فاکتور فروش و خرید، برگشتی، پرداخت و دریافت، چک، هزینه، انتقال و عملیات انبار) به‌صورت خودکار سند متوازن بدهکار/بستانکار صادر می‌شود',
      '⚖️ تراز آزمایشی، دفتر کل، دفتر روزنامه، ترازنامه و چاپ تراز — مانده حساب‌ها دقیقاً با مانده اشخاص، صندوق، بانک و موجودی انبار مغایرت‌گیری می‌شود',
      '✍️ سند دستی: برای رویدادهای خاص (آورده و برداشت مالک، اصلاحات و…) سند متوازن با کنترل خودکار برابری بدهکار و بستانکار',
      '🎤 با صدا هم می‌توانید بگویید «تراز آزمایشی را نشان بده»'
    ]
  },
  {
    v: '۶٫۳', items: [
      '🐛 مرتب‌سازی دکمه‌های پایین صفحه جزئیات فاکتور: دکمه‌ها (چاپ، ارسال، اقساط، ابطال و…) دیگر از صفحه بیرون نمی‌زنند و در ردیف‌های مرتب سه‌تایی چیده می‌شوند'
    ]
  },
  {
    v: '۶٫۲', items: [
      '☁️ همگام‌سازی ابری با حساب گوگل: ورود و ثبت‌نام مستقیم با جیمیل و ذخیره خودکار اطلاعات حسابداری در فضای خصوصی گوگل‌درایو خودتان (پوشه اختصاصی برنامه — فقط خودتان به آن دسترسی دارید)',
      '👥 ثبت‌نام برای همه باز است: هر کاربر با جیمیل خودش وارد می‌شود و داده هر حساب کاملاً جدا و خصوصی می‌ماند',
      '🔄 همگام‌سازی خودکار بعد از هر تغییر، بعلاوه دکمه «همگام‌سازی الان» در تنظیمات (کارت «حساب من»)؛ اگر حساب گوگل دیگری روی همین گوشی وارد شود، اول از داده‌های فعلی پشتیبان ایمنی گرفته می‌شود',
      '📴 کاملاً آفلاین‌پسند: بدون ورود به گوگل یا بدون اینترنت، برنامه دقیقاً مثل قبل کار می‌کند و هیچ داده‌ای روی گوشی از دست نمی‌رود'
    ]
  },
  {
    v: '۶٫۱', items: [
      '👤 ثبت‌نام و ورود: اولین اجرا با ساخت حساب شروع می‌شود — نام، ایمیل (فقط جیمیل)، شماره موبایل و رمز قوی؛ ورودهای بعدی با ایمیل یا موبایل و رمز',
      '🟢 دکمه «ورود با گوگل» در صفحات ثبت‌نام و ورود (فعال‌سازی نهایی پس از اتصال پروژه گوگل توسعه‌دهنده)',
      '🚪 کارت «حساب من» در تنظیمات با مشخصات حساب و دکمه خروج از حساب'
    ]
  },
  {
    v: '۶٫۰', items: [
      '🗄️ دیتابیس واقعی: داده‌ها به دیتابیس داخلی برنامه (IndexedDB) منتقل شد — ظرفیت بسیار بیشتر و پایداری بالاتر؛ داده‌های قبلی شما خودکار و بدون تغییر منتقل می‌شود',
      '💾 پشتیبان‌گیری خودکار روزانه از دیتابیس (۷ نسخه آخر در پوشه iHesab-backups گوشی)',
      '⭐ حذف همه محدودیت‌ها: سقف فاکتور، کالا و مشتری برداشته شد و همه امکانات حرفه‌ای (حسابیار صوتی، اسکن فاکتور، چاپ بلوتوثی، مغایرت بانکی و بکاپ رمزدار) برای همه فعال است',
      '🚫 حذف کامل پرداخت درون‌برنامه‌ای و اتصال کافه‌بازار از برنامه'
    ]
  },
  {
    v: '۵٫۸', items: [
      '📊 سقف نسخه رایگان (نسخه انتشار): حداکثر ۱۰ فاکتور، ۱۰ کالا و ۱ مشتری؛ با خرید نسخه طلایی همه سقف‌ها برداشته می‌شود. میزان مصرف در تنظیمات (کارت نسخه طلایی) نمایش داده می‌شود'
    ]
  },
  {
    v: '۵٫۷', items: [
      '⭐ پرداخت درون‌برنامه‌ای کافه‌بازار وصل شد: خرید و بازیابی خرید «نسخه طلایی» از داخل برنامه، با راستی‌آزمایی امضای خرید؛ فعال‌سازی فقط بعد از تأیید امضای بازار انجام می‌شود',
      '🔒 این نسخه، نسخه انتشار است: امکانات حرفه‌ای (حسابیار صوتی، اسکن فاکتور، چاپ بلوتوثی، مغایرت بانکی، بکاپ رمزدار) تا زمان خرید طلایی قفل‌اند؛ حسابداری پایه کامل و رایگان است'
    ]
  },
  {
    v: '۵٫۶', items: [
      '🐛 رفع قطعی اسکرول پس‌زمینه: وقتی منوی کناری یا فرمی باز است، صفحه زیر آن کاملاً ثابت می‌ماند و فقط خود منو/فرم اسکرول می‌شود؛ جای اسکرول صفحه هم بعد از بستن حفظ می‌شود'
    ]
  },
  {
    v: '۵٫۵', items: [
      '🐛 رفع اسکرول پس‌زمینه: وقتی منو یا فرمی باز است، صفحه پشت آن دیگر با کشیدن دست اسکرول نمی‌شود',
      '🤖 حسابیار باهوش‌تر: شخص را با نام خانوادگی هم پیدا می‌کند («از رضایی بگیر») و فرمان‌های تازه‌ای مثل «بدهی مشتری‌ها» را می‌فهمد',
      '⭐ زیرساخت نسخه طلایی آماده شد: قفل امکانات حرفه‌ای (حسابیار، اسکن فاکتور، چاپ بلوتوثی، مغایرت بانکی، بکاپ رمزدار) + بررسی امضای دیجیتال برنامه برای مقابله با نسخه‌های مودشده (در این نسخه آزمایشی همه امکانات باز است)',
      '🪶 سبک‌سازی: تشخیص‌دهنده صدا و موتور اسکن بلافاصله بعد از استفاده آزاد می‌شوند تا رم کمتری مصرف شود'
    ]
  },
  {
    v: '۵٫۴', items: [
      '🤖 دستیار صوتی «حسابیار» با دکمه نام‌دار بالای برنامه؛ حالا فرمان‌های کامل اجرا می‌کند: ساخت فاکتور خرید/فروش با اسم شخص و اقلام و واحدها («فاکتور خرید به اسم آقای محمدی بزن شامل سه کارتن نوشابه»)، دریافت و پرداخت از شخص، ثبت هزینه، ساخت کالای/مشتری/چک جدید و جست‌وجو',
      '🏷️ آیکون برای دسته‌بندی‌ها: موقع ساخت یا ویرایش دسته از بین ۶۰+ آیکون انتخاب کنید؛ برای دسته‌های قبلی هم از روی اسمشان آیکون مناسب حدس زده می‌شود',
      '🐛 رفع اشکال اسکرول منوی کناری — حالا تا انتها اسکرول می‌شود'
    ]
  },
  {
    v: '۵٫۳', items: [
      '📅 تقویم فارسی لمسی کنار همه تاریخ‌های برنامه: فاکتور، رسید انبار و انقضا، پرداخت، هزینه، درآمد، انتقال، چک، اقساط و گزارش‌ها',
      '📁 محل ذخیره فایل‌ها به انتخاب شما (از تنظیمات): پوشه دلخواه برای اکسل، فاکتورها و پشتیبان‌ها',
      '🎨 منوی کناری تازه: گروه‌بندی بخش‌ها، آمار فروش امروز و ورود پلکانی آیتم‌ها',
      '🔆 کنتراست متن‌ها در همه تم‌ها و پالت‌ها تقویت شد تا در حالت روشن و تاریک خوانا باشند'
    ]
  },
  {
    v: '۵٫۲', items: [
      '🎤 دستیار صوتی در همه بخش‌ها: دکمه میکروفون بالای صفحه برای فرمان و پرسش، و میکروفون کنار همه جست‌وجوها',
      '🧠 فاکتور صوتی هوشمندتر: مقدار و واحد هر کالا را می‌فهمد؛ مثلاً «دو کارتن نوشابه»، «نیم کیلو برنج»، «۵۰۰ گرم زعفران»',
      '🗣 فرمان‌های صوتی تازه: «هزینه برق پانصد هزار تومان» را خودش ثبت می‌کند، «برو به گزارش‌ها» جابه‌جا می‌شود و «فاکتور فروش جدید» می‌سازد',
      '🔒 قفل برنامه مستقل از کاربران (از تنظیمات): رمز عددی، رمز قویِ حروفی با قوانین امنیتی، یا اثر انگشت',
      '🆕 همین منوی «تازه‌ها» از این نسخه بعد از هر به‌روزرسانی نمایش داده می‌شود'
    ]
  },
  {
    v: '۵٫۱', items: [
      '🔐 صفحه ورود تازه با کیپد شیشه‌ای، نقطه‌های رمز متحرک، انیمیشن خطا و موفقیت، و دکمه اثر انگشت با حلقه نورانی'
    ]
  },
  {
    v: '۵٫۰', items: [
      '🎤 فاکتور صوتی و 📷 اسکن فاکتور خرید با OCR داخلی',
      '🖨 چاپ بلوتوثی روی چاپگر حرارتی',
      '📦 انبارگردانی و تبدیل واحد (عدد/کارتن)، تاریخ انقضا و سری ساخت',
      '🎁 باشگاه مشتریان و 🏦 مغایرت‌گیری بانکی',
      '🔐 بکاپ رمزدار و سابقه ورود کاربران',
      '📅 تقویم جلالی برای انتخاب تاریخ در جست‌وجوی فاکتور'
    ]
  }
];
function showChangelog() {
  var html = CHANGELOG.map(function (c, ix) {
    return '<div style="margin-bottom:14px"><div style="font-weight:bold;font-size:16px;margin-bottom:6px">نسخه ' + c.v + (ix === 0 ? ' <span class="chip ok">جدید</span>' : '') + '</div>' +
      c.items.map(function (it) { return '<div style="padding:5px 0;border-bottom:1px dashed var(--line);font-size:14.5px;line-height:1.9">' + it + '</div>'; }).join('') + '</div>';
  }).join('');
  openModal('🆕 تازه‌های آی‌حساب', html, [
    { label: 'باشه، شروع کنیم ✓', cb: function (close) { close(); } }
  ]);
}
function maybeShowChangelog() {
  if (DB.settings.lastSeenVer === APP_VERSION) return;
  var hadData = (DB.invoices && DB.invoices.length) || (DB.products && DB.products.length) || DB.settings.lastSeenVer;
  DB.settings.lastSeenVer = APP_VERSION;
  saveDB();
  if (hadData) setTimeout(function () { showChangelog(); }, 800);
}

/* ================= قفل برنامه (مستقل از کاربر) ================= */
function strongPassCheck(p) {
  p = String(p || '');
  return {
    len: p.length >= 8,
    letter: /[A-Za-z\u0600-\u06FF]/.test(p),
    digit: /[0-9\u06F0-\u06F9\u0660-\u0669]/.test(p),
    special: /[^A-Za-z0-9\u0600-\u06FF\s]/.test(p),
    upper: /[A-Z]/.test(p)
  };
}
function strongPassOk(p) {
  var c = strongPassCheck(p);
  return c.len && c.letter && c.digit && c.special && c.upper;
}
function appLockOverlay() {
  var cfg = DB.settings.appLock;
  if (!cfg || !cfg.hash) { proceedAfterAppLock(); return; }
  var ov = document.createElement('div');
  ov.id = 'lockOv';
  ov.style.cssText = 'position:fixed;inset:0;background:var(--green);z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;padding:24px;gap:14px';
  var fpAvail = false;
  try { fpAvail = !!cfg.fp && typeof Android !== 'undefined' && !!Android.isFingerprintAvailable && Android.isFingerprintAvailable(); } catch (e) {}
  var pinBuf = '';
  var done = false;
  function success() {
    if (done) return;
    done = true;
    var chk = ov.querySelector('#lkCheck'); if (chk) chk.classList.add('show');
    var dots = ov.querySelector('#lkDots'); if (dots) dots.classList.add('ok');
    var wrap = ov.querySelector('#lkPadWrap'); if (wrap) wrap.classList.add('fadeOut');
    setTimeout(function () { ov.classList.add('bye'); }, 480);
    setTimeout(function () { ov.remove(); window.__fpResult = null; proceedAfterAppLock(); }, 900);
  }
  function err(msg) { var e1 = ov.querySelector('#lkErr'); if (e1) e1.textContent = msg || ''; }
  function shakeDots() { var d = ov.querySelector('#lkDots'); if (d) { d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); } }
  window.__fpResult = function (ok) {
    if (ok) success();
    else { err('اثر انگشت تأیید نشد؛ با رمز وارد شوید.'); shakeDots(); }
  };
  function renderDots() {
    var d = ov.querySelector('#lkDots'); if (!d) return;
    var h = '';
    for (var i = 0; i < 6; i++) h += '<span class="d' + (i < pinBuf.length ? ' on' : '') + '"></span>';
    d.innerHTML = h;
  }
  function attemptPin() {
    if (pinHash(pinBuf) === cfg.hash) { success(); return; }
    if (pinBuf.length >= 6) { err('رمز اشتباه است؛ دوباره تلاش کنید'); shakeDots(); pinBuf = ''; setTimeout(renderDots, 60); }
  }
  var head = '<div class="lkWrap"><img class="lkLogo" src="logo.png" alt="">' +
    '<h2 class="lkTitle">آی‌حساب</h2>' +
    '<div class="lkSub">برنامه قفل است — برای ادامه رمز را وارد کنید</div>';
  if (cfg.type === 'pin') {
    var keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button class="lkKey" data-k="' + n + '">' + faNum(n) + '</button>'; }).join('');
    ov.innerHTML = head +
      '<div class="lkDots" id="lkDots"></div><div class="lkErr" id="lkErr"></div>' +
      '<div id="lkPadWrap"><div class="lkPad">' + keys +
      (fpAvail ? '<button class="lkKey lkFpKey" id="lkFp">👆</button>' : '<span></span>') +
      '<button class="lkKey" data-k="0">' + faNum(0) + '</button>' +
      '<button class="lkKey" data-k="del">⌫</button></div></div>' +
      '<div class="lkCheck" id="lkCheck">✓</div></div>';
    renderDots();
    ov.querySelectorAll('[data-k]').forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.k;
        if (k === 'del') { pinBuf = pinBuf.slice(0, -1); renderDots(); err(''); return; }
        if (pinBuf.length >= 6) return;
        pinBuf += k;
        renderDots();
        if (pinBuf.length >= 4) attemptPin();
      };
    });
  } else {
    ov.innerHTML = head +
      '<div id="lkPadWrap" style="width:100%;max-width:320px">' +
      '<input id="lkPassIn" type="password" autocomplete="off" placeholder="رمز عبور برنامه" style="width:100%;padding:14px 16px;border-radius:14px;border:none;text-align:center;font-size:17px;direction:ltr">' +
      '<button class="lkEnter" id="lkPassGo" style="width:100%;margin-top:13px">🔓 ورود</button>' +
      (fpAvail ? '<div style="margin-top:18px;display:flex;flex-direction:column;align-items:center;gap:7px"><button class="lkKey lkFpKey" id="lkFp">👆</button><div class="small" style="color:rgba(255,255,255,.85)">ورود با اثر انگشت</div></div>' : '') +
      '</div>' +
      '<div class="lkErr" id="lkErr"></div>' +
      '<div class="lkCheck" id="lkCheck">✓</div></div>';
    var inp = ov.querySelector('#lkPassIn');
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 150);
    function goPass() {
      if (pinHash(inp.value) === cfg.hash) success();
      else {
        err('رمز اشتباه است؛ دوباره تلاش کنید');
        inp.classList.remove('shakeIt'); void inp.offsetWidth; inp.classList.add('shakeIt');
        inp.select();
      }
    }
    ov.querySelector('#lkPassGo').onclick = goPass;
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') goPass(); });
  }
  var fpBtn = ov.querySelector('#lkFp');
  if (fpBtn) fpBtn.onclick = function () {
    try { Android.authenticateFingerprint(); } catch (e) { err('اثر انگشت در دسترس نیست.'); }
  };
  document.body.appendChild(ov);
  syncScrollLock();
}

/* ================= محل ذخیره فایل‌ها ================= */
function folderLabelText() {
  try {
    if (typeof Android !== 'undefined' && Android.getExportFolderLabel) {
      var lb = Android.getExportFolderLabel();
      if (lb) return 'پوشه انتخابی: ' + lb;
    }
  } catch (e) {}
  return 'Downloads/iHesab (پیش‌فرض گوشی)';
}
if (typeof window !== 'undefined') {
  window.__folderPicked = function (label) {
    try { toast('📁 پوشه ذخیره انتخاب شد: ' + label); } catch (e) {}
    try { if (typeof show === 'function' && window.__curSection === 'settings') renderSettings(); } catch (e) {}
    try { var lb2 = document.querySelector('#stFolderLabel'); if (lb2) lb2.textContent = folderLabelText(); } catch (e) {}
  };
}

/* ================= نسخه ۶٫۱: بدون محدودیت، بدون پرداخت درون‌برنامه‌ای =================
   سیستم «نسخه طلایی» و اتصال کافه‌بازار به‌طور کامل حذف شده و همه امکانات برای همه فعال است.
   توابع زیر فقط برای سازگاری با ارجاع‌های پراکنده باقی مانده‌اند و همیشه «باز» برمی‌گردانند. */
var GOLD = { market: false, active: true, tampered: false, configured: false, sku: '', ready: true };
function refreshGold() { return GOLD; }
function isGold() { return true; }
function goldGate(label) { return true; }
function freeLimited() { return false; }
function customerCount() { return DB.persons.filter(function (x) { return x.kind !== 'supplier'; }).length; }
function limitGate(kind) { return true; }

/* ================= ابزار ارقام (تبدیل ارقام فارسی/عربی) ================= */
function enDigits(s) {
  return String(s == null ? '' : s)
    .replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - 0x06F0; })
    .replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 0x0660; });
}

/* ================= حسابداری دوطرفه (دوبل) — نسخه ۷٫۲ =================
   کدینگ حساب‌ها + سند خودکار متوازن برای همه رویدادها (فاکتور، پرداخت، چک، هزینه،
   انتقال، موجودی اولیه و عملیات انبار) + اسناد دستی. اسناد خودکار از روی سوابق
   ساخته می‌شوند (همیشه با داده عملیاتی سازگارند) و اسناد دستی در DB.journalManual می‌مانند. */
var CHART_BASE = [
  ['1010', 'صندوق', 'dr', 'دارایی‌ها'], ['1020', 'بانک', 'dr', 'دارایی‌ها'],
  ['1030', 'حساب‌های دریافتنی', 'dr', 'دارایی‌ها'], ['1040', 'موجودی کالا', 'dr', 'دارایی‌ها'],
  ['1050', 'اسناد دریافتنی', 'dr', 'دارایی‌ها'], ['1060', 'مالیات خرید (اعتبار مالیاتی)', 'dr', 'دارایی‌ها'],
  ['2010', 'حساب‌های پرداختنی', 'cr', 'بدهی‌ها'], ['2020', 'اسناد پرداختنی', 'cr', 'بدهی‌ها'],
  ['2030', 'مالیات بر ارزش افزوده پرداختنی', 'cr', 'بدهی‌ها'], ['2090', 'حساب واسط', 'dr', 'بدهی‌ها'],
  ['3010', 'سرمایه', 'cr', 'حقوق مالکانه'], ['3020', 'برداشت مالک', 'dr', 'حقوق مالکانه'],
  ['3030', 'تراز افتتاحیه', 'cr', 'حقوق مالکانه'],
  ['4010', 'فروش', 'cr', 'درآمدها'], ['4020', 'برگشت از فروش', 'dr', 'درآمدها'], ['4030', 'سایر درآمدها', 'cr', 'درآمدها'],
  ['5010', 'بهای تمام‌شده کالای فروش‌رفته', 'dr', 'بهای تمام‌شده'],
  ['6010', 'کسری و اضافات انبار', 'dr', 'هزینه‌ها'], ['6020', 'هزینه حمل خرید', 'dr', 'هزینه‌ها']
];
function chartAll() {
  var out = CHART_BASE.map(function (c) { return { code: c[0], name: c[1], nature: c[2], group: c[3], sys: true }; });
  DB.expCats.forEach(function (ec, i) {
    out.push({ code: '61' + String(i + 1).padStart(2, '0'), name: 'هزینه ' + ec.name, nature: 'dr', group: 'هزینه‌ها', expCatId: ec.id });
  });
  return out;
}
function accInfo(code) { return chartAll().filter(function (a) { return a.code === code; })[0] || { code: code, name: code, nature: 'dr', group: '' }; }
function expAccCode(catId) {
  var ix = DB.expCats.findIndex(function (e) { return e.id === catId; });
  return '61' + String((ix < 0 ? 98 : ix) + 1).padStart(2, '0');
}
function moneyAccCode(accId) { var a = accById(accId); return a && a.type === 'bank' ? '1020' : '1010'; }
function subName(acc, sub) {
  if (!sub) return '';
  if (acc === '1010' || acc === '1020') { var a = accById(sub); return a ? a.name : ''; }
  var p = personById(sub); return p ? p.name : '';
}
function buildJournal() {
  var E = [];
  function L(acc, sub, dr, cr) { return { acc: acc, sub: sub || '', dr: dr || 0, cr: cr || 0 }; }
  function ent(date, ref, desc, lines) {
    var Ls = lines.filter(function (l) { return Math.round(l.dr) !== 0 || Math.round(l.cr) !== 0; });
    if (!Ls.length) return;
    var td = 0, tc = 0;
    Ls.forEach(function (l) { l.dr = Math.round(l.dr); l.cr = Math.round(l.cr); td += l.dr; tc += l.cr; });
    if (td !== tc) {
      var big = Ls[0];
      Ls.forEach(function (l) { if ((l.dr || l.cr) > (big.dr || big.cr)) big = l; });
      if (td > tc) big.cr += td - tc; else big.dr += tc - td;
    }
    E.push({ date: date || '', ref: ref, desc: desc, lines: Ls, auto: true });
  }
  /* مانده‌های اولیه */
  DB.accounts.forEach(function (a) {
    var o = Math.round(nd(a.opening));
    if (o > 0) ent('', 'open:acc:' + a.id, 'مانده اولیه «' + a.name + '»', [L(moneyAccCode(a.id), a.id, o, 0), L('3030', '', 0, o)]);
    else if (o < 0) ent('', 'open:acc:' + a.id, 'مانده اولیه «' + a.name + '»', [L('3030', '', -o, 0), L(moneyAccCode(a.id), a.id, 0, -o)]);
  });
  DB.persons.forEach(function (p) {
    var o = Math.round(nd(p.opening));
    if (o > 0) ent('', 'open:per:' + p.id, 'مانده اولیه «' + p.name + '»', [L('1030', p.id, o, 0), L('3030', '', 0, o)]);
    else if (o < 0) ent('', 'open:per:' + p.id, 'مانده اولیه «' + p.name + '»', [L('3030', '', -o, 0), L('2010', p.id, 0, -o)]);
  });
  /* فاکتورها */
  var invs = DB.invoices.filter(function (v) { return v.status === 'final' && v.kind !== 'proforma'; })
    .slice().sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
  invs.forEach(function (inv) {
    var net = invoiceItemsTotal(inv) - nd(inv.gdisc), tax = invoiceTax(inv), ship = Math.round(nd(inv.shipping)), tot = invoiceTotal(inv);
    var per = inv.personId || '', cogs = Math.round(inv.cogs || 0);
    var lbl = (KIND_LABEL[inv.kind] || inv.kind) + ' شماره ' + inv.no;
    var paidSum = 0;
    (inv.paidBy || []).forEach(function (p) { paidSum += Math.round(nd(p.amount)); });
    function settle(mode) {
      if (!paidSum) return;
      var lines = [];
      var mon = function (p, dr) { return dr ? L(moneyAccCode(p.accId), p.accId, Math.round(nd(p.amount)), 0) : L(moneyAccCode(p.accId), p.accId, 0, Math.round(nd(p.amount))); };
      if (mode === 'sale') { (inv.paidBy || []).forEach(function (p) { lines.push(mon(p, true)); }); lines.push(L('1030', per, 0, paidSum)); }
      else if (mode === 'sale_ret') { lines.push(L('1030', per, paidSum, 0)); (inv.paidBy || []).forEach(function (p) { lines.push(mon(p, false)); }); }
      else if (mode === 'purchase') { lines.push(L('2010', per, paidSum, 0)); (inv.paidBy || []).forEach(function (p) { lines.push(mon(p, false)); }); }
      else if (mode === 'purchase_ret') { (inv.paidBy || []).forEach(function (p) { lines.push(mon(p, true)); }); lines.push(L('2010', per, 0, paidSum)); }
      ent(inv.date, 'settle:' + inv.id, 'تسویه ' + lbl, lines);
    }
    if (inv.kind === 'sale') {
      ent(inv.date, 'inv:' + inv.id, lbl, [L('1030', per, tot, 0), L('4010', '', 0, net), L('2030', '', 0, tax), L('4030', '', 0, ship)]);
      if (cogs) ent(inv.date, 'cogs:' + inv.id, 'بهای تمام‌شده ' + lbl, [L('5010', '', cogs, 0), L('1040', '', 0, cogs)]);
      settle('sale');
    } else if (inv.kind === 'sale_ret') {
      ent(inv.date, 'inv:' + inv.id, lbl, [L('4020', '', net, 0), L('2030', '', tax, 0), L('4030', '', ship, 0), L('1030', per, 0, tot)]);
      if (cogs) ent(inv.date, 'cogs:' + inv.id, 'برگشت بهای تمام‌شده ' + lbl, [L('1040', '', -cogs, 0), L('5010', '', 0, -cogs)]);
      settle('sale_ret');
    } else if (inv.kind === 'purchase') {
      ent(inv.date, 'inv:' + inv.id, lbl, [L('1040', '', net, 0), L('1060', '', tax, 0), L('6020', '', ship, 0), L('2010', per, 0, tot)]);
      settle('purchase');
    } else if (inv.kind === 'purchase_ret') {
      var plug = tot - tax - cogs;
      var ls = [L('2010', per, tot, 0), L('1060', '', 0, tax), L('1040', '', 0, cogs)];
      if (plug > 0) ls.push(L('4030', '', 0, plug)); else if (plug < 0) ls.push(L('6010', '', -plug, 0));
      ent(inv.date, 'inv:' + inv.id, lbl, ls);
      settle('purchase_ret');
    }
  });
  /* پرداخت‌های مستقل و وصول/پرداخت چک */
  var cqByPay = {};
  DB.cheques.forEach(function (c) { if (c.payId) cqByPay[c.payId] = c; });
  DB.payments.slice().sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); }).forEach(function (pay) {
    var amt = Math.round(nd(pay.amount)); if (!amt) return;
    var mc = moneyAccCode(pay.accId), per = pay.personId || '', cq = cqByPay[pay.id];
    var perName = per ? (personById(per) || {}).name || '' : '';
    if (cq && cq.dir === 'in') ent(pay.date, 'pay:' + pay.id, 'وصول چک شماره ' + cq.number + (perName ? ' · ' + perName : ''), [L(mc, pay.accId, amt, 0), L('1050', per, 0, amt)]);
    else if (cq) ent(pay.date, 'pay:' + pay.id, 'پرداخت چک شماره ' + cq.number + (perName ? ' · ' + perName : ''), [L('2020', per, amt, 0), L(mc, pay.accId, 0, amt)]);
    else if (pay.dir === 'receive') ent(pay.date, 'pay:' + pay.id, 'دریافت از ' + (perName || 'شخص'), [L(mc, pay.accId, amt, 0), L('1030', per, 0, amt)]);
    else ent(pay.date, 'pay:' + pay.id, 'پرداخت به ' + (perName || 'شخص'), [L('2010', per, amt, 0), L(mc, pay.accId, 0, amt)]);
  });
  /* اسناد چک */
  DB.cheques.forEach(function (c) {
    var amt = Math.round(nd(c.amount)); if (!amt) return;
    var per = c.personId || '', d = c.issueDate || c.dueDate || '';
    if (c.dir === 'in') {
      if (!(c.status === 'bounced' && !c.payId)) ent(d, 'cq:' + c.id, 'دریافت چک شماره ' + c.number + ' (' + c.bank + ')', [L('1050', per, amt, 0), L('1030', per, 0, amt)]);
      if (c.status === 'transferred') ent(d, 'cqtr:' + c.id, 'واگذاری چک شماره ' + c.number, [L('2090', '', amt, 0), L('1050', per, 0, amt)]);
    } else {
      if (!(c.status === 'bounced' && !c.payId)) ent(d, 'cq:' + c.id, 'صدور چک شماره ' + c.number + ' (' + c.bank + ')', [L('2010', per, amt, 0), L('2020', per, 0, amt)]);
    }
  });
  /* هزینه‌ها، درآمدها، انتقال‌ها */
  DB.expenses.forEach(function (e) {
    var amt = Math.round(nd(e.amount)); if (!amt) return;
    var cat = DB.expCats.filter(function (x) { return x.id === e.catId; })[0];
    ent(e.date, 'exp:' + e.id, 'هزینه ' + (cat ? cat.name : '') + (e.note ? ' · ' + e.note : ''), [L(expAccCode(e.catId), '', amt, 0), L(moneyAccCode(e.accId), e.accId, 0, amt)]);
  });
  DB.incomes.forEach(function (i) {
    var amt = Math.round(nd(i.amount)); if (!amt) return;
    ent(i.date, 'inc:' + i.id, 'درآمد: ' + (i.title || ''), [L(moneyAccCode(i.accId), i.accId, amt, 0), L('4030', '', 0, amt)]);
  });
  DB.transfers.forEach(function (t) {
    var amt = Math.round(nd(t.amount)); if (!amt) return;
    ent(t.date, 'tr:' + t.id, 'انتقال وجه' + (t.note ? ' · ' + t.note : ''), [L(moneyAccCode(t.toId), t.toId, amt, 0), L(moneyAccCode(t.fromId), t.fromId, 0, amt)]);
  });
  /* عملیات انبار */
  DB.stockOps.forEach(function (op) {
    var p = prodById(op.pid);
    if (op.kind === 'in') {
      var val = Math.round(nd(op.qty) * nd(op.cost != null ? op.cost : (p ? p._avg : 0)));
      if (!val) return;
      var opening = (op.note || '').indexOf('موجودی اولیه') >= 0;
      ent(op.date, 'so:' + op.id, 'ورود انبار: ' + (p ? p.name : '') + ' × ' + fn(op.qty), [L('1040', '', val, 0), L(opening ? '3030' : '4030', '', 0, val)]);
    } else if (op.kind === 'out') {
      var v2 = LEDGER_VAL[op.id]; if (!v2) return;
      ent(op.date, 'so:' + op.id, 'خروج انبار: ' + (p ? p.name : '') + ' × ' + fn(op.qty), [L('6010', '', v2, 0), L('1040', '', 0, v2)]);
    } else if (op.kind === 'adjust') {
      var v3 = LEDGER_VAL[op.id]; if (!v3) return;
      if (v3 > 0) ent(op.date, 'so:' + op.id, 'اضافه انبارگردانی: ' + (p ? p.name : ''), [L('1040', '', v3, 0), L('6010', '', 0, v3)]);
      else ent(op.date, 'so:' + op.id, 'کسری انبارگردانی: ' + (p ? p.name : ''), [L('6010', '', -v3, 0), L('1040', '', 0, -v3)]);
    }
  });
  /* اسناد دستی */
  (DB.journalManual || []).forEach(function (m) {
    E.push({ date: m.date || '', ref: 'manual:' + m.id, desc: m.desc || 'سند دستی', lines: (m.lines || []).map(function (l) { return L(l.acc, l.sub, Math.round(nd(l.dr)), Math.round(nd(l.cr))); }), auto: false });
  });
  E.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  E.forEach(function (e, i) { e.no = i + 1; });
  return E;
}
function journalAllLines(entries) {
  var out = [];
  entries.forEach(function (e) { e.lines.forEach(function (l) { out.push({ e: e, l: l }); }); });
  return out;
}
function trialBalance(entries) {
  var map = {};
  journalAllLines(entries).forEach(function (r) {
    if (!map[r.l.acc]) map[r.l.acc] = { dr: 0, cr: 0 };
    map[r.l.acc].dr += r.l.dr; map[r.l.acc].cr += r.l.cr;
  });
  return map;
}
function signedBal(entries, acc, sub) {
  var s = 0;
  journalAllLines(entries).forEach(function (r) {
    if (r.l.acc !== acc) return;
    if (sub !== undefined && r.l.sub !== sub) return;
    s += r.l.dr - r.l.cr;
  });
  return s;
}

/* ---------- رابط بخش حسابداری دوطرفه ---------- */
var ledTab = 'trial', ledAcc = '1030';
function renderLedger() {
  var entries = buildJournal();
  var tabs = [['trial', '⚖️ تراز آزمایشی'], ['ledger', '📖 دفتر کل'], ['journal', '📓 دفتر روزنامه'], ['sheet', '🏛 ترازنامه'], ['chart', '🗂 کدینگ'], ['manual', '✍️ اسناد دستی']];
  var h = '<div class="tabs">' + tabs.map(function (t) {
    return '<button data-lt="' + t[0] + '" class="' + (ledTab === t[0] ? 'active' : '') + '">' + t[1] + '</button>';
  }).join('') + '</div>';
  if (ledTab === 'trial') h += trialHtml(entries);
  else if (ledTab === 'ledger') h += ledgerBookHtml(entries);
  else if (ledTab === 'journal') h += journalHtml(entries);
  else if (ledTab === 'sheet') h += sheetHtml(entries);
  else if (ledTab === 'chart') h += chartHtml();
  else h += manualHtml();
  $('#view').innerHTML = h;
  $$('#view [data-lt]').forEach(function (b) { b.onclick = function () { ledTab = b.dataset.lt; renderLedger(); }; });
  var la = $('#ledAccSel');
  if (la) la.onchange = function () { ledAcc = la.value; renderLedger(); };
  $$('#view [data-jno]').forEach(function (el) { el.onclick = function () { journalEntryModal(entries, +el.dataset.jno); }; });
  var jb = $('#ledPrint'); if (jb) jb.onclick = function () { printTrial(entries); };
  var mb = $('#jmNew'); if (mb) mb.onclick = function () { manualEntryEditor(); };
  $$('#view [data-jmdel]').forEach(function (el) {
    el.onclick = function () {
      uiConfirm('این سند دستی حذف شود؟').then(function (ok) {
        if (!ok) return;
        DB.journalManual = DB.journalManual.filter(function (x) { return x.id !== el.dataset.jmdel; });
        saveDB(); renderLedger(); toast('حذف شد');
      });
    };
  });
}
function trialHtml(entries) {
  var tb = trialBalance(entries);
  var rows = '', tDr = 0, tCr = 0, bDr = 0, bCr = 0;
  chartAll().forEach(function (a) {
    var r = tb[a.code]; if (!r || (!r.dr && !r.cr)) return;
    var bal = r.dr - r.cr;
    rows += '<tr><td>' + faNum(a.code) + '</td><td>' + esc(a.name) + '</td><td>' + fm(r.dr) + '</td><td>' + fm(r.cr) + '</td><td>' + (bal > 0 ? fm(bal) : '—') + '</td><td>' + (bal < 0 ? fm(-bal) : '—') + '</td></tr>';
    tDr += r.dr; tCr += r.cr;
    if (bal > 0) bDr += bal; else bCr += -bal;
  });
  var okBal = tDr === tCr && bDr === bCr;
  return '<div class="card"><h3>⚖️ تراز آزمایشی</h3>' +
    '<p class="mut small">گردش و مانده همه حساب‌ها از روی اسناد خودکار و دستی. ' + (okBal ? '<b style="color:var(--green)">✅ تراز برقرار است</b>' : '<b style="color:var(--red)">⚠️ تراز برقرار نیست</b>') + '</p>' +
    '<div style="overflow-x:auto"><table class="rep"><thead><tr><th>کد</th><th>حساب</th><th>گردش بدهکار</th><th>گردش بستانکار</th><th>مانده بدهکار</th><th>مانده بستانکار</th></tr></thead><tbody>' + rows +
    '<tr style="font-weight:800"><td colspan="2">جمع</td><td>' + fm(tDr) + '</td><td>' + fm(tCr) + '</td><td>' + fm(bDr) + '</td><td>' + fm(bCr) + '</td></tr>' +
    '</tbody></table></div>' +
    '<button class="btn gray" id="ledPrint" style="margin-top:10px">🖨 چاپ تراز آزمایشی</button></div>';
}
function printTrial(entries) {
  var tb = trialBalance(entries);
  var rows = chartAll().map(function (a) {
    var r = tb[a.code]; if (!r || (!r.dr && !r.cr)) return '';
    var bal = r.dr - r.cr;
    return '<tr><td>' + faNum(a.code) + '</td><td>' + esc(a.name) + '</td><td>' + fm(r.dr) + '</td><td>' + fm(r.cr) + '</td><td>' + (bal > 0 ? fm(bal) : '—') + '</td><td>' + (bal < 0 ? fm(-bal) : '—') + '</td></tr>';
  }).join('');
  doPrint('<h2>تراز آزمایشی — ' + esc(DB.settings.shopName || '') + '</h2><table><thead><tr><th>کد</th><th>حساب</th><th>گردش بدهکار</th><th>گردش بستانکار</th><th>مانده بدهکار</th><th>مانده بستانکار</th></tr></thead><tbody>' + rows + '</tbody></table>');
}
function ledgerBookHtml(entries) {
  var opts = chartAll().map(function (a) { return '<option value="' + a.code + '"' + (ledAcc === a.code ? ' selected' : '') + '>' + faNum(a.code) + ' — ' + esc(a.name) + '</option>'; }).join('');
  var info = accInfo(ledAcc), run = 0, rows = '';
  journalAllLines(entries).forEach(function (r) {
    if (r.l.acc !== ledAcc) return;
    run += info.nature === 'dr' ? (r.l.dr - r.l.cr) : (r.l.cr - r.l.dr);
    rows += '<tr><td>' + faNum(r.e.no) + '</td><td>' + fdm(r.e.date) + '</td><td>' + esc(r.e.desc) + (r.l.sub ? ' <span class="mut">(' + esc(subName(ledAcc, r.l.sub)) + ')</span>' : '') + '</td><td>' + (r.l.dr ? fm(r.l.dr) : '—') + '</td><td>' + (r.l.cr ? fm(r.l.cr) : '—') + '</td><td>' + fm(run) + '</td></tr>';
  });
  if (!rows) rows = '<tr><td colspan="6" class="mut" style="text-align:center">گردشی برای این حساب ثبت نشده است.</td></tr>';
  return '<div class="card"><h3>📖 دفتر کل</h3>' +
    '<div class="f"><label>حساب</label><select id="ledAccSel">' + opts + '</select></div>' +
    '<div style="overflow-x:auto"><table class="rep"><thead><tr><th>سند</th><th>تاریخ</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
}
function journalHtml(entries) {
  var rows = entries.slice().reverse().map(function (e) {
    var t = 0; e.lines.forEach(function (l) { t += l.dr; });
    return '<div class="listItem" data-jno="' + e.no + '"><div class="main"><div class="t">سند ' + faNum(e.no) + ' · ' + esc(e.desc) + '</div><div class="s">' + fdm(e.date) + ' · ' + fm(t) + (e.auto ? '' : ' · ✍️ دستی') + '</div></div><span>›</span></div>';
  }).join('');
  return '<div class="card"><h3>📓 دفتر روزنامه</h3><p class="mut small">همه اسناد به ترتیب تاریخ؛ برای دیدن ریز هر سند رویش بزنید.</p>' + (rows || '<div class="empty">سندی ثبت نشده است.</div>') + '</div>';
}
function journalEntryModal(entries, no) {
  var e = entries.filter(function (x) { return x.no === no; })[0]; if (!e) return;
  var rows = e.lines.map(function (l) {
    var a = accInfo(l.acc);
    return '<tr><td>' + faNum(l.acc) + '</td><td>' + esc(a.name) + (l.sub ? ' <span class="mut">— ' + esc(subName(l.acc, l.sub)) + '</span>' : '') + '</td><td>' + (l.dr ? fm(l.dr) : '—') + '</td><td>' + (l.cr ? fm(l.cr) : '—') + '</td></tr>';
  }).join('');
  openModal('سند شماره ' + faNum(e.no), '<p class="mut small" style="margin-top:0">' + fdm(e.date) + ' · ' + esc(e.desc) + '</p><div style="overflow-x:auto"><table class="rep"><thead><tr><th>کد</th><th>حساب</th><th>بدهکار</th><th>بستانکار</th></tr></thead><tbody>' + rows + '</tbody></table></div>', [{ label: 'بستن', cls: 'gray' }]);
}
function sheetHtml(entries) {
  function grp(name) {
    var s = 0;
    chartAll().filter(function (a) { return a.group === name; }).forEach(function (a) { s += signedBal(entries, a.code); });
    return s;
  }
  var assets = grp('دارایی‌ها');
  var liab = -grp('بدهی‌ها');
  var equity = -grp('حقوق مالکانه');
  var profit = -grp('درآمدها') - grp('بهای تمام‌شده') - grp('هزینه‌ها');
  function grpRows(name) {
    return chartAll().filter(function (a) { return a.group === name; }).map(function (a) {
      var b = signedBal(entries, a.code); if (!b) return '';
      var v = a.nature === 'dr' ? b : -b;
      return '<div class="row"><span>' + faNum(a.code) + ' ' + esc(a.name) + '</span><b>' + fm(v) + '</b></div>';
    }).join('');
  }
  var balanced = Math.abs(assets - (liab + equity + profit)) <= 1;
  return '<div class="card"><h3>🏛 ترازنامه</h3>' +
    '<h4>دارایی‌ها</h4>' + grpRows('دارایی‌ها') + '<div class="row" style="font-weight:800;border-top:2px solid var(--line);padding-top:8px"><span>جمع دارایی‌ها</span><b>' + fm(assets) + '</b></div>' +
    '<h4 style="margin-top:16px">بدهی‌ها</h4>' + grpRows('بدهی‌ها') + '<div class="row" style="font-weight:800"><span>جمع بدهی‌ها</span><b>' + fm(liab) + '</b></div>' +
    '<h4 style="margin-top:16px">حقوق مالکانه</h4>' + grpRows('حقوق مالکانه') +
    '<div class="row"><span>سود (زیان) دوره</span><b>' + fm(profit) + '</b></div>' +
    '<div class="row" style="font-weight:800;border-top:2px solid var(--line);padding-top:8px"><span>جمع بدهی و حقوق مالکانه</span><b>' + fm(liab + equity + profit) + '</b></div>' +
    '<p class="mut small">' + (balanced ? '✅ ترازنامه متوازن است.' : '⚠️ اختلاف در ترازنامه — اسناد را بررسی کنید.') + '</p></div>';
}
function chartHtml() {
  var lastGroup = '', rows = '';
  chartAll().forEach(function (a) {
    if (a.group !== lastGroup) { lastGroup = a.group; rows += '<div class="dGroup" style="margin-top:10px">' + lastGroup + '</div>'; }
    rows += '<div class="listItem"><span class="catIcTile" style="font-size:13px;font-weight:800;width:auto;padding:0 10px">' + faNum(a.code) + '</span><div class="main"><div class="t">' + esc(a.name) + '</div><div class="s">' + (a.nature === 'dr' ? 'ماهیت بدهکار' : 'ماهیت بستانکار') + (a.expCatId ? ' · از دسته‌های هزینه' : '') + '</div></div></div>';
  });
  return '<div class="card"><h3>🗂 کدینگ حساب‌ها</h3><p class="mut small">کدینگ استاندارد فروشگاهی؛ حساب‌های هزینه از دسته‌های هزینه شما ساخته می‌شوند.</p>' + rows + '</div>';
}
function manualHtml() {
  var list = (DB.journalManual || []).slice().reverse().map(function (m) {
    var t = 0; (m.lines || []).forEach(function (l) { t += nd(l.dr); });
    return '<div class="listItem"><div class="main"><div class="t">' + esc(m.desc || 'سند دستی') + '</div><div class="s">' + fdm(m.date) + ' · ' + fm(t) + '</div></div><button class="btn gray sm" data-jmdel="' + m.id + '">🗑</button></div>';
  }).join('');
  return '<div class="card"><h3>✍️ اسناد دستی</h3><p class="mut small">برای رویدادهایی که سند خودکار ندارند (سرمایه‌گذاری مالک، برداشت، اصلاحات و…) سند دستی متوازن ثبت کنید.</p>' +
    '<button class="btn block" id="jmNew" style="margin-bottom:12px">＋ سند دستی جدید</button>' + (list || '<div class="empty">سند دستی ثبت نشده است.</div>') + '</div>';
}
function manualEntryEditor() {
  var accOpts = chartAll().map(function (a) { return '<option value="' + a.code + '">' + faNum(a.code) + ' — ' + esc(a.name) + '</option>'; }).join('');
  function lineRow() {
    return '<div class="jmLine" style="display:flex;gap:6px;margin-bottom:6px"><select class="jmAcc" style="flex:2">' + accOpts + '</select>' +
      '<input class="jmDr" inputmode="numeric" placeholder="بدهکار" style="flex:1"><input class="jmCr" inputmode="numeric" placeholder="بستانکار" style="flex:1"></div>';
  }
  var body = fRow('تاریخ', calField('jmDate', todayISO())) +
    fRow('شرح سند', '<input id="jmDesc" placeholder="مثلاً: آورده نقدی مالک">') +
    '<div id="jmLines">' + lineRow() + lineRow() + lineRow() + '</div>' +
    '<button class="btn gray sm" id="jmAddLine" type="button">＋ سطر</button>' +
    '<div class="row" style="margin-top:10px"><span>جمع بدهکار: <b id="jmTD">۰</b></span><span>جمع بستانکار: <b id="jmTC">۰</b></span><span id="jmBal"></span></div>' +
    '<div class="err" id="jmErr"></div>';
  openModal('✍️ سند دستی جدید', body, [
    { label: 'ثبت سند', cb: function (close) {
        var lines = [], td = 0, tc = 0;
        $$('#jmLines .jmLine').forEach(function (row) {
          var acc = row.querySelector('.jmAcc').value;
          var dr = nd(row.querySelector('.jmDr').value), cr = nd(row.querySelector('.jmCr').value);
          if (dr > 0 && cr > 0) { $('#jmErr').textContent = 'هر سطر یا بدهکار است یا بستانکار.'; lines = null; return; }
          if (dr || cr) { lines.push({ acc: acc, sub: '', dr: dr, cr: cr }); td += dr; tc += cr; }
        });
        if (!lines) return;
        if (lines.length < 2) { $('#jmErr').textContent = 'سند باید دست‌کم دو سطر داشته باشد.'; return; }
        if (!td || td !== tc) { $('#jmErr').textContent = 'سند متوازن نیست: جمع بدهکار و بستانکار باید برابر باشد.'; return; }
        DB.journalManual.push({ id: newId('jm'), date: getCal('jmDate') || todayISO(), desc: val('jmDesc').trim() || 'سند دستی', lines: lines });
        saveDB(); close(); renderLedger(); toast('سند دستی ثبت شد');
      } },
    { label: 'انصراف', cls: 'gray' }
  ]);
  function upd() {
    var td = 0, tc = 0;
    $$('#jmLines .jmLine').forEach(function (row) { td += nd(row.querySelector('.jmDr').value); tc += nd(row.querySelector('.jmCr').value); });
    $('#jmTD').textContent = fm(td); $('#jmTC').textContent = fm(tc);
    $('#jmBal').innerHTML = td && td === tc ? '<b style="color:var(--green)">✅ متوازن</b>' : '<b style="color:var(--red)">نامتوازن</b>';
  }
  $$('#jmLines input').forEach(function (i) { i.addEventListener('input', upd); });
  $('#jmAddLine').onclick = function () {
    var d = document.createElement('div'); d.innerHTML = lineRow();
    var node = d.firstChild;
    $('#jmLines').appendChild(node);
    node.querySelectorAll('input').forEach(function (i) { i.addEventListener('input', upd); });
  };
  upd();
}

/* ================= کاتالوگ آنلاین و ثبت خودکار فاکتور از سفارش — نسخه ۷٫۲ =================
   کاتالوگ یک فایل HTML مستقل است (از کالاهای فعلی ساخته می‌شود)؛ مشتری سبد را پر می‌کند
   و سفارش با واتساپ برمی‌گردد. متن سفارش یک بلوک ماشینی [IHESAB1:…] دارد؛ فروشنده پیام را
   با آی‌حساب به اشتراک می‌گذارد یا در «ثبت سفارش آنلاین» می‌چسباند تا فاکتور فروش،
   مشتری و ردیف‌ها به‌صورت خودکار ساخته شوند. */
function b64encodeUtf8(str) {
  var bytes = new TextEncoder().encode(str);
  var bin = '';
  bytes.forEach(function (b) { bin += String.fromCharCode(b); });
  return btoa(bin);
}
function b64decodeUtf8(b64) {
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function buildCatalogHtml() {
  var S = DB.settings;
  var cats = DB.categories.map(function (c) { return { id: c.id, name: c.name, icon: c.icon || catIcon(c) }; });
  var prods = DB.products.map(function (p) {
    return {
      id: p.id, name: p.name, code: p.code || '', price: Math.round(nd(p.sellPrice)),
      unit: p.unit || 'عدد', cat: p.catId || '', img: p.photo || '',
      icon: catIcon(catById(p.catId) || {}), stock: Math.round(stockOf(p))
    };
  });
  var shop = { name: S.shopName || 'فروشگاه من', phone: S.shopPhone || '', addr: S.shopAddr || '', wa: enDigits(S.catalogWa || S.shopPhone || '').replace(/\D/g, '') };
  var data = JSON.stringify({ shop: shop, cats: cats, prods: prods }).replace(/<\//g, '<\\/');
  var css = 'body{font-family:Tahoma,Vazirmatn,sans-serif;direction:rtl;margin:0;background:#f2f5f3;color:#14251c}' +
    'header{position:sticky;top:0;background:#0e9f6e;color:#fff;padding:14px 16px;z-index:5;box-shadow:0 2px 10px rgba(0,0,0,.15)}' +
    'header h1{margin:0;font-size:19px}header p{margin:4px 0 0;font-size:12px;opacity:.9}' +
    '.search{padding:10px 14px}.search input{width:100%;box-sizing:border-box;padding:11px;border:1px solid #cfe0d6;border-radius:12px;font-size:15px}' +
    '.chips{display:flex;gap:8px;overflow-x:auto;padding:0 14px 10px}.chips button{white-space:nowrap;border:1px solid #0e9f6e;background:#fff;color:#0b7a55;border-radius:999px;padding:7px 14px;font-size:13px;cursor:pointer}.chips button.on{background:#0e9f6e;color:#fff}' +
    '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;padding:4px 14px 110px}' +
    '.card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 10px rgba(20,50,35,.07)}' +
    '.card img{width:100%;height:130px;object-fit:cover;background:#e7efe9}.card .ph{height:130px;display:flex;align-items:center;justify-content:center;font-size:52px;background:#e7efe9}' +
    '.card .b{padding:10px}.card .n{font-weight:700;font-size:14px;min-height:38px}.card .p{color:#0b7a55;font-weight:800;margin:6px 0}' +
    '.out{color:#c0392b;font-size:12px;font-weight:700}' +
    '.qty{display:flex;align-items:center;gap:8px;margin-top:8px}.qty button{width:32px;height:32px;border-radius:10px;border:none;background:#0e9f6e;color:#fff;font-size:18px;cursor:pointer}.qty button:disabled{background:#b9cdc2}.qty b{min-width:22px;text-align:center}' +
    '#bar{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #dbe7de;padding:12px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 -4px 16px rgba(0,0,0,.08)}' +
    '#bar button{flex:1;background:#0e9f6e;color:#fff;border:none;border-radius:12px;padding:13px;font-size:16px;font-weight:800;cursor:pointer}' +
    '#ov{position:fixed;inset:0;background:rgba(10,25,18,.55);display:none;align-items:flex-end;justify-content:center;z-index:9}' +
    '#sheet{background:#fff;width:100%;max-width:520px;border-radius:20px 20px 0 0;padding:18px;max-height:88vh;overflow:auto}' +
    '#sheet input,#sheet textarea{width:100%;box-sizing:border-box;padding:11px;border:1px solid #cfe0d6;border-radius:10px;margin:5px 0 10px;font-size:15px}' +
    '#sheet label{font-size:13px;font-weight:700}.line{display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px dashed #e2ece5}' +
    '.send{display:block;text-align:center;background:#25d366;color:#fff;text-decoration:none;border-radius:12px;padding:14px;font-weight:800;font-size:16px;margin-top:12px}' +
    '.x{background:none;border:none;font-size:20px;float:left;cursor:pointer}' +
    '#msg{position:fixed;top:14px;left:50%;transform:translateX(-50%);background:#14251c;color:#fff;padding:10px 18px;border-radius:12px;display:none;z-index:20;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.25)}';
  var js = 'var D=' + data + ';' +
    'var cart={},curCat="",q="";' +
    'function fa(n){return String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,"٬").replace(/\\d/g,function(d){return "۰۱۲۳۴۵۶۷۸۹"[d];});}' +
    'function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;");}' +
    'function render(){var g=document.getElementById("grid");var list=D.prods.filter(function(p){return (!curCat||p.cat===curCat)&&(!q||p.name.indexOf(q)>=0);});' +
    'g.innerHTML=list.map(function(p){var n=cart[p.id]||0;var dis=p.stock<=0;' +
    'return \'<div class="card">\'+(p.img?\'<img src="\'+p.img+\'">\':\'<div class="ph">\'+p.icon+\'</div>\')+\'<div class="b"><div class="n">\'+esc(p.name)+\'</div>\' +(dis?\'<div class="out">ناموجود</div>\':"")+\'<div class="p">\'+fa(p.price)+\' تومان</div><div class="qty"><button \'+(dis?"disabled":"")+\' onclick="ch(\\\'\'+p.id+\'\\\',1)">+</button><b>\'+fa(n)+\'</b><button onclick="ch(\\\'\'+p.id+\'\\\',-1)">−</button></div></div></div>\';}).join("")||\'<p style="padding:16px">کالایی یافت نشد.</p>\';' +
    'var cnt=0,tot=0;Object.keys(cart).forEach(function(id){var p=D.prods.filter(function(x){return x.id===id;})[0];if(p){cnt+=cart[id];tot+=cart[id]*p.price;}});' +
    'document.getElementById("cnt").textContent=fa(cnt);document.getElementById("tot").textContent=fa(tot);' +
    'document.querySelectorAll(".chips button").forEach(function(b){b.classList.toggle("on",b.dataset.c===curCat);});}' +
    'function ch(id,d){cart[id]=Math.max(0,(cart[id]||0)+d);if(!cart[id])delete cart[id];render();}' +
    'function setCat(c){curCat=c;render();}' +
    'function msg(s){var m=document.getElementById("msg");m.textContent=s;m.style.display="block";setTimeout(function(){m.style.display="none";},2600);}' +
    'function openForm(){var ids=Object.keys(cart);if(!ids.length){msg("سبد خرید خالی است");return;}' +
    'var rows=ids.map(function(id){var p=D.prods.filter(function(x){return x.id===id;})[0];return \'<div class="line"><span>\'+esc(p.name)+" × "+fa(cart[id])+\'</span><b>\'+fa(p.price*cart[id])+\' تومان</b></div>\';}).join("");' +
    'var tot=ids.reduce(function(s,id){var p=D.prods.filter(function(x){return x.id===id;})[0];return s+p.price*cart[id];},0);' +
    'document.getElementById("items").innerHTML=rows+\'<div class="line"><span>جمع کل</span><b>\'+fa(tot)+\' تومان</b></div>\';' +
    'document.getElementById("ov").style.display="flex";}' +
    'function closeForm(){document.getElementById("ov").style.display="none";}' +
    'function send(){var name=document.getElementById("fName").value.trim(),phone=document.getElementById("fPhone").value.trim(),addr=document.getElementById("fAddr").value.trim(),note=document.getElementById("fNote").value.trim();' +
    'if(!name||!phone){msg("نام و موبایل را وارد کنید");return;}' +
    'var ids=Object.keys(cart);var lines=ids.map(function(id){var p=D.prods.filter(function(x){return x.id===id;})[0];return "• "+p.name+" × "+cart[id]+" — "+fa(p.price*cart[id])+" تومان";});' +
    'var tot=ids.reduce(function(s,id){var p=D.prods.filter(function(x){return x.id===id;})[0];return s+p.price*cart[id];},0);' +
    'var payload={v:1,name:name,phone:phone,addr:addr,note:note,items:ids.map(function(id){return [id,cart[id]];})};' +
    'var b64=btoa(unescape(encodeURIComponent(JSON.stringify(payload))));' +
    'var txt="🛍 سفارش جدید از کاتالوگ «"+D.shop.name+"»\\n👤 نام: "+name+"\\n📱 موبایل: "+phone+"\\n🏠 نشانی: "+addr+(note?"\\n📝 توضیح: "+note:"")+"\\n———————\\n"+lines.join("\\n")+"\\n💰 جمع کل: "+fa(tot)+" تومان\\n[IHESAB1:"+b64+"]";' +
    'var num=(D.shop.wa||"").replace(/\\D/g,"");var url=num?("https://wa.me/"+num+"?text="+encodeURIComponent(txt)):("https://wa.me/?text="+encodeURIComponent(txt));' +
    'window.open(url,"_blank");}' +
    'document.getElementById("q").addEventListener("input",function(e){q=e.target.value;render();});render();';
  return '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(shop.name) + '</title><style>' + css + '</style></head><body>' +
    '<header><h1>🛍 ' + esc(shop.name) + '</h1><p>' + esc(shop.addr || '') + (shop.phone ? ' · ☎ ' + esc(fn(shop.phone)) : '') + '</p></header>' +
    '<div class="search"><input id="q" placeholder="🔎 جست‌وجوی کالا…"></div>' +
    '<div class="chips"><button data-c="" class="on" onclick="setCat(\'\')">همه</button>' +
    cats.map(function (c) { return '<button data-c="' + c.id + '" onclick="setCat(\'' + c.id + '\')">' + c.icon + ' ' + esc(c.name) + '</button>'; }).join('') + '</div>' +
    '<div id="msg"></div>' +
    '<div class="grid" id="grid"></div>' +
    '<div id="bar"><div>🛒 <b id="cnt">۰</b> قلم · <b id="tot">۰</b> تومان</div><button onclick="openForm()">ثبت سفارش</button></div>' +
    '<div id="ov"><div id="sheet"><button class="x" onclick="closeForm()">✕</button><h3 style="margin:4px 0 10px">تکمیل سفارش</h3><div id="items"></div>' +
    '<label>نام و نام خانوادگی</label><input id="fName"><label>موبایل</label><input id="fPhone" inputmode="tel"><label>نشانی</label><textarea id="fAddr" rows="2"></textarea><label>توضیح (اختیاری)</label><input id="fNote">' +
    '<a class="send" href="#" onclick="send();return false;">📲 ارسال سفارش با واتساپ</a></div></div>' +
    '<script>' + js + '<\/script></body></html>';
}
function catalogModal() {
  var S = DB.settings;
  openModal('🛍 کاتالوگ آنلاین',
    '<p class="mut small" style="margin-top:0">از کالاهای فعلی‌تان یک صفحه فروشگاه تک‌فایلی ساخته می‌شود. فایل را روی هر هاستی آپلود کنید یا مستقیم برای مشتری بفرستید؛ مشتری سبد را پر می‌کند و سفارش به واتساپ شما می‌آید. پیام سفارش را با آی‌حساب به اشتراک بگذارید (یا در بخش فروش ← «ثبت سفارش آنلاین» بچسبانید) تا فاکتور فروش خودکار ثبت شود.</p>' +
    fRow('شماره واتساپ دریافت سفارش', '<input id="catWa" inputmode="tel" placeholder="مثلاً 09123456789" value="' + esc(S.catalogWa || S.shopPhone || '') + '">') +
    '<div class="row"><button class="btn grow" id="catPrev">👁 پیش‌نمایش</button><button class="btn gray grow" id="catSave">💾 ذخیره فایل کاتالوگ</button></div>' +
    '<div class="err" id="catErr"></div>',
    [{ label: 'بستن', cls: 'gray' }]);
  $('#catWa').addEventListener('change', function () { DB.settings.catalogWa = enDigits($('#catWa').value).replace(/\D/g, ''); saveDB(); });
  $('#catPrev').onclick = function () {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:200;background:#fff;display:flex;flex-direction:column';
    ov.innerHTML = '<div style="padding:10px;background:#0e9f6e;color:#fff;display:flex;justify-content:space-between;align-items:center"><b>پیش‌نمایش کاتالوگ</b><button id="catPrevX" style="background:#fff;border:none;border-radius:8px;padding:6px 14px;font-weight:700">بستن ✕</button></div>';
    var fr = document.createElement('iframe');
    fr.style.cssText = 'flex:1;border:none;width:100%';
    fr.srcdoc = buildCatalogHtml();
    ov.appendChild(fr);
    document.body.appendChild(ov);
    ov.querySelector('#catPrevX').onclick = function () { ov.remove(); };
  };
  $('#catSave').onclick = function () {
    DB.settings.catalogWa = enDigits($('#catWa').value).replace(/\D/g, ''); saveDB();
    var r = doSaveFile('catalog.html', buildCatalogHtml(), 'text/html');
    toast(r ? '💾 فایل catalog.html ذخیره شد (پوشه خروجی/دانلودها)' : 'ذخیره ممکن نشد');
  };
}
function normPhone(p) { return enDigits(String(p || '')).replace(/\D/g, ''); }
function parseCatalogOrder(text) {
  if (!text) return null;
  var t = String(text);
  var m = t.match(/\[IHESAB1:([A-Za-z0-9+/=]+)\]/);
  if (m) {
    try {
      var pl = JSON.parse(b64decodeUtf8(m[1]));
      var items = [];
      (pl.items || []).forEach(function (pair) {
        var p = prodById(pair[0]);
        var qty = Math.max(0, Math.min(9999, nd(pair[1])));
        if (p && qty > 0) items.push({ pid: p.id, qty: qty, price: Math.round(nd(p.sellPrice)) });
      });
      if (items.length) return { items: items, name: pl.name || '', phone: normPhone(pl.phone), addr: pl.addr || '', note: pl.note || '', via: 'code' };
    } catch (e) {}
  }
  /* جایگزین: تطبیق بر اساس کد کالا در متن آزاد */
  var items2 = [];
  var flat = enDigits(t);
  DB.products.forEach(function (p) {
    if (!p.code) return;
    var ix = flat.indexOf(String(p.code));
    if (ix < 0) return;
    var mm = flat.slice(ix, ix + 40).match(/[×x*]\s*(\d+)/);
    var qty = mm ? Math.max(1, nd(mm[1])) : 1;
    items2.push({ pid: p.id, qty: qty, price: Math.round(nd(p.sellPrice)) });
  });
  if (!items2.length) return null;
  var nm = t.match(/نام[:：]\s*([^\n]+)/);
  var ph = t.match(/موبایل[:：]\s*([0-9۰-۹\s]+)/);
  return { items: items2, name: nm ? nm[1].trim() : '', phone: ph ? normPhone(ph[1]) : '', addr: '', note: '', via: 'text' };
}
function importCatalogOrder(text) {
  var o = parseCatalogOrder(text);
  if (!o) return null;
  var person = null;
  if (o.phone) person = DB.persons.filter(function (p) { return normPhone(p.phone) === o.phone; })[0] || null;
  if (!person) {
    person = { id: newId('per'), name: o.name || 'مشتری آنلاین', kind: 'customer', phone: o.phone || '', address: o.addr || '', opening: 0, creditLimit: 0, note: 'ثبت خودکار از سفارش آنلاین' };
    DB.persons.push(person);
  }
  var r = createInvoice({
    kind: 'sale', personId: person.id, date: todayISO(),
    items: o.items.map(function (it) { return { pid: it.pid, qty: it.qty, price: it.price, disc: 0 }; }),
    gdisc: 0, tax: 0, shipping: 0,
    note: '🛍 سفارش آنلاین' + (o.addr ? ' · نشانی: ' + o.addr : '') + (o.note ? ' · ' + o.note : ''),
    paidBy: []
  });
  if (!r.ok) return null;
  saveDB();
  audit('ثبت خودکار فاکتور سفارش آنلاین', 'فاکتور ' + r.inv.no + ' · ' + person.name);
  return r.inv;
}
function orderImportModal(prefill) {
  openModal('📥 ثبت سفارش آنلاین',
    '<p class="mut small" style="margin-top:0">متن پیام سفارش مشتری (از واتساپ) را اینجا بچسبانید؛ فاکتور فروش، مشتری و ردیف‌ها به‌صورت خودکار ساخته می‌شوند. اگر پیام را در واتساپ با آی‌حساب به اشتراک بگذارید، این کار کاملاً خودکار انجام می‌شود.</p>' +
    fRow('متن سفارش', '<textarea id="ordText" rows="7" placeholder="متن سفارش را بچسبانید…">' + esc(prefill || '') + '</textarea>') +
    '<div class="err" id="ordErr"></div>',
    [
      { label: '🧾 ثبت خودکار فاکتور', cb: function (close) {
          var inv = importCatalogOrder(val('ordText'));
          if (!inv) { $('#ordErr').textContent = 'سفارش معتبر پیدا نشد؛ متن کامل پیام (همراه بلوک [IHESAB1]) را بچسبانید.'; return; }
          close(); refresh();
          toast('✅ فاکتور فروش شماره ' + inv.no + ' از سفارش آنلاین ثبت شد');
          setTimeout(function () { invoiceDetail(inv.id); }, 300);
        } },
      { label: 'انصراف', cls: 'gray' }
    ]);
}
function checkSharedText() {
  if (typeof Android === 'undefined' || !Android.takeSharedText) return;
  var t = Android.takeSharedText();
  if (!t) return;
  if (t.indexOf('IHESAB1') >= 0) {
    var inv = importCatalogOrder(t);
    if (inv) {
      refresh();
      toast('🛍 سفارش آنلاین رسید و فاکتور فروش شماره ' + inv.no + ' ثبت شد');
      setTimeout(function () { invoiceDetail(inv.id); }, 400);
    } else toast('سفارش اشتراکی خوانده نشد');
  }
}
