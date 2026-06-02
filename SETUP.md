# מעקב הוצאות מזומן — הוראות הפעלה

## פיתוח מקומי

### דרישות
- Node.js 20+
- PostgreSQL (או Docker)

### שלב 1: הפעלת מסד הנתונים

**עם Docker (קל יותר):**
```bash
docker-compose up db -d
```

**בלי Docker:**
- צור DB בשם `cashtracker` ב-PostgreSQL המקומי

### שלב 2: Backend

```bash
cd backend
cp .env.example .env
# ערוך .env והוסף DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY
npm install
npm run dev
```

### שלב 3: Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

גש ל: http://localhost:5173

---

## פריסה ל-Railway

### Backend
1. צור פרויקט חדש ב-Railway
2. הוסף PostgreSQL database לפרויקט
3. Deploy מ-GitHub → תיקיית `backend`
4. הגדר משתני סביבה:
   - `DATABASE_URL` — נוצר אוטומטית ע"י Railway Postgres
   - `JWT_SECRET` — מחרוזת אקראית ארוכה
   - `ANTHROPIC_API_KEY` — המפתח שלך
   - `FRONTEND_URL` — כתובת ה-frontend לאחר deploy
   - `NODE_ENV=production`

### Frontend
1. צור service חדש ב-Railway מ-GitHub → תיקיית `frontend`
2. Railway יזהה Vite אוטומטית
3. הגדר:
   - `VITE_API_URL` — כתובת ה-backend ב-Railway + `/api`

---

## OCR עם AI
הוספת `ANTHROPIC_API_KEY` ב-.env מאפשרת סריקה אוטומטית של קבלות.
ללא המפתח — האפליקציה עובדת אבל ללא OCR.
