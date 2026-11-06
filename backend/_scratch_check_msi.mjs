import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const { rows } = await pool.query(`
  SELECT u.id, u.email, u.name, cfd.pension_data
  FROM users u LEFT JOIN client_financial_data cfd ON cfd.user_id = u.id
  WHERE u.email = 'bokobzh1234@gmail.com'
`);
console.log(JSON.stringify(rows, null, 2));
await pool.end();
