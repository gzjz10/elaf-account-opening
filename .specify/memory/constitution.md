# Elaf Account-Opening Tracker Constitution

## Core Principles

### I. Zero Cost (NON-NEGOTIABLE)
The system runs on free tiers only: GitHub Pages (hosting), Google Sheets (data),
Google Apps Script (API), Google Drive (attachments). No feature may add a paid
service, a server, a database, or a subscription. If a feature needs one, it is
out of scope until the owner approves the cost in writing.

### II. Two Files Are the System
`index.html` (the whole client: HTML + CSS + vanilla JS) and `Code.gs` (the whole
server). No framework, no bundler, no build step, no npm dependencies in what ships.
A change that cannot be made by editing one of these two files needs a written
justification in its plan.

### III. The Sheet Is Readable
The Google Sheet is the source of truth AND a report management opens directly.
One row per transaction in «المعاملات»; stage moves append to «السجل»; attachments
append to «المرفقات». Arabic column titles, technical columns last and hidden.
Never store a JSON blob where a column would do. Never rewrite history rows —
append only.

### IV. Server Enforces Permissions
Every Apps Script action except `login` requires a session token. Role and stage
rules (admin / viewer / department 0–3) are checked in `Code.gs`, not only hidden
in the UI. Passwords are stored only as salted SHA-256 hashes. The repo is public:
no passwords, tokens, or personal data are ever committed.

### V. Arabic-First, Phone-First
All UI text is Arabic, RTL, with Western digits. Every screen works at 390px wide
before it is polished for desktop. Visual identity follows DESIGN.md (Maqadeena
palette, Elaf logo).

### VI. Verify Before Shipping
`node dev/smoke-test.js` must pass before any push to `main` (pushing deploys).
UI changes are checked in the browser via `node dev/local-server.js` at phone and
desktop widths. Changes to `Code.gs` also need a new Apps Script deployment version
(same `/exec` URL).

## Governance
This constitution overrides other guidance in the repo. Amendments are edits to
this file with a version bump and a one-line reason. `/speckit-plan` must include a
Constitution Check against principles I–VI.

**Version**: 1.0.0 | **Ratified**: 2026-10-29 | **Last Amended**: 2026-10-29
