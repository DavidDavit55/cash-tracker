import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  ...(process.env.APP_ENV === 'staging' ? {connectionTimeoutMillis:5000, statement_timeout:30000} : {}),
});

if (process.env.APP_ENV === 'staging') pool.on('error', () => {
  console.error('Staging database idle connection failed; pool will replace it.');
});

export default pool;
