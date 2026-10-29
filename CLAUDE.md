# إيلاف الشرقية — Account-Opening Tracker

Single-file Arabic (RTL) web app tracking account-opening requests through four
departments: المشتريات → الإدارة → الحسابات → السندات → مكتملة.
Rules of the road: `.specify/memory/constitution.md` (zero cost, two files, readable
sheet, server-enforced permissions). Product/design context: `PRODUCT.md`, `DESIGN.md`.

## Files
- **`index.html`** — the whole client (HTML + CSS + vanilla JS). Only external
  dependency: the Tajawal font. Logo at `assets/logo.png`.
- **`Code.gs`** — the whole server: Google Apps Script bound to the Google Sheet.
  Deployed separately (not served by Pages).
- **`dev/local-server.js`** — runs the real `Code.gs` on in-memory fakes of Sheets/
  Drive/Cache and serves `index.html` wired to it (`http://localhost:8787`).
  Prints the local admin password on a fresh start (`--reset`).
- **`dev/smoke-test.js`** — 28 end-to-end API checks (roles, stages, serials,
  concurrency, passwords). Run before every push.

## Architecture
```
index.html (GitHub Pages) ──fetch POST text/plain {action, token, …}──► Code.gs web app
                                                         ├─► Google Sheet: المعاملات · السجل · المرفقات · المستخدمين
                                                         └─► Drive folder «إيلاف — مرفقات فتوحات الحساب»/<serial>/
```
- `API_URL` const in `index.html` = the Apps Script `/exec` URL (public; every call
  but `login` needs a session token from CacheService, 6h).
- Client keeps a localStorage mirror (`elaf_data`). `DB.save(list)` diffs against the
  last server snapshot (`synced`) and sends only changed transactions (`saveTx`) /
  removed ids (`deleteTx`). History and attachments are append-only on the server.
- `pollCloud()` re-pulls every 60s unless the detail view is open.
- Serials `EL-YYYY-NNNN` come from `nextSerial` (ScriptProperties counter, locked).

## Code map
- index.html: `api()`, `syncToCloud()`, `loadFromCloud()`, `pollCloud()`, `doLogin()`,
  `bootApp()`, `DB`, `createTx()`, `moveNext()`, `moveBack()`, `doClose()`,
  `saveUser()/deleteUser()/resetUserPassword()`, `printDetail()/printRoutes()`.
  Roles: `isAdmin()/isViewer()/isDept()/userDept()`, `canCreate()/canEditTx()`.
- Code.gs: `doPost` → `ACTIONS` table; `SHEETS` defines every tab and column
  (order = sheet order; add a column by adding a pair at the END of its list and
  re-running `setup()`, so existing rows stay aligned).

## Conventions
- Vanilla JS, global functions called from inline `onclick=` — match it.
- Arabic UI strings, RTL, Western digits. Colours only via the `:root` tokens.
- Keep the repo free of secrets (it is public for free Pages).

## Working here
```bash
node dev/local-server.js --reset   # fresh local sheet, prints admin password
node dev/smoke-test.js             # must print "All checks passed"
```
Deploy: push to `main` → GitHub Pages (1–3 min). After editing `Code.gs`: paste it
into the sheet's Apps Script editor → Deploy ▸ Manage deployments ▸ ✏️ ▸ New
version (keeps the same `/exec` URL).

## Gotchas
- Apps Script web app: Execute as **Me**, access **Anyone** — otherwise fetch gets a
  Google login page instead of JSON.
- Send requests as `text/plain`; `application/json` triggers a CORS preflight Apps
  Script can't answer.
- Forgot the admin password: run `resetAdminPassword()` in the Apps Script editor
  (or the «إيلاف» menu in the sheet).

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
