CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50) DEFAULT '💰',
  color VARCHAR(20) DEFAULT '#6366f1',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  description VARCHAR(500),
  merchant VARCHAR(255),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url VARCHAR(500),
  receipt_filename VARCHAR(255),
  ocr_raw TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, category_id, month, year)
);

-- Default categories (inserted per user on registration)
-- Done via application code

-- הכנסות
CREATE TABLE IF NOT EXISTS incomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  source VARCHAR(255),
  description VARCHAR(500),
  income_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50) DEFAULT 'העברה בנקאית',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- זיכרון קטגוריות לפי שם עסק
CREATE TABLE IF NOT EXISTS merchant_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  merchant VARCHAR(255) NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, merchant)
);

-- פרופיל לקוח NETWORTH (רישום עצמי + שאלון)
CREATE TABLE IF NOT EXISTS client_profiles (
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

-- נתוני מסלקה שיובאו ע"י הסוכן (גמל/פנסיה/ביטוחים), לקוח לקוח
CREATE TABLE IF NOT EXISTS client_financial_data (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pension_data JSONB,
  insurance_data JSONB,
  har_bituach_data JSONB,
  client_info JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- מיגרציה: har_bituach_data נוסף אחרי היצירה הראשונה של הטבלה
ALTER TABLE client_financial_data ADD COLUMN IF NOT EXISTS har_bituach_data JSONB;

-- מיגרציה: מצב משפחתי, הכנסה חודשית, והרשאות משיכת מידע חתומות (מסלקה/ייפוי כוח ביטוח/הר ביטוח)
-- - נוספו אחרי היצירה הראשונה של הטבלה.
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS marital_status VARCHAR(30);
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS monthly_income VARCHAR(30);
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS consent_maslaka BOOLEAN DEFAULT FALSE;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS consent_insurance_poa BOOLEAN DEFAULT FALSE;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS consent_har_bituach BOOLEAN DEFAULT FALSE;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS signature_data TEXT;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS signed_ip VARCHAR(45);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
-- מעבר ל-SMS-only: משתמשים קיימים שנרשמו לפני זה שמרו טלפון רק ב-client_profiles, לא ב-users -
-- בלי זה הם ננעלים מחוץ למערכת כי ההתחברות עכשיו לפי users.phone בלבד.
UPDATE users u SET phone = cp.phone FROM client_profiles cp WHERE cp.user_id = u.id AND u.phone IS NULL;

-- קבצי מקור גולמיים (ZIP מסלקה / Excel הר ביטוח) - נשמרים כדי שתיקון עתידי בפרסר יוכל
-- "לפרסר מחדש" קבצים שכבר הועלו, בלי לבקש מהלקוח או מהסוכן להעלות שוב.
-- user_id NULL להר ביטוח (קובץ אחד משותף לכמה לקוחות, לא שייך למישהו ספציפי).
CREATE TABLE IF NOT EXISTS raw_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  source VARCHAR(20) NOT NULL,
  filename VARCHAR(255),
  file_data BYTEA NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Agent review is tied to the current version of the imported client data.
ALTER TABLE client_financial_data ADD COLUMN IF NOT EXISTS review JSONB;
ALTER TABLE client_financial_data ADD COLUMN IF NOT EXISTS review_draft JSONB;
ALTER TABLE client_financial_data ADD COLUMN IF NOT EXISTS data_version UUID NOT NULL DEFAULT gen_random_uuid();

-- Questionnaire answers are full labels, some longer than 50 characters.
ALTER TABLE client_profiles
  ALTER COLUMN risk_tolerance TYPE TEXT,
  ALTER COLUMN investment_horizon TYPE TEXT,
  ALTER COLUMN financial_knowledge TYPE TEXT,
  ALTER COLUMN goals TYPE TEXT,
  ALTER COLUMN life_stage TYPE TEXT;

-- Budget imports: additive history only; existing ledger is unchanged.
CREATE TABLE IF NOT EXISTS budget_imports (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 user_id UUID NOT NULL REFERENCES users(id),
 source TEXT NOT NULL,
 filename TEXT NOT NULL,
 file_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'preview' CHECK (status IN ('preview','committed','undone')),
 preview JSONB NOT NULL,
 records JSONB NOT NULL DEFAULT '[]'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 committed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS budget_imports_active_file ON budget_imports(user_id,file_hash) WHERE status='committed';
-- Bank source records stay visible even when excluded from budget totals.
CREATE TABLE IF NOT EXISTS budget_bank_movements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id),
 source TEXT NOT NULL DEFAULT 'discount',
 source_label TEXT NOT NULL,
 raw_data JSONB NOT NULL DEFAULT '{}',
 original_kind TEXT NOT NULL CHECK(original_kind IN ('expense','income')),
 amount NUMERIC(10,2) NOT NULL CHECK(amount>0),
 movement_date DATE NOT NULL,
 label TEXT NOT NULL,
 classification TEXT NOT NULL CHECK(classification IN ('expense','income','transfer','card_payment','cash_withdrawal','review')),
 ledger_kind TEXT,
 ledger_id UUID,
 category_id UUID REFERENCES categories(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS budget_bank_owner_date ON budget_bank_movements(user_id,movement_date);
CREATE TABLE IF NOT EXISTS budget_bank_rules (
 user_id UUID NOT NULL REFERENCES users(id),
 source TEXT NOT NULL,
 label_key TEXT NOT NULL,
 original_kind TEXT NOT NULL,
 classification TEXT NOT NULL CHECK(classification IN ('expense','income','transfer','card_payment','cash_withdrawal')),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,source,label_key,original_kind)
);
