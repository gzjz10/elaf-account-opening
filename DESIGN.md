---
name: Elaf Account-Opening Tracker
description: Arabic-first, phone-first stage tracker in the Maqadeena palette with the Elaf logo.
colors:
  primary: "#1E6B3A"
  primary-deep: "#154F2B"
  secondary: "#3E9A8E"
  accent: "#E5B54A"
  accent-text: "#D9A43A"
  background: "#F7F1DC"
  surface: "#FFFDF6"
  ink: "#12301F"
  cream-2: "#EFE6C8"
  cream-line: "#E3D9BC"
  green-pale: "#DCEBDF"
  header-gradient: "#12301F → #154F2B → #1E6B3A"
  success: "#10b981"
  warning: "#f59e0b"
  danger: "#ef4444"
typography:
  ui: "Tajawal 400/500/700/800 (Google Fonts)"
---

# Design System: Elaf Account-Opening Tracker

## 1. Overview
Source of the palette: `baseer-erp/tenants/maqadeena/brand/brand.json` (Maqadeena).
Logo: Elaf (`assets/logo.png`, cropped from the company's file), always on a white
or cream tile, never recoloured. All tokens live as CSS custom properties in the
`:root` block at the top of `index.html` (`--primary`, `--accent`, `--card`,
`--border`, …). Change colours there, not inline.

## 2. Colors
- **Primary green `#1E6B3A`** — buttons, active nav, current stage dot, links.
- **Deep green `#154F2B` / ink `#12301F`** — header, transaction hero card, text.
- **Teal `#3E9A8E`** — secondary actions (print, info).
- **Gold `#E5B54A`** — accent only: header bottom rule, login card top rule,
  highlights. Never for body text on cream (use `#D9A43A` if text is unavoidable).
- **Cream `#F7F1DC` background, `#FFFDF6` cards, `#E3D9BC` borders.**
- Semantic: success green, warning amber (delays), danger red (delete, rejected).

## 3. Typography
Tajawal from Google Fonts. The Maqadeena brand fonts (Thmanyah Sans, Handicrafts)
are NOT used: their licence is unconfirmed and the repo is public. Swap in only
after the owner confirms the licence (self-host the .woff2 files in `assets/`).
Western digits everywhere; dates `yyyy-mm-dd`; money «75,000 ر.س».

## 4. Elevation
Soft green-tinted shadows (`--shadow-sm`, `--shadow-md`). Cards 16–20px radius.
The sticky header carries the strongest shadow.

## 5. Components
- **Metro line (مسار المعاملة)** — five dots for the stations; done = green, current
  = large deep green, delayed = red pulse, pending = cream.
- **Transaction card** — serial chip (`EL-YYYY-NNNN`), company, info row, status badge.
- **Bottom nav** — جديد · نشطة · مكتملة · المسار · إحصائيات · المستخدمون (admin).
- **Sync badge** — floating pill: «جاري الحفظ…», «✓ تم الحفظ», «خطأ في الحفظ».
- **Print views** — `printDetail()` and `printRoutes()` open a styled A4 page.

## 6. Do's and Don'ts
Do: keep tap targets ≥ 44px; test at 390px first; keep Arabic labels short.
Don't: add new colours outside these tokens; use English in the UI; hide state
behind colour alone (pair with a label).
