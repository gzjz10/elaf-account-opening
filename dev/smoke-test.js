// End-to-end check of Code.gs through the local server: login, roles, stage permissions,
// serials, uploads, concurrent edits, users. Run:  node dev/smoke-test.js
const { spawn } = require('child_process');
const path = require('path');

const PORT = 8799;
const API = `http://localhost:${PORT}/api`;
let failures = 0;
const check = (cond, label) => { console.log((cond ? '  ✓ ' : '  ✗ ') + label); if (!cond) failures++; };

async function call(action, payload = {}, token = '') {
  const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, token, ...payload }) });
  return res.json();
}

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'local-server.js'), '--reset'], { env: { ...process.env, PORT } });
  let out = '';
  server.stdout.on('data', d => { out += d; });
  server.stderr.on('data', d => process.stderr.write(d));
  for (let i = 0; i < 50 && !out.includes('Local server'); i++) await new Promise(r => setTimeout(r, 100));
  const adminPw = (out.match(/كلمة المرور: (\S+)/) || [])[1];

  try {
    console.log('Login');
    check(!(await call('login', { username: 'admin', password: 'wrong' })).ok, 'wrong password rejected');
    const admin = (await call('login', { username: 'Admin ', password: adminPw })).token;
    check(!!admin, 'admin logs in (username trimmed / case-insensitive)');
    check((await call('bootstrap', {}, 'bogus')).auth === false, 'bad token → auth:false');

    console.log('Users');
    for (const [u, role, department] of [['procurement', 'department', 0], ['idara', 'department', 1], ['viewer', 'viewer', null]])
      check((await call('saveUser', { username: u, password: 'pass1234', name: u, role, department }, admin)).ok, `create ${u}`);
    const proc = (await call('login', { username: 'procurement', password: 'pass1234' })).token;
    const idara = (await call('login', { username: 'idara', password: 'pass1234' })).token;
    const viewer = (await call('login', { username: 'viewer', password: 'pass1234' })).token;
    check(proc && idara && viewer, 'department + viewer log in');
    check(!(await call('saveUser', { username: 'x1x', password: 'pass1234', role: 'admin' }, proc)).ok, 'non-admin cannot create users');

    console.log('Transactions');
    const s1 = (await call('nextSerial', {}, proc)).serial, s2 = (await call('nextSerial', {}, proc)).serial;
    check(/^EL-\d{4}-0001$/.test(s1) && s2.endsWith('0002'), `serials ${s1}, ${s2}`);
    const now = new Date().toISOString();
    const tx = { id: 'tx-1', serial: s1, company: 'مؤسسة النور', limit: 50000, voucher: 'PAPER', cert: 'PENDING', txnum: '00123',
      date: '2026-10-29', desc: '', stationIdx: 0, createdAt: now, files: [], completed: false, archiveLoc: '', archivePaths: '',
      history: [{ station: 'المشتريات', time: now, note: 'تم إنشاء المعاملة', filesCount: 0 }] };
    check(!(await call('saveTx', { tx }, idara)).ok, 'idara cannot create');
    check(!(await call('saveTx', { tx }, viewer)).ok, 'viewer cannot create');
    check((await call('saveTx', { tx }, proc)).ok, 'procurement creates');
    const up = await call('upload', { folder: s1, filename: 'a.pdf', mimeType: 'application/pdf', data: Buffer.from('%PDF-1').toString('base64') }, proc);
    check(up.ok && /drive\.google\.com\/file\/d\//.test(up.url), 'upload returns a Drive link');

    let got = (await call('transactions', {}, proc)).transactions[0];
    check(got.txnum === '00123', 'leading zeros kept in رقم المعاملة');
    check(got.date === '2026-10-29', 'date round-trips (' + got.date + ')');
    check(got.history.length === 1, 'history row stored');

    tx.stationIdx = 1;
    tx.files = [{ name: 'a.pdf', size: '6 B', type: 'application/pdf', date: now, url: up.url, station: 'المشتريات' }];
    tx.history.push({ station: 'الإدارة', time: new Date(Date.now() + 1000).toISOString(), note: 'تم النقل من المشتريات', filesCount: 1 });
    check((await call('saveTx', { tx }, proc)).ok, 'procurement moves to الإدارة');
    check(!(await call('saveTx', { tx }, proc)).ok, 'procurement can no longer edit it');

    // Two stale copies each add a history line: both lines must survive.
    const a = JSON.parse(JSON.stringify(tx)), b = JSON.parse(JSON.stringify(tx));
    a.history.push({ station: 'الإدارة', time: new Date(Date.now() + 2000).toISOString(), note: 'ملاحظة أ', filesCount: 0 });
    b.history.push({ station: 'الإدارة', time: new Date(Date.now() + 3000).toISOString(), note: 'ملاحظة ب', filesCount: 0 });
    await call('saveTx', { tx: a }, idara); await call('saveTx', { tx: b }, admin);
    got = (await call('transactions', {}, viewer)).transactions[0];
    check(got.history.length === 4 && got.files.length === 1, 'concurrent history lines both kept, file not duplicated');
    check(got.stationIdx === 1 && got.completed === false, 'stage stored');

    tx.stationIdx = 4; tx.completed = true;
    check((await call('saveTx', { tx }, idara)).ok, 'idara (stage owner) can save');
    check(!(await call('deleteTx', { id: 'tx-1' }, idara)).ok, 'department cannot delete');
    check((await call('deleteTx', { id: 'tx-1' }, admin)).ok, 'admin deletes');
    check((await call('transactions', {}, admin)).transactions.length === 0, 'delete removes the transaction');

    console.log('Passwords');
    check((await call('setPassword', { username: 'idara', password: 'newpass99' }, admin)).ok, 'admin resets another user’s password');
    check((await call('login', { username: 'idara', password: 'newpass99' })).ok, 'new password works');
    check(!(await call('login', { username: 'idara', password: 'pass1234' })).ok, 'old password rejected');
    check((await call('deleteUser', { username: 'idara' }, admin)).ok && (await call('bootstrap', {}, idara)).auth === false, 'deleted user’s session dies');
  } finally {
    server.kill();
  }
  console.log(failures ? `\n${failures} failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})();
