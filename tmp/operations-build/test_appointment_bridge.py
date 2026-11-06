from pathlib import Path
p=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations\backend\tests\test_recruitment_simple.py')
s=p.read_text(encoding='utf-8')
s=s.replace('def test_sale_transaction_links_existing_client_and_retry(db_session,monkeypatch):',"@pytest.mark.parametrize('appointment',[False,True])\ndef test_sale_transaction_links_existing_client_and_retry(db_session,monkeypatch,appointment):")
s=s.replace("r=sales.create_sale(db,payload);assert r['office_process_id']", "payload['is_appointment']=appointment\n r=sales.create_sale(db,payload);assert r['office_process_id']")
s=s.replace("assert saved['simpleOperations'] is True", "assert saved['simpleOperations'] is True\n assert saved['simpleProcesses'][0]['kind']==('appointment' if appointment else 'production')\n assert saved['simpleProcesses'][0]['state']=='new'")
p.write_text(s,encoding='utf-8')
