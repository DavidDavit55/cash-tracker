import React from 'react';
import {kitFor} from './workflow-process.js';
import {processDocuments} from './process-documents.js';
export default function ProcessDocuments({decisions}){
 return decisions.map(d=>{const docs=processDocuments(d,kitFor(d));return docs.length?<section key={d.id}><h3>{d.action} · {d.target}</h3>{docs.map((doc,i)=><div className="wf-list-row" key={i}><div><b>{doc.label}</b><p>{doc.file.simulated?'מסמך דמה בלבד':'קובץ שמור בתיק'} · {doc.file.name}</p></div><a href={doc.file.data} download={doc.file.name}>הורדת המסמך</a></div>)}</section>:null;});
}
