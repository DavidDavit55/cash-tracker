export function payrollText({name,identity},f){
 return `מצ״ב טופס קוביות ונספח ו׳ ל${name}, ת״ז ${identity||'לא הוזנה'}.\nלהפקדות החל משכר ${f.salaryMonth||'שטרם נבחר'}, אודה לטיפולכם ולעדכונכם במייל חוזר.\n\nדוד · NETWORTH`;
}
