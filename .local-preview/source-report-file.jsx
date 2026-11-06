import React,{useState} from 'react';
import {downloadSourceFile} from '../frontend/src/lib/stagingFiles.js';
export default function SourceReportFile({report}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function download(){setBusy(true);setError('');try{await downloadSourceFile(report.sourceFile);}catch{setError('ההורדה לא הושלמה. אפשר לנסות שוב.');}finally{setBusy(false);}}
 return <div>{report.sourceFile?.storage==='staging-private'?<button type="button" className="secondary" disabled={busy} onClick={download}>{busy?'מוריד…':'הורדת קובץ המקור'}</button>:<small className="wf-muted">קובץ המקור לא נשמר בגרסה הישנה / בדמו המקומי.</small>}{error&&<p role="alert">{error}</p>}</div>;
}
