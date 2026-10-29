# نظام متابعة فتوحات الحساب — شركة إيلاف الشرقية التجارية

تطبيق ويب عربي يتابع كل طلب فتح حساب وهو يمشي على الأقسام:
**المشتريات ← الإدارة ← الحسابات ← السندات ← مكتملة**،
مع المرفقات وسجل الحركة وتنبيهات التأخير والطباعة.

- **التكلفة:** صفر. يشتغل على GitHub Pages + Google Sheets + Apps Script + Google Drive.
- **البيانات:** في Google Sheet مرتب: تبويب لكل نوع (المعاملات، السجل، المرفقات، المستخدمين).
- **الصيانة:** ملفين بس: `index.html` (الموقع) و `Code.gs` (الخادم داخل الشيت).

## التشغيل لأول مرة (5 دقايق)
1. سوّ **Google Sheet جديد** باسم «إيلاف — فتوحات الحساب».
2. من القائمة: **Extensions ▸ Apps Script**. امسح الكود الموجود، والصق محتوى `Code.gs` كامل، واحفظ (💾).
3. من القائمة المنسدلة فوق اختر `setup` واضغط **Run**. وافق على الصلاحيات
   (Advanced ▸ Go to … ▸ Allow). كلمة مرور `admin` بتطلع في **Execution log** وعلى الشيت نفسه.
4. **Deploy ▸ New deployment ▸** ⚙️ **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   ← **Deploy** ← انسخ رابط **Web app URL** (اللي ينتهي بـ `/exec`).
5. الصق الرابط في `index.html` مكان `const API_URL = "";` وارفع التعديل على `main`.
6. افتح الموقع، ادخل بـ `admin`، ومن تبويب **المستخدمون** أنشئ حسابات الأقسام
   (procurement، idara، accounts، vouchers، viewer) وغيّر كلمة مرور admin.

## التطوير المحلي (بدون حساب Google)
```bash
node dev/local-server.js --reset   # http://localhost:8787 ويطبع كلمة مرور admin
node dev/smoke-test.js             # 28 فحص للخادم — لازم يطلع "All checks passed"
```

## الشغل عليه بعدين
- **spec-kit:** `/speckit-specify` ← `/speckit-plan` ← `/speckit-tasks` ← `/speckit-implement`.
  الدستور في `.specify/memory/constitution.md`، والنسخة الحالية موثّقة في `specs/001-baseline/`.
- **impeccable:** `/impeccable audit` أو `/impeccable polish …`. يقرأ `PRODUCT.md` و `DESIGN.md`.
- تعديل `Code.gs`: الصقه في محرر Apps Script ثم **Deploy ▸ Manage deployments ▸ ✏️ ▸ New version**
  عشان يبقى نفس الرابط.

## الأمان
- كلمات المرور مخزنة **hash مع salt**. ما تنكتب في الكود ولا تبان في الشيت.
- كل طلب للخادم يحتاج جلسة دخول. الصلاحيات والمراحل يتحقق منها الخادم، مو الواجهة بس.
- الريبو عام، فلا ترفع فيه أي كلمة مرور أو بيانات شخصية.

مبني على نظام قوين (`qriyah_swalih`) بهوية مقاضينا البصرية.
