# Product

## Register

product

## Product Purpose

Internal tracker for شركة إيلاف الشرقية التجارية. Every supplier/customer
account-opening request (فتح حساب) is a transaction that moves through four
departments: **المشتريات ← الإدارة ← الحسابات ← السندات ← مكتملة**. Each stage
attaches its documents, leaves a note, and hands over. The system answers three
questions at a glance: where is each request now, who is holding it too long
(SLA per stage: 24h / 24h / 48h / 12h), and what was attached at each step.

## Users

- **Procurement staff** (`procurement`, department 0): open new requests, attach
  the first documents (CR, VAT, national address…), send to administration.
- **Administration / Accounts / Vouchers staff** (departments 1–3): see only the
  requests sitting in their stage, attach their papers, move forward or send back
  with a reason.
- **Admin** (general manager): sees everything, manages users and passwords,
  deletes, prints route reports.
- **Viewer**: read-only, everything.

Mostly on phones in the office or on the floor; the admin also uses a laptop.
Mixed ages and comfort with tech — big tap targets, short Arabic labels, numbers
and stage dots carry meaning.

## Brand

Company: شركة إيلاف الشرقية التجارية (logo in `assets/logo.png`).
Visual language: the Maqadeena identity — deep green, teal, gold accent on warm
cream, see DESIGN.md. Calm, trustworthy, document-like; not playful.

## Tone

Plain Gulf-friendly Modern Standard Arabic. Short imperative buttons
(«نقل للمحطة التالية», «طباعة»). Confirmation before anything destructive. Errors
say what happened and what to do.

## Anti-references

- Generic SaaS dashboards with purple gradients and English labels.
- Dense tables on phones.
- Decorative emoji in place of state (state is shown by stage dots and badges).

## Strategic Principles

1. Zero cost, two files (see constitution).
2. The Google Sheet must stay readable by management without the app.
3. Speed of handover beats features: every screen should get a request to the
   next department in as few taps as possible.
