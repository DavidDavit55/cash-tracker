import React from 'react';
import ProductReview from '../frontend/src/components/ProductReview.jsx';
import {reviewProducts,PARAMETERS,REVIEW_STATES} from '../frontend/src/lib/productReview.js';
import {orderedProducts} from './workflow-products.jsx';
export function clientReviewProducts(client){
 const data={pension_data:[],insurance_data:[]};
 for(const p of orderedProducts(client.products.filter(p=>!p.archived))){const savings=['פנסיה','השתלמות','גמל','גמל להשקעה'].includes(p.category);data[savings?'pension_data':'insurance_data'].push({id:p.id,category:p.category,name:p.name,provider:p.company,type:p.category==='פנסיה'?'pension':savings?'gemel':p.category==='ביטוח מנהלים'?'managers':'insurance',balance:p.balance,feeFromDeposit:p.depositFee,feeFromAccumulation:p.balanceFee,investmentTrack:p.track,monthlyDeposit:p.deposit,monthlyPremium:p.premium});}
 const products=reviewProducts(data).map(p=>({...p,inConsolidation:(client.consolidations||[]).some(g=>g.sourceIds?.includes(p.number)||g.targetProductId===p.number),number:client.products.find(x=>x.id===p.number)?.policy||p.number}));
 return products.map(p=>({...p,parameters:p.parameters.filter(k=>k!=='deposits')}));
}
export default function Recommendations({client,onChange,productId}){
 const products=clientReviewProducts(client).filter(p=>productId===undefined||p.key===productId);
 return <div className={'wf-inline-review'+(productId==='portfolio:basic-health'?' wf-basic-health':'')}><ProductReview products={products} assessments={client.assessments||{}} onChange={onChange}/></div>;
}
export function recommendationFor(client,id){
 const p=clientReviewProducts(client).find(p=>p.key.startsWith('[')&&JSON.parse(p.key)[3]===id);
 const entries=client.assessments?.[p?.key]||{};
 return {entries,text:Object.entries(entries).filter(([,v])=>v.status!=='unchecked').map(([k,v])=>`${PARAMETERS[k]}: ${v.note||REVIEW_STATES[v.status]}${k==='premium'&&['action','improve'].includes(v.status)&&v.proposedPremium!=null&&v.proposedPremium!==''?' · פרמיה מוצעת לחודש: '+v.proposedPremium+' ₪':''}`).join('\n')};
}
