exec(open(__file__.replace('fix_test_fixtures.py','fix_four_flows.py'),encoding='utf-8').read().split('def backend(s):')[0])
edit('backend/tests/test_recruitment_simple.py',lambda s:replace(s,"('result',{}),('verify'","('result',{}),('policy',{'policy':'DEMO-123'}),('verify'"))
edit('backend/tests/test_assistant_queries.py',lambda s:replace(s,"'kind':'claim'","'policy':'DEMO-123','kind':'claim'"))
