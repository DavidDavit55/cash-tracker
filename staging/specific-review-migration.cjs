const fs=require('node:fs');const file='frontend/src/components/ProductReview.jsx';let s=fs.readFileSync(file,'utf8');
if(!s.includes("from './SpecificReview'")){
 s="import {TrackReview,HealthReview} from './SpecificReview';\n"+s;
 s=s.replace("if(['depositFee','balanceFee'].includes(k))return", "if(editing&&k==='track')return <TrackReview key={k} entry={entry} current={p.values?.track} disabled={disabled} onChange={patch=>change(p,k,patch)}/>;if(editing&&p.scope==='portfolio')return <HealthReview key={k} parameter={k} entry={entry} disabled={disabled} onChange={patch=>change(p,k,patch)}/>;if(['depositFee','balanceFee'].includes(k))return");fs.writeFileSync(file,s);
}
