# Feature Specification: Baseline — Account-Opening Tracker on Google Sheets

**Feature Branch**: `main` (baseline, already shipped)
**Created**: 2026-10-29
**Status**: Implemented
**Origin**: Ported from `gzjz10/qriyah_swalih` (Qween, Firebase) — UI and workflow
kept; the cloud layer replaced with Google Sheets + Apps Script; rebranded to Elaf
with the Maqadeena palette.

## User Scenarios & Testing

### User Story 1 — Procurement opens a request (P1)
Procurement fills company, credit limit, voucher type, certification status,
transaction number, date, description, attaches files, and saves.
**Acceptance**: a row appears in «المعاملات» with serial `EL-YYYY-NNNN`, stage
«المشتريات»; files land in Drive folder `<serial>` and in «المرفقات»; one row in «السجل».

### User Story 2 — A request moves through the departments (P1)
The department holding the request attaches its papers, adds a note, and moves it
forward (or back with a reason). After «السندات» it is «مكتملة».
**Acceptance**: each move appends one «السجل» row; only the department whose stage
it is (or admin) can move it — enforced by `Code.gs`.

### User Story 3 — Management follows up (P2)
Admin/viewer see all requests, the metro line per request, delays past the stage
SLA, statistics, and can print a single request or a filtered route report.

### User Story 4 — Admin manages users (P2)
Admin creates users (role + department), deletes them, and resets anyone's
password. Deleting a user ends their session on the next call.

### Edge Cases
- Two people save the same request at once → the row is last-write-wins, history
  and attachment rows from both are kept (append-only merge by time+note / url).
- Session expires (6h) → next call returns `auth:false`, the app logs out.
- Apps Script busy → `LockService` waits up to 20s, then shows «النظام مشغول».
- Leading zeros in رقم المعاملة are kept (column formatted as text).

## Requirements

- **FR-001** Data lives in a Google Sheet with tabs المعاملات / السجل / المرفقات / المستخدمين.
- **FR-002** Serials are issued by the server under a lock, per year.
- **FR-003** Passwords stored as salted SHA-256; never in the repo or in plain text.
- **FR-004** Every non-login action requires a valid session token.
- **FR-005** The client pulls changes from the sheet every 60s (not while a detail view is open).
- **FR-006** Hosting on GitHub Pages; total running cost 0.

## Success Criteria
- `node dev/smoke-test.js` passes (28 checks).
- Full create → 4 stages → completed flow works at 390px and 1280px widths.

## Known limits / ideas for next specs
- No email/WhatsApp notification when a request reaches a department.
- No per-branch scoping.
- Company names are inserted into HTML unescaped (internal users only); escape
  before exposing to outside users.
- Apps Script quota (free): ~20k URL calls/day and 6 min per call — far above this
  workload, but polling interval should stay ≥ 60s.
