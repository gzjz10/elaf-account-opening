// Local test server: runs the real Code.gs against in-memory fakes of the Google
// services (Sheet, Drive, Cache, Properties, Lock), and serves index.html wired to it.
// No Google account needed. Data lives in memory (and dev/local-db.json between runs).
//
//   node dev/local-server.js          → http://localhost:8787
//   node dev/local-server.js --reset  → start from an empty sheet
//
// Prints the admin password on first run (same as setup() does in the real sheet).

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 8787);
const DB_FILE = path.join(__dirname, 'local-db.json');
const UPLOADS = path.join(__dirname, 'uploads');

// ---------- fake Google services ----------
const state = (!process.argv.includes('--reset') && fs.existsSync(DB_FILE))
  ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8'), (k, v) => (typeof v === 'string' && /^\$date:/.test(v) ? new Date(v.slice(6)) : v))
  : { sheets: {}, order: [], props: {} };
const persist = () => fs.writeFileSync(DB_FILE, JSON.stringify(state, (k, v) => v, 2)
  .replace(/"(\d{4}-\d{2}-\d{2}T[^"]+Z)"/g, '"$date:$1"'));

// Google Sheets turns typed "2026-10-29" into a date, and plain digit strings into numbers.
// Dates must come from the Code.gs realm, or its `instanceof Date` checks fail.
let CtxDate = Date;
function coerce(v, fmt) {
  if (fmt === '@' || typeof v !== 'string') return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new CtxDate(v + 'T00:00:00+03:00');
  if (/^-?\d+(\.\d+)?$/.test(v) && v.length < 15) return Number(v);
  return v;
}

function makeSheet(name) {
  if (!state.sheets[name]) { state.sheets[name] = { rows: [], fmt: {} }; state.order.push(name); }
  const d = () => state.sheets[name];
  const sheet = {
    getName: () => name,
    getLastRow: () => d().rows.length,
    getRange: (r, c, nr = 1, nc = 1) => {
      const range = {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => {
          const row = d().rows[r - 1 + i] || []; const v = row[c - 1 + j]; return v === undefined ? '' : v;
        })),
        setValues: (vals) => {
          vals.forEach((row, i) => row.forEach((v, j) => {
            const rr = r - 1 + i; while (d().rows.length <= rr) d().rows.push([]);
            d().rows[rr][c - 1 + j] = coerce(v, d().fmt[c + j]);
          }));
          return range;
        },
        setNumberFormat: (f) => { for (let j = 0; j < nc; j++) d().fmt[c + j] = f; return range; },
      };
      ['setFontWeight', 'setBackground', 'setFontColor', 'setHorizontalAlignment'].forEach(m => { range[m] = () => range; });
      return range;
    },
    appendRow: (vals) => { d().rows.push(vals.map((v, j) => coerce(v, d().fmt[j + 1]))); },
    deleteRow: (r) => { d().rows.splice(r - 1, 1); },
    setRightToLeft: () => sheet, setFrozenRows: () => sheet, autoResizeColumns: () => sheet, hideColumns: () => sheet,
  };
  return sheet;
}

const cache = new Map();
const fakeFolder = (name) => ({
  getId: () => 'folder-' + name,
  getFoldersByName: (n) => { let done = false; return { hasNext: () => !done && (done = true), next: () => fakeFolder(name + '/' + n) }; },
  createFolder: (n) => fakeFolder(name + '/' + n),
  createFile: (blob) => {
    const id = crypto.randomUUID();
    fs.mkdirSync(UPLOADS, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS, id), blob.bytes);
    return { getId: () => id, setSharing: () => {} };
  },
});

const sandbox = {
  console,
  SpreadsheetApp: {
    getActive: () => ({
      getSheetByName: (n) => (state.sheets[n] ? makeSheet(n) : null),
      insertSheet: (n) => makeSheet(n),
      getSheets: () => state.order.map(makeSheet),
      deleteSheet: (s) => { delete state.sheets[s.getName()]; state.order = state.order.filter(x => x !== s.getName()); },
      setSpreadsheetTimeZone: () => {},
    }),
    getUi: () => { throw new Error('no UI in local server'); },
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (alg, str) => Array.from(crypto.createHash(alg).update(str, 'utf8').digest()).map(b => (b > 127 ? b - 256 : b)),
    getUuid: () => crypto.randomUUID(),
    base64Decode: (s) => Buffer.from(s, 'base64'),
    newBlob: (bytes, type, name) => ({ bytes, type, name }),
    sleep: () => {},
    formatDate: (date, tz, fmt) => new Date(date.getTime() + 3 * 3600e3).toISOString().slice(0, 10),
  },
  Session: { getScriptTimeZone: () => 'Asia/Riyadh' },
  CacheService: { getScriptCache: () => ({ get: k => cache.get(k) || null, put: (k, v) => cache.set(k, v), remove: k => cache.delete(k) }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => state.props[k] || null, setProperty: (k, v) => { state.props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  DriveApp: {
    Access: {}, Permission: {},
    getFolderById: (id) => fakeFolder(id.replace('folder-', '')),
    createFolder: (n) => fakeFolder(n),
  },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => ({ text: t }) }) },
  Logger: { log: (m) => console.log('[Code.gs]', m) },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'Code.gs'), 'utf8'), sandbox, { filename: 'Code.gs' });
CtxDate = vm.runInContext('Date', sandbox);
Object.values(state.sheets).forEach(sh => sh.rows.forEach(row => row.forEach((v, j) => { if (v instanceof Date) row[j] = new CtxDate(v.getTime()); })));
if (!state.sheets['المعاملات']) sandbox.setup();
persist();

// ---------- http ----------
// Uploaded files are saved to dev/uploads/ (their links still point at drive.google.com).
const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'POST' && url.pathname === '/api') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const out = sandbox.doPost({ postData: { contents: body } });
      persist();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(out.text);
    });
    return;
  }
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  let data = fs.readFileSync(file);
  if (rel === 'index.html') data = data.toString().replace('const API_URL = "";', `const API_URL = "http://localhost:${PORT}/api";`);
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(data);
}).listen(PORT, () => console.log(`Local server: http://localhost:${PORT}`));
