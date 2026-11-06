# עיצוב: רישום לקוחות + דשבורד מנהל (NETWORTH)

תאריך: 2026-09-16

## רקע ומטרה

NETWORTH פעל עד כה עם משתמש יחיד ונתוני mock. כדי לתמוך בכמה לקוחות אמיתיים, צריך:
1. תהליך הרשמה עצמאי ללקוח (self-serve)
2. אחסון אמיתי (DB) לפרופיל הלקוח
3. התראה לדוד כשלקוח נרשם, כדי שימשוך עבורו נתונים אמיתיים (מסלקה + הר ביטוח)
4. דשבורד מנהל בסיסי לדוד — רשימת כל הלקוחות שנרשמו

**מחוץ לסקופ בשלב זה:** שמירת נתוני המסלקה/ביטוח בפועל ב-DB לכל לקוח (כרגע הם ב-context בזיכרון הדפדפן בלבד, נמחקים ברענון). זה follow-up נפרד.

## זרימת הרשמה

3 מסכים + שאלון, ואז פתיחת האזור האישי:

1. **פרטים אישיים:** שם פרטי, שם משפחה, טלפון, אימייל, סיסמה
2. **זיהוי:** ת.ז, תאריך לידה, תאריך הנפקת ת.ז (נדרש לטפסי הרשאה מול מסלקה/הר ביטוח בעתיד)
3. **שאלון (5 שאלות, בחירה מרובה לא טקסט חופשי):**
   - סיבולת סיכון (risk tolerance)
   - אופק השקעה (investment horizon)
   - ידע פיננסי (financial knowledge)
   - מטרות (goals)
   - שלב בחיים (life stage)
4. **סיום:** יצירת המשתמש + הפרופיל, כניסה אוטומטית, מעבר למסך הראשי של NETWORTH (עדיין עם mock data עד שדוד יעלה נתונים אמיתיים דרך `/import`)

## מודל נתונים

טבלה חדשה `client_profiles`, בלי לגעת בטבלת `users` הקיימת (שמשמשת גם את אפליקציית ניהול המזומן הקיימת):

```sql
CREATE TABLE client_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  phone VARCHAR(20),
  id_number VARCHAR(20),
  birth_date DATE,
  id_issue_date DATE,
  risk_tolerance VARCHAR(50),
  investment_horizon VARCHAR(50),
  financial_knowledge VARCHAR(50),
  goals VARCHAR(50),
  life_stage VARCHAR(50),
  status VARCHAR(30) DEFAULT 'ממתין למשיכת מסלקה',
  created_at TIMESTAMP DEFAULT NOW()
);
```

`users.name`/`email`/`password_hash` ממשיכים לשמש כמו היום (register endpoint קיים) — הטבלה החדשה רק מוסיפה את השדות הספציפיים ל-NETWORTH.

## API חדש (backend)

- `POST /api/client-profile` — יוצר רשומת `client_profiles` ללקוח המחובר (אחרי הרשמה רגילה דרך `/api/auth/register` הקיים). מקבל: phone, id_number, birth_date, id_issue_date, וה-5 תשובות. לאחר יצירה — שולח התראת וואטסאפ לדוד.
- `GET /api/client-profile` — הפרופיל של המשתמש המחובר (לבדוק אם השלים הרשמה)
- `GET /api/admin/clients` — רשימת כל ה-`client_profiles` (JOIN עם users לשם/מייל). **מוגן**: רק אם `req.user.email` שווה למייל של דוד (env var `ADMIN_EMAIL`) — בלי טבלת roles מלאה, הכי פשוט שעונה על הצורך.

## התראה לדוד

שימוש **בבוט הוואטסאפ הקיים** (`backend/src/services/whatsapp.js`, כבר מחובר) — לא תשתית חדשה. פונקציה חדשה `notifyNewClient(profile)` ששולחת הודעה למספר של דוד (env var חדש `ADMIN_WHATSAPP_NUMBER`) דרך אותו `client.sendMessage()`.

מייל — **לא בשלב הזה**. אין שירות מייל בפרויקט; אפשר להוסיף בהמשך (Resend/SMTP) אם ירצה.

## Frontend

- מסך הרשמה קיים (`Register.jsx`) מורחב ל-wizard תלת-שלבי (או 3 קומפוננטות/steps בתוך דף אחד) + שלב שאלון רביעי
- `frontend/src/pages/AdminClients.jsx` — טבלה/רשימה של `GET /api/admin/clients`, מוגן ב-route (מוצג רק אם `user.email === ADMIN_EMAIL`, אחרת redirect)
- קישור לדשבורד המנהל בתפריט הצד (☰), מוצג רק לדוד

## מה לא בסקופ (להמשך)

- שמירת נתוני מסלקה/הר ביטוח ב-DB per-client (כרגע context בזיכרון בלבד)
- מייל בנוסף לוואטסאפ
- ניהול הרשאות מלא (roles table) — כרגע env var בודד מספיק
