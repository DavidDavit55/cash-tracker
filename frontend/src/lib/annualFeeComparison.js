const number=v=>v!==''&&v!=null&&Number.isFinite(Number(v))?Number(v):null;
export function annualFeeComparison({balance,monthly,currentDeposit,currentBalance,offerDeposit,offerBalance}){
 const values=[balance,monthly,currentDeposit,currentBalance,offerDeposit,offerBalance].map(number);
 if(values.some(v=>v==null||v<0)||values.slice(2).some(v=>v>100))return null;
 const [opening,payment,cd,cb,od,ob]=values;
 function simulate(d,b){let amount=opening,depositFees=0,balanceFees=0;for(let m=0;m<12;m++){const df=payment*d/100;const net=payment-df;const bf=(amount+net/2)*b/1200;depositFees+=df;balanceFees+=bf;amount+=net-bf;}return {depositFees,balanceFees,total:depositFees+balanceFees,closing:amount};}
 const current=simulate(cd,cb),offer=simulate(od,ob);return {current,offer,saving:current.total-offer.total};
}

export function longTermFeeComparison({balance,monthly,currentDeposit,currentBalance,offerDeposit,offerBalance,months,annualReturn=4}){
 if(!Number.isInteger(months)||months<=0||months>720||!Number.isFinite(annualReturn)||annualReturn<=-100||annualReturn>30)return null;
 const check=annualFeeComparison({balance,monthly,currentDeposit,currentBalance,offerDeposit,offerBalance});if(!check)return null;
 const growth=Math.pow(1+annualReturn/100,1/12);
 function simulate(d,b){let amount=Number(balance);for(let m=0;m<months;m++){const net=Number(monthly)*(1-Number(d)/100);const beforeFee=amount*growth+net*Math.sqrt(growth);amount=beforeFee*(1-Number(b)/1200);}return amount;}
 const current=simulate(currentDeposit,currentBalance),offer=simulate(offerDeposit,offerBalance);return {current,offer,difference:offer-current};
}
