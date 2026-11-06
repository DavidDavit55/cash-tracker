export const bankClasses=['expense','income','transfer','card_payment','cash_withdrawal','review'];
export const bankLabelKey=label=>String(label||'').replace(/[\u200e\u200f]/g,'').replace(/\s+/g,' ').trim();
export function suggestBank(row,rules=[]){
 if(row.warning?.includes('עתידית')||row.warning?.includes('בקליטה'))return {...row,classification:'review',reason:row.warning};
 const rule=rules.find(r=>r.label_key===bankLabelKey(row.label)&&r.original_kind===row.kind&&r.source==='discount');
 if(rule)return {...row,classification:rule.classification,reason:'לפי סיווג שאישרת בעבר לתיאור ולכיוון תנועה זהים'};
 if(/כרטיס|ויזה|כאל|מקס איט|ישראכרט|חיוב ממקס/.test(row.label))return {...row,classification:'card_payment',reason:'חיוב כרטיס — פירוט עסקאות הכרטיס הוא שייספר בתקציב. ודא שהוא הועלה.'};
 if(/כספומט|משיכת מזומ|משיכה במזומ/.test(row.label))return {...row,classification:'cash_withdrawal',reason:'משיכת מזומן — יש להזין את ההוצאות ששולמו במזומן בנפרד'};
 if(/העבר|משיכ|הלוואה|פיקדון|פקדון/.test(row.label))return {...row,classification:'review',reason:'נדרש אישור שלך אם זו הוצאה, הכנסה או העברה בין חשבונות שלך'};
 return {...row,classification:row.kind,reason:'הצעה לפי כיוון התנועה בבנק — ניתן לשנות לפני השמירה'};
}
export async function rememberBank(db,user,row,classification){
 if(classification==='review')throw Object.assign(new Error('אי אפשר לזכור סיווג שעדיין דורש בדיקה'),{status:400});
 await db.query(`INSERT INTO budget_bank_rules(user_id,source,label_key,original_kind,classification) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,source,label_key,original_kind) DO UPDATE SET classification=$5,updated_at=now()`,[user,'discount',bankLabelKey(row.source_label||row.label),row.original_kind||row.kind,classification]);
}
// Ledger rows are projections of a retained bank source record.
export async function projectBank(db,user,row,classification,categoryId=null){
 let ledger=null;
 if(row.ledger_id){const table=row.ledger_kind==='expense'?'expenses':'incomes';
  if(!(await db.query(`SELECT id FROM ${table} WHERE id=$1 AND user_id=$2 FOR UPDATE`,[row.ledger_id,user])).rowCount)throw Object.assign(new Error('התנועה המקושרת השתנתה. יש לרענן לפני הסיווג'),{status:409});
  if(classification!==row.ledger_kind)await db.query(`DELETE FROM ${table} WHERE id=$1 AND user_id=$2`,[row.ledger_id,user]);
 }
 if(classification==='expense')ledger=(await db.query(row.ledger_id&&row.ledger_kind==='expense'?`UPDATE expenses SET amount=$3,merchant=$4,expense_date=$5,category_id=$6,updated_at=now() WHERE id=$2 AND user_id=$1 RETURNING *`:`INSERT INTO expenses(user_id,id,amount,merchant,expense_date,category_id,payment_method) VALUES($1,COALESCE($2::uuid,gen_random_uuid()),$3,$4,$5,$6,'בנק דיסקונט') RETURNING *`,[user,row.ledger_kind===classification?row.ledger_id:null,row.amount,row.label,row.date||row.movement_date,categoryId])).rows[0];
 if(classification==='income')ledger=(await db.query(row.ledger_id&&row.ledger_kind==='income'?`UPDATE incomes SET amount=$3,description=$4,income_date=$5,updated_at=now() WHERE id=$2 AND user_id=$1 RETURNING *`:`INSERT INTO incomes(user_id,id,amount,description,income_date,source,payment_method) VALUES($1,COALESCE($2::uuid,gen_random_uuid()),$3,$4,$5,'אחר','בנק דיסקונט') RETURNING *`,[user,row.ledger_kind===classification?row.ledger_id:null,row.amount,row.label,row.date||row.movement_date])).rows[0];
 if(classification==='income'&&!row.ledger_id&&row.source){ledger=(await db.query('UPDATE incomes SET source=$1,includes_vat=$2 WHERE id=$3 AND user_id=$4 RETURNING *',[row.source,!!row.includes_vat,ledger.id,user])).rows[0];}
 return ledger;
}

// Preserve MONEY's original Discount rules for automatic imports.
export function moneyBank(row){
 const card=['חיוב לכרטיס','מקס איט פי','חיוב כרטיס','ויזה כאל','ישראכרט','חיוב ממקס','חיוב זמני למפתח מזומן'].some(k=>row.label.includes(k));
 const excluded=row.kind==='income'&&['הלוואה','קבלת תשלום על יתרת זכות','תשלום ריבית','תשלום מס במקור','העברה מדוד'].some(k=>row.label.includes(k));
 const insurance=row.kind==='income'&&['איילון','הראל','פניקס','מגדל','כלל','מנורה','הפניקס','ביטוח','מבטחים','מיטב','הסתדרות','חבר'].some(k=>row.label.includes(k));
 return {...row,classification:card?'card_payment':excluded?'transfer':row.kind,source:insurance?'עמלות ביטוח':'אחר',includes_vat:insurance,reason:'לפי כללי הקליטה המקוריים של MONEY'};
}
