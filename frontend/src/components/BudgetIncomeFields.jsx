import {incomeSources} from '../lib/incomeSources';
export default function BudgetIncomeFields({form,onChange}){
 return <><label>קטגוריית הכנסה<select value={form.source||'אחר'} onChange={e=>onChange({...form,source:e.target.value})}>{[...new Set([...incomeSources,form.source].filter(Boolean))].map(s=><option key={s}>{s}</option>)}</select></label><label className="bw-check"><input type="checkbox" checked={!!form.includes_vat} onChange={e=>onChange({...form,includes_vat:e.target.checked})}/>הסכום כולל מע״מ (18%)</label>{form.includes_vat&&<small>ללא מע״מ: {(Number(form.amount||0)/1.18).toFixed(2)} ₪ · רכיב מע״מ: {(Number(form.amount||0)*18/118).toFixed(2)} ₪</small>}</>;
}
