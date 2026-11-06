from pathlib import Path
r=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
for name,old,new in [
('backend/app/services/office_integration.py',"p['policy']=policy.get('policy_number') or ''","p['policy']=p.get('operationsPolicyNumber') or policy.get('policy_number') or ''"),
('backend/app/services/simple_process.py',"if product:product['policy']=number","if product:product.update(policy=number,operationsPolicyNumber=number)"),
('backend/app/api/routes/simple_operations.py',"product['policy']=value","product.update(policy=value,operationsPolicyNumber=value)")]:
 p=r/name;s=p.read_text(encoding='utf-8');assert old in s;p.write_text(s.replace(old,new),encoding='utf-8')
