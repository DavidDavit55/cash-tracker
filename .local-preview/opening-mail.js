// Extraction supplies candidates only, never proof of opening or customer identity.
export function openingCandidates(text){
 const values=String(text).split(/\n/).filter(line=>!/(?:בנק|סניף|מוטב|העברה בנקאית)/.test(line)).flatMap(line=>[...line.matchAll(/(?:מספר\s*(?:חשבון|פוליסה)|חשבון\s*מס[׳'"״]?|קרן\s*הפנסיה\s*שמספרה)[\s:־-]*(\d[\d/-]{2,24})/g)].map(m=>m[1]));
 const policies=[...new Set(values)];
 return {policy:policies.length===1?policies[0]:'',ambiguous:policies.length>1};
}
export function openingAttachment(d,file){
 return {pensionFlow:{...d.pensionFlow,openingDocument:file,openingDocumentReviewed:false}};
}
export function reuseOpeningAnnex(d){
 const file=d.pensionFlow?.openingDocument;
 if(!file||file.simulated||!d.pensionFlow.openingDocumentReviewed)throw Error('יש לבדוק שהמסמך הוא נספח ו׳ של הלקוח וקופת היעד.');
 return {transfer:{...d.transfer,annex:file}};
}
