import 'dotenv/config';
import pg from 'pg';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
try {
 await pool.query('BEGIN READ ONLY');
 const {rows}=await pool.query("SELECT id,email,name,phone FROM users WHERE lower(email)=lower($1) OR regexp_replace(regexp_replace(phone,'[^0-9]','','g'),'^(00972|972)','0')=$2",['daviddavit55@gmail.com','0532556099']);
 for(const u of rows){u.counts={};for(const table of ['expenses','incomes','budgets','categories','merchant_categories','client_profiles','client_financial_data']){const r=await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE user_id=$1`,[u.id]);u.counts[table]=r.rows[0].n;}}
 console.log(JSON.stringify(rows,null,2));
 await pool.query('ROLLBACK');
}catch(e){console.error(e.code||e.message);process.exitCode=1;}finally{await pool.end();}
