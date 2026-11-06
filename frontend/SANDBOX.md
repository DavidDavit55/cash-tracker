## Full local registration and admin workflow (18/9/2026)

See [sandbox/WORKFLOW.md](sandbox/WORKFLOW.md) for the live SMS/WhatsApp test, local account storage, signatures and admin upload dashboard. Use `sandbox/start-workflow.ps1` to start with messaging credentials. `/sandbox-workflow/` is a separate local service; the existing production gateway `/sandbox-api/` remains read-only except its existing login operations. The "מתחילים כאן" button now opens `?register`; `?onboarding` remains the older prototype.

# NETWORTH Desktop Sandbox

## הפעלה

מתיקיית `frontend`:

```sh
npx --no-install vite --config vite.sandbox.config.mjs
```

כתובת: http://127.0.0.1:5175/sandbox.html

הדוגמה החזותית הקודמת נשארת ב־http://127.0.0.1:5174/desktop-demo.html כשהשרת הקודם פעיל.

## מה נשמר

ה־commit הפעיל ב־Railway NETWORTH אומת כ־`e8ea4d673941c7be5b369764bdbba1e65a00570f` בתאריך 18/09/2026.

תיקיית השימור בשורש הפרויקט: `.sandbox-backups/20260918-020247/`

- `production-source.zip`: קוד המאגר ב־commit של פריסת ה־Frontend הפעילה.
- `working-source.zip`: עותק קובצי המקור המקומיים לפני יצירת הסנדבוקס, כולל השינויים שטרם פורסמו והדוגמה הקודמת.
- `manifest.json`: מזהה ה־commit וגיבובי SHA-256 של הקבצים המקומיים.

אלו גיבויי קוד, לא גיבויי מסד נתונים. קובצי סביבה, סודות, node_modules וקבצים מוחרגים לא הועתקו. אין שינוי ב־App.jsx, בנתיבי המקור, ב־package.json או בפקודות הפריסה הרגילות. לא נוצרה פריסה ולא בוצע push. לשחזור יש לחלץ עותק לתיקייה חדשה, בלי לדרוס את סביבת העבודה.

## עבודה עם הנתונים הקיימים

1. בחר **חיבור נתונים** והתחבר עם הטלפון והקוד של החשבון הקיים.
2. **התיק שלי** מציג את הנתונים שהועלו לחשבון המחובר.
3. למנהל: **טעינת רשימת הלקוחות**, בחירת לקוח ו־**הצג בעיצוב החדש**. ההרשאה נאכפת ב־Backend הקיים.
4. אפשר להציג את רשימת קבצי המקור שהועלו ולפענח עותק מקומי שלהם, או לבחור קובצי ZIP/XML/XLSX מהמחשב.
5. קבצי הר הביטוח מרובי לקוחות מציגים בחירה. מיזוג בין מקור מסלקה להר הביטוח מותר רק כאשר מזהה הלקוח תואם.

טוקן הכניסה והנתונים נשמרים בזיכרון הלשונית בלבד. רענון מנקה אותם. אין העתקה של session האפליקציה המקורית, אין התחברות אוטומטית ואין טוקן קבוע בקוד.

## חיבורים קיימים שנעשה בהם שימוש

| יכולת | מקור | התנהגות בסנדבוקס |
| --- | --- | --- |
| התחברות SMS | `/auth/login/send`, `/auth/login/check` | רק בלחיצה מפורשת של המשתמש; שולח SMS אמיתי |
| נתוני לקוח | `/client-profile`, `/client-profile/financial-data` | קריאה בלבד |
| לקוחות מנהל | `/admin/clients`, `/admin/clients/:id`, `/admin/clients/:id/financial-data` | קריאה עם הרשאות השרת |
| קבצי מקור קיימים | `/admin/raw-uploads`, `/admin/raw-uploads/:id/file` | קריאה ופענוח בדפדפן; ללא שמירה מחדש |
| מסלקה והר הביטוח | `lib/maslakaCards.js`, הפרסרים הקיימים | פענוח קבצים מקומי ללא ייבוא לפרודקשן |
| מוצרים כפולים וסטטוס | `dedupById`, `statusWarning` | אותה לוגיקה קיימת |
| פנסיה־נט וגמל־נט | `pensionNetApi`, `categoryAverage` | טעינה אוטומטית בפתיחת פרטי מוצר; השוואה אוטומטית רק בהתאמת מסלול מדויקת, עם חיווי טעינה וניסיון חוזר במקרה שגיאה |
| דמי ניהול | `agencyFeeAgreements`, `pensionProjection` | הסכמי הסוכנות ומחשבון הפרישה הקיימים, ללא פרטי לקוח דמיוניים |
| הכנסות, הוצאות, תקציב וקטגוריות | GET של `/incomes`, `/expenses`, `/budgets`, `/categories` | קריאה של המשתמש המחובר בלבד; הוספת תנועה היא סימולציה בזיכרון |
| קביעת פגישה | `buildCalendlyLink` | הקישור הקיים, בלי פרטים אישיים בפרמטרים |

אין API קיים לצ׳אט פיננסי, להשוואת עמיתים או לסדרת הפקדות היסטורית במידע שנבדק. הסנדבוקס אינו ממציא אותן. במקום צ׳אט מדומה יש כניסה להסבר סביבת העבודה. גרף תחזית מסומן כתחזית ומופיע רק כאשר יש נתונים מלאים.

## בידוד

שרת Vite נפרד ב־127.0.0.1:5175, כניסת HTML נפרדת וקובץ הגדרות נפרד. נתיב `/sandbox-api/` הוא שער מוגבל ל־API הקיים. הוא מתיר רשימת GET סגורה ורק את שתי פעולות הכניסה. כל PUT/PATCH/DELETE ופעולות הייבוא, הרישום, OCR, WhatsApp וההתראות חסומים. השער בודק Origin של דפדפן ואינו מעביר cookies או מפנה בקשות ליעדים חלופיים.

שליחת טפסי קליטת לקוח, שינוי נתוני לקוח, ייבוא עסקאות לשרת, שליחת הודעות ו־OCR אינם מופעלים בסביבה הזאת. כדי לבדוק כתיבות אמיתיות בהמשך יש להקים Backend ומסד נתונים נפרדים, עם שירותי הודעות במצב בדיקה.

הבנייה הרגילה אינה כוללת את הכניסה הזו. ניתן לבדוק בנייה בלי לכתוב קבצים:

```sh
node --input-type=module -e "import {build} from 'vite'; await build({configFile:'vite.sandbox.config.mjs',build:{write:false}})"
node --test sandbox/safety.test.mjs
```

## טעינת קבצים בסנדבוקס

תיק יחיד מוצג אוטומטית כשלא טעון תיק אמיתי. קובץ נוסף בעל מזהה לקוח תואם מתמזג אוטומטית עם המוצרים הקיימים. קובץ מרובה לקוחות או לקוח אחר דורש בחירה מפורשת, והמסך גולל לתוצאות. שגיאות ופענוח מוצגים ליד בורר הקבצים. אפשר גם לגרור קבצים אליו.

תיקון הזרימה נבדק בדפדפן עם קובצי בדיקה סינתטיים: מסלקה XML, הר הביטוח XLSX, מיזוג אותו לקוח ובחירה בקובץ מרובה לקוחות. קובצי הבדיקה נמצאים ב־sandbox/fixtures ואינם נתוני לקוחות אמיתיים.


## Product detail panels
The sandbox adds recent deposits, disability and survivors panels, employer and product date fields. Demo-only values live in makeDemo. Real data never inherits demo values. Product dates are enriched on XML import using existing account date tags when the account is unambiguous. Coverage still needs validated source mapping; absent data is shown as missing. Dated deposit history is now mapped from PerutHafkadotMetchilatShana, grouping SCHUM-HAFKADA-SHESHULAM by CHODESH-SACHAR or TAARICH-ERECH-HAFKADA. Explicit transferring-fund or transfer-date fields exclude transfers from both deposit series. Last-deposit summary blocks are not added again. Undated salary rows stay in wage history only; non-salary unclassified rows and invalid amounts are reported separately. No recurring future contribution is inferred from history. Reloading the source file is necessary to enrich dates on an already imported portfolio.
Real retirement savings forecasts require monthlyDepositVerified=true; the legacy TOTAL-HAFKADA mapping is not sufficient. The shared production parser remains unchanged.


## Local onboarding prototype
Open `/sandbox.html?onboarding` or use the dashboard's "מתחילים כאן" button. Welcome, optional priorities, existing data connection, and a real snapshot summary lead to the first selected section. Back navigation retains selections in React memory. Existing file import and explicit SMS login are reused. This prototype does not implement account registration, signatures, or authorization collection; the original Register page remains unchanged. Demo snapshots are explicitly labeled. Refresh clears local session state as elsewhere in the sandbox.
