/**
 * إيلاف الشرقية — نظام متابعة فتوحات الحساب · الخادم (Google Apps Script)
 *
 * الملف هذا يعيش داخل Google Sheet (Extensions ▸ Apps Script) وهو الـ API الوحيد للموقع.
 * التخزين: تبويبات الشيت نفسه + مجلد في Google Drive للمرفقات. ما فيه أي خدمة مدفوعة.
 *
 * أول مرة:
 *   1) شغّل setup() من المحرر ← ينشئ التبويبات ويطبع كلمة مرور admin في سجل التنفيذ (Execution log).
 *   2) Deploy ▸ New deployment ▸ Web app ▸ Execute as: Me ▸ Who has access: Anyone ▸ انسخ رابط /exec.
 *   3) الصق الرابط في API_URL داخل index.html.
 * بعد أي تعديل على هذا الملف: Deploy ▸ Manage deployments ▸ ✏️ ▸ Version: New version
 * (عشان يبقى نفس الرابط).
 */

// ===== الإعدادات =====
var SERIAL_PREFIX   = 'EL';
var DRIVE_FOLDER    = 'إيلاف — مرفقات فتوحات الحساب';
var SESSION_SECONDS = 6 * 60 * 60;   // أقصى مدة يسمح بها CacheService
var STATIONS        = ['المشتريات', 'الإدارة', 'الحسابات', 'السندات', 'مكتملة'];
var CERT_LABELS     = { PENDING: 'قيد الانتظار', APPROVED: 'مصدقة', NOT_REQUIRED: 'غير مطلوبة', REJECTED: 'مرفوضة' };
var VOUCHER_LABELS  = { ELECTRONIC: 'إلكتروني', PAPER: 'ورقي', NONE: 'بدون سند' };
var ROLE_LABELS     = { admin: 'مدير عام', viewer: 'مشاهد', department: 'قسم' };

// كل تبويب: الاسم + الأعمدة. key = اسم الحقل في الكود، title = عنوان العمود في الشيت.
// ترتيب الأعمدة هنا هو ترتيبها في الشيت — الأعمدة التقنية (id) في الآخر.
var SHEETS = {
  tx: { name: 'المعاملات', cols: [
    ['serial', 'الرقم التسلسلي'], ['company', 'المورد / الشركة'], ['txnum', 'رقم المعاملة'],
    ['date', 'التاريخ'], ['limit', 'الحد الائتماني (ر.س)'], ['voucherLabel', 'نوع السند'],
    ['certLabel', 'التصديقات'], ['stationName', 'المرحلة الحالية'], ['statusLabel', 'الحالة'],
    ['filesCount', 'عدد الملفات'], ['desc', 'الوصف'], ['archiveLoc', 'موقع الأرشفة'],
    ['archivePaths', 'المسارات الرقمية'], ['createdAt', 'أنشئت في'], ['updatedAt', 'آخر تحديث'],
    ['updatedBy', 'آخر تحديث بواسطة'], ['stationIdx', 'رقم المرحلة'], ['voucher', 'كود السند'],
    ['cert', 'كود التصديق'], ['completed', 'مكتملة'], ['id', 'المعرّف']
  ]},
  history: { name: 'السجل', cols: [
    ['serial', 'الرقم التسلسلي'], ['station', 'المرحلة'], ['time', 'الوقت'], ['note', 'الملاحظة'],
    ['filesCount', 'ملفات مرفقة'], ['by', 'بواسطة'], ['txId', 'معرّف المعاملة']
  ]},
  files: { name: 'المرفقات', cols: [
    ['serial', 'الرقم التسلسلي'], ['name', 'اسم الملف'], ['station', 'المرحلة'], ['date', 'التاريخ'],
    ['size', 'الحجم'], ['type', 'النوع'], ['url', 'الرابط'], ['txId', 'معرّف المعاملة']
  ]},
  users: { name: 'المستخدمين', cols: [
    ['username', 'اسم المستخدم'], ['name', 'الاسم'], ['roleLabel', 'الصلاحية'], ['deptLabel', 'القسم'],
    ['active', 'مفعّل'], ['role', 'كود الصلاحية'], ['department', 'رقم القسم'],
    ['salt', 'salt'], ['hash', 'hash']
  ]}
};

// ===== نقطة الدخول =====
// الموقع يرسل POST بـ Content-Type: text/plain (بدون CORS preflight) وجسم JSON: { action, token, ... }
function doPost(e) {
  var req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'طلب غير صالح' }); }
  try {
    if (req.action === 'login') return json_(login_(req));
    var me = session_(req.token);
    if (!me) return json_({ ok: false, error: 'انتهت الجلسة، سجّل الدخول من جديد', auth: false });
    var fn = ACTIONS[req.action];
    if (!fn) return json_({ ok: false, error: 'عملية غير معروفة: ' + req.action });
    return json_(fn(me, req));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return json_({ ok: true, msg: 'Elaf account-opening API is live' });
}

var ACTIONS = {
  bootstrap:   function (me)      { return { ok: true, me: publicUser_(me), users: listUsers_(), transactions: readAll_() }; },
  transactions:function (me)      { return { ok: true, transactions: readAll_() }; },
  nextSerial:  function (me)      { denyViewer_(me); return withLock_(function () { return { ok: true, serial: nextSerial_() }; }); },
  saveTx:      function (me, req) { return withLock_(function () { return saveTx_(me, req.tx); }); },
  deleteTx:    function (me, req) { requireAdmin_(me); return withLock_(function () { return deleteTx_(req.id); }); },
  upload:      function (me, req) { denyViewer_(me); return upload_(req); },
  users:       function (me)      { requireAdmin_(me); return { ok: true, users: listUsers_() }; },
  saveUser:    function (me, req) { requireAdmin_(me); return withLock_(function () { return saveUser_(req); }); },
  deleteUser:  function (me, req) { requireAdmin_(me); return withLock_(function () { return deleteUser_(me, req.username); }); },
  setPassword: function (me, req) {
    if (me.role !== 'admin' && req.username !== me.username) throw new Error('غير مسموح');
    return withLock_(function () { return setPassword_(req.username, req.password); });
  },
  logout:      function (me, req) { CacheService.getScriptCache().remove('s_' + req.token); return { ok: true }; }
};

// ===== الجلسات وكلمات المرور =====
function login_(req) {
  var username = String(req.username || '').trim().toLowerCase();
  var u = findUser_(username);
  if (!u || !isTrue_(u.active) || u.hash !== hash_(u.salt, String(req.password || ''))) {
    Utilities.sleep(600);   // يبطّئ التخمين
    return { ok: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
  }
  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('s_' + token, username, SESSION_SECONDS);
  return { ok: true, token: token, me: publicUser_(u) };
}

// يرجّع المستخدم من الشيت كل مرة — لو انحذف أو تغيّرت صلاحيته يطبّق فورًا.
function session_(token) {
  if (!token) return null;
  var username = CacheService.getScriptCache().get('s_' + token);
  if (!username) return null;
  var u = findUser_(username);
  return u && isTrue_(u.active) ? u : null;
}

function hash_(salt, password) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + password, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function newSalt_() { return Utilities.getUuid().replace(/-/g, ''); }

function randomPassword_() {
  var chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var out = '';
  for (var i = 0; i < 10; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function requireAdmin_(me) { if (me.role !== 'admin') throw new Error('هذه العملية للمدير العام فقط'); }
function denyViewer_(me)   { if (me.role === 'viewer') throw new Error('حساب المشاهد للعرض فقط'); }

// ===== المعاملات =====
function readAll_() {
  var txs = readRows_('tx'), hist = readRows_('history'), files = readRows_('files');
  var byId = {};
  var list = txs.map(function (r) {
    var tx = {
      id: r.id, serial: r.serial, company: r.company, txnum: String(r.txnum || ''),
      date: dateStr_(r.date), limit: Number(r.limit) || 0, voucher: r.voucher, cert: r.cert,
      desc: r.desc, archiveLoc: r.archiveLoc, archivePaths: r.archivePaths,
      stationIdx: Number(r.stationIdx) || 0, completed: isTrue_(r.completed),
      createdAt: isoStr_(r.createdAt), history: [], files: []
    };
    byId[tx.id] = tx;
    return tx;
  });
  hist.forEach(function (h) {
    var tx = byId[h.txId]; if (!tx) return;
    tx.history.push({ station: h.station, time: isoStr_(h.time), note: h.note, filesCount: Number(h.filesCount) || 0, by: h.by });
  });
  files.forEach(function (f) {
    var tx = byId[f.txId]; if (!tx) return;
    tx.files.push({ name: f.name, station: f.station, date: isoStr_(f.date), size: f.size, type: f.type, url: f.url });
  });
  // الأحدث أولًا — نفس ترتيب الواجهة
  list.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  return list;
}

function saveTx_(me, tx) {
  if (!tx || !tx.id) throw new Error('بيانات المعاملة ناقصة');
  denyViewer_(me);
  var sh = sheet_('tx');
  var rowIdx = findRow_(sh, 'tx', 'id', tx.id);
  var current = rowIdx ? rowObj_(sh, 'tx', rowIdx) : null;

  // صلاحيات القسم: ينشئ المشتريات فقط، ويعدّل القسم المعاملة اللي في مرحلته فقط.
  if (me.role === 'department') {
    var dept = Number(me.department);
    if (!current && dept !== 0) throw new Error('إنشاء المعاملات لقسم المشتريات فقط');
    if (current && (Number(current.stationIdx) !== dept || isTrue_(current.completed)))
      throw new Error('المعاملة ليست في مرحلة قسمك — حدّث الصفحة');
  }

  var stationIdx = Math.max(0, Math.min(4, Number(tx.stationIdx) || 0));
  var completed = tx.completed === true || stationIdx >= 4;
  var now = new Date();
  var row = {
    serial: tx.serial, company: tx.company, txnum: tx.txnum, date: tx.date, limit: Number(tx.limit) || 0,
    voucherLabel: VOUCHER_LABELS[tx.voucher] || '', certLabel: CERT_LABELS[tx.cert] || '',
    stationName: STATIONS[stationIdx], statusLabel: completed ? 'مكتملة' : 'قيد التنفيذ',
    filesCount: (tx.files || []).length, desc: tx.desc || '', archiveLoc: tx.archiveLoc || '',
    archivePaths: tx.archivePaths || '', createdAt: current ? current.createdAt : (tx.createdAt ? new Date(tx.createdAt) : now),
    updatedAt: now, updatedBy: me.name || me.username, stationIdx: stationIdx,
    voucher: tx.voucher || '', cert: tx.cert || '', completed: completed, id: tx.id
  };
  writeRow_(sh, 'tx', rowIdx, row);

  // السجل والمرفقات: إضافة فقط (append) — نضيف اللي مو موجود، فما يضيع شي لو اثنين حفظوا مع بعض.
  var seenH = keySet_(readRows_('history').filter(function (h) { return h.txId === tx.id; }), function (h) { return isoStr_(h.time) + '|' + h.note; });
  var newH = (tx.history || []).filter(function (h) { return !seenH[h.time + '|' + h.note]; }).map(function (h) {
    return { serial: tx.serial, station: h.station, time: new Date(h.time), note: h.note, filesCount: h.filesCount || 0, by: h.by || me.name || me.username, txId: tx.id };
  });
  appendRows_('history', newH);

  var seenF = keySet_(readRows_('files').filter(function (f) { return f.txId === tx.id; }), function (f) { return f.url; });
  var newF = (tx.files || []).filter(function (f) { return f.url && !seenF[f.url]; }).map(function (f) {
    return { serial: tx.serial, name: f.name, station: f.station || '', date: f.date ? new Date(f.date) : now, size: f.size || '', type: f.type || '', url: f.url, txId: tx.id };
  });
  appendRows_('files', newF);

  return { ok: true };
}

function deleteTx_(id) {
  ['history', 'files', 'tx'].forEach(function (k) {
    var sh = sheet_(k), col = colIndex_(k, k === 'tx' ? 'id' : 'txId');
    var last = sh.getLastRow(); if (last < 2) return;
    var vals = sh.getRange(2, col, last - 1, 1).getValues();
    for (var i = vals.length - 1; i >= 0; i--) if (vals[i][0] === id) sh.deleteRow(i + 2);
  });
  return { ok: true };
}

function nextSerial_() {
  var props = PropertiesService.getScriptProperties();
  var year = new Date().getFullYear();
  var key = 'counter_' + year;
  var n = Number(props.getProperty(key) || 0) + 1;
  props.setProperty(key, String(n));
  return SERIAL_PREFIX + '-' + year + '-' + ('000' + n).slice(-4);
}

// ===== المرفقات (Drive) =====
function upload_(req) {
  if (!req.data) throw new Error('الملف فاضي');
  var blob = Utilities.newBlob(Utilities.base64Decode(req.data), req.mimeType || 'application/octet-stream', req.filename || 'file');
  var dir = req.folder ? childFolder_(rootFolder_(), String(req.folder)) : rootFolder_();
  var file = dir.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var id = file.getId();
  var isImage = (req.mimeType || '').indexOf('image/') === 0;
  var url = isImage
    ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600'   // يظهر مباشرة داخل <img>
    : 'https://drive.google.com/file/d/' + id + '/view';
  return { ok: true, url: url };
}

function rootFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('drive_folder_id');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var f = DriveApp.createFolder(DRIVE_FOLDER);
  props.setProperty('drive_folder_id', f.getId());
  return f;
}

function childFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// ===== المستخدمين =====
function publicUser_(u) {
  return { username: u.username, name: u.name, role: u.role, department: u.department === '' || u.department === null ? null : Number(u.department) };
}

function listUsers_() {
  var out = {};
  readRows_('users').forEach(function (u) { if (isTrue_(u.active)) out[u.username] = publicUser_(u); });
  return out;
}

function findUser_(username) {
  if (!username) return null;
  var rows = readRows_('users');
  for (var i = 0; i < rows.length; i++) if (String(rows[i].username).toLowerCase() === username) return rows[i];
  return null;
}

function saveUser_(req) {
  var username = String(req.username || '').trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,}$/.test(username)) throw new Error('اسم المستخدم 3 أحرف على الأقل (إنجليزي/أرقام)');
  var role = ['admin', 'viewer', 'department'].indexOf(req.role) >= 0 ? req.role : 'department';
  var dept = role === 'department' ? Math.max(0, Math.min(3, Number(req.department) || 0)) : '';
  var sh = sheet_('users');
  var rowIdx = findRow_(sh, 'users', 'username', username);
  var current = rowIdx ? rowObj_(sh, 'users', rowIdx) : null;
  if (!current && (!req.password || String(req.password).length < 6)) throw new Error('كلمة المرور 6 أحرف على الأقل');
  var salt = current ? current.salt : newSalt_();
  var hash = current ? current.hash : '';
  if (req.password) {
    if (String(req.password).length < 6) throw new Error('كلمة المرور 6 أحرف على الأقل');
    salt = newSalt_(); hash = hash_(salt, String(req.password));
  }
  writeRow_(sh, 'users', rowIdx, userRow_(username, req.name || username, role, dept, salt, hash));
  return { ok: true, users: listUsers_() };
}

function deleteUser_(me, username) {
  if (username === me.username) throw new Error('ما تقدر تحذف حسابك الحالي');
  var sh = sheet_('users');
  var rowIdx = findRow_(sh, 'users', 'username', username);
  if (rowIdx) sh.deleteRow(rowIdx);
  return { ok: true, users: listUsers_() };
}

function setPassword_(username, password) {
  if (!password || String(password).length < 6) throw new Error('كلمة المرور 6 أحرف على الأقل');
  var sh = sheet_('users');
  var rowIdx = findRow_(sh, 'users', 'username', username);
  if (!rowIdx) throw new Error('المستخدم غير موجود');
  var u = rowObj_(sh, 'users', rowIdx);
  var salt = newSalt_();
  writeRow_(sh, 'users', rowIdx, userRow_(u.username, u.name, u.role, u.department, salt, hash_(salt, String(password))));
  return { ok: true };
}

function userRow_(username, name, role, dept, salt, hash) {
  var DEPTS = ['المشتريات', 'الإدارة', 'الحسابات', 'السندات'];
  return {
    username: username, name: name, roleLabel: ROLE_LABELS[role] || role,
    deptLabel: role === 'department' ? DEPTS[Number(dept)] : 'كل الأقسام',
    active: true, role: role, department: dept, salt: salt, hash: hash
  };
}

// ===== أدوات الشيت =====
function sheet_(key) {
  var def = SHEETS[key];
  var sh = SpreadsheetApp.getActive().getSheetByName(def.name);
  if (!sh) throw new Error('التبويب "' + def.name + '" غير موجود — شغّل setup()');
  return sh;
}

function colIndex_(key, field) {
  var cols = SHEETS[key].cols;
  for (var i = 0; i < cols.length; i++) if (cols[i][0] === field) return i + 1;
  throw new Error('عمود غير معروف: ' + field);
}

function readRows_(key) {
  var sh = sheet_(key), n = SHEETS[key].cols.length, last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, n).getValues().map(function (v) { return toObj_(key, v); })
    .filter(function (o) { return o[SHEETS[key].cols[0][0]] !== ''; });
}

function rowObj_(sh, key, rowIdx) {
  return toObj_(key, sh.getRange(rowIdx, 1, 1, SHEETS[key].cols.length).getValues()[0]);
}

function toObj_(key, vals) {
  var o = {};
  SHEETS[key].cols.forEach(function (c, i) { o[c[0]] = vals[i]; });
  return o;
}

function toVals_(key, obj) {
  return SHEETS[key].cols.map(function (c) { var v = obj[c[0]]; return v === undefined || v === null ? '' : v; });
}

function findRow_(sh, key, field, value) {
  var last = sh.getLastRow(); if (last < 2) return 0;
  var vals = sh.getRange(2, colIndex_(key, field), last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(value)) return i + 2;
  return 0;
}

function writeRow_(sh, key, rowIdx, obj) {
  var vals = [toVals_(key, obj)];
  if (rowIdx) sh.getRange(rowIdx, 1, 1, vals[0].length).setValues(vals);
  else sh.appendRow(vals[0]);
}

function appendRows_(key, objs) {
  if (!objs.length) return;
  var sh = sheet_(key);
  var vals = objs.map(function (o) { return toVals_(key, o); });
  sh.getRange(sh.getLastRow() + 1, 1, vals.length, vals[0].length).setValues(vals);
}

function keySet_(rows, fn) { var s = {}; rows.forEach(function (r) { s[fn(r)] = true; }); return s; }

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('النظام مشغول، جرّب بعد ثواني');
  try { return fn(); } finally { lock.releaseLock(); }
}

function isTrue_(v) { return v === true || v === 'TRUE' || v === 'true' || v === 'نعم'; }

function isoStr_(v) {
  if (v instanceof Date) return v.toISOString();
  return v ? String(v) : '';
}

function dateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v ? String(v) : '';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ===== الإعداد والصيانة (تشغَّل من المحرر أو من قائمة الشيت) =====
function setup() {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone('Asia/Riyadh');
  Object.keys(SHEETS).forEach(function (key) {
    var def = SHEETS[key];
    var sh = ss.getSheetByName(def.name) || ss.insertSheet(def.name);
    sh.setRightToLeft(true);
    var titles = def.cols.map(function (c) { return c[1]; });
    sh.getRange(1, 1, 1, titles.length).setValues([titles])
      .setFontWeight('bold').setBackground('#1E6B3A').setFontColor('#FFFDF6').setHorizontalAlignment('center');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, titles.length);
  });
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('ورقة1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);

  // الأعمدة التقنية تبقى موجودة بس مخفية، عشان الشيت يبان مرتب للإدارة.
  hideCols_('tx', ['stationIdx', 'voucher', 'cert', 'completed', 'id']);
  hideCols_('history', ['txId']);
  hideCols_('files', ['txId']);
  hideCols_('users', ['role', 'department', 'salt', 'hash']);
  sheet_('tx').getRange(2, colIndex_('tx', 'date'), 999, 1).setNumberFormat('yyyy-mm-dd');
  // نص صريح عشان الشيت ما يحذف الأصفار من بداية الأرقام
  sheet_('tx').getRange(2, colIndex_('tx', 'txnum'), 999, 1).setNumberFormat('@');
  sheet_('users').getRange(2, 1, 999, 1).setNumberFormat('@');

  // حساب admin: لو مو موجود ننشئه بكلمة مرور عشوائية تطلع في سجل التنفيذ.
  if (!findUser_('admin')) {
    var pw = randomPassword_(), salt = newSalt_();
    appendRows_('users', [userRow_('admin', 'المدير العام', 'admin', '', salt, hash_(salt, pw))]);
    var msg = '✅ تم الإعداد. الدخول: admin  /  كلمة المرور: ' + pw + '  (غيّرها من تبويب المستخدمين)';
    Logger.log(msg);
    try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  } else {
    Logger.log('✅ التبويبات جاهزة. حساب admin موجود من قبل.');
  }
  rootFolder_();
}

function hideCols_(key, fields) {
  var sh = sheet_(key);
  fields.forEach(function (f) { sh.hideColumns(colIndex_(key, f)); });
}

// لو نسيت كلمة مرور admin: شغّل هذي من المحرر ← كلمة جديدة تطلع في سجل التنفيذ.
function resetAdminPassword() {
  var pw = randomPassword_();
  setPassword_('admin', pw);
  Logger.log('🔑 كلمة مرور admin الجديدة: ' + pw);
  try { SpreadsheetApp.getUi().alert('كلمة مرور admin الجديدة: ' + pw); } catch (e) {}
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('إيلاف')
    .addItem('إعداد / إصلاح التبويبات', 'setup')
    .addItem('إعادة تعيين كلمة مرور admin', 'resetAdminPassword')
    .addToUi();
}
