import React from 'react';
import { createRoot } from 'react-dom/client';
import ReportLivePreview from './client-workspace.jsx';
import LeadWorkspace from './lead-workspace.jsx';
import WorkflowDemo from './workflow-demo.jsx?v=1';
import api from '../frontend/src/api/client.js';
import { filesFromUploads, processMaslakaFiles } from '../frontend/src/lib/maslakaCards.js';
import { parseHarBituach, groupHarBituachByPolicy } from '../frontend/src/lib/harBituachParser.js';

async function start() {
  const [har, maslaka] = await Promise.all(['/preview-source/har', '/preview-source/maslaka'].map(async url => {
    const response = await fetch(url); if (!response.ok) throw new Error('קובץ מקור לא זמין'); return response.arrayBuffer();
  }));
  const parsed = processMaslakaFiles(await filesFromUploads([new File([maslaka], 'source.zip')]), { includeEmptyAccounts: true });
  const rows = parseHarBituach(har);
  const policies = [...new Set(rows.map(r => r.company))].flatMap(company => groupHarBituachByPolicy(rows.filter(r => r.company === company)));
  const reports = [
    { id: 'maslaka', source: 'maslaka', as_of_date: '2026-05-31', issued_on: '2026-06-22', received_at: new Date().toISOString(), filename: 'מסלקה אבי — תצוגה מקומית.zip', payload: { pensionData: parsed.pensionCards, insuranceData: parsed.insuranceCards } },
    { id: 'har', source: 'har_bituach', as_of_date: '2026-02-12', issued_on: '2026-02-12', received_at: new Date().toISOString(), filename: 'הר הביטוח פברואר — תצוגה מקומית.xlsx', payload: { harBituachData: policies } },
  ];
  // All component API calls stay in this browser. No token, server save or live API.
  api.get = async url => url.endsWith('/file') ? { data: new Blob([url.includes('/maslaka/') ? maslaka : har]) } : { data: reports };
  api.post = api.put = api.delete = async () => { throw new Error('שמירה חסומה בתצוגה המקומית'); };
  createRoot(document.getElementById('root')).render(<ReportLivePreview reports={reports} originals={{ maslaka, har_bituach: har }} />);
}
if (location.hash === '#health-check') {
  import('./workflow-health-check.jsx').then(({default:HealthCheck})=>createRoot(document.getElementById('root')).render(<HealthCheck/>));
} else if (location.hash === '#sample-client') {
  start().catch(error => { document.getElementById('root').textContent = error.message; });
} else {
  createRoot(document.getElementById('root')).render(location.hash === '#legacy-leads' ? <LeadWorkspace/> : <WorkflowDemo/>);
}
