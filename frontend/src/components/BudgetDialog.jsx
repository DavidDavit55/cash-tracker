import {useEffect,useRef} from 'react';
export default function BudgetDialog({children,onClose,busy}){
 const ref=useRef(null);
 useEffect(()=>{const dialog=ref.current;const previous=document.activeElement;dialog.showModal();dialog.querySelector('input')?.focus();return()=>{dialog.close();previous?.focus();};},[]);
 return <dialog ref={ref} className="bw-budget-dialog" aria-labelledby="budget-dialog-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><h2 id="budget-dialog-title">עריכת תקציב חודשי</h2>{children}</dialog>;
}
