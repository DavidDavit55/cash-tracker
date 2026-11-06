import test from 'node:test';
import assert from 'node:assert/strict';
import {openingCandidates,openingAttachment,reuseOpeningAnnex} from '../.local-preview/opening-mail.js';
import {recordOpening} from '../.local-preview/pension-flow.js';
test('only uniquely labelled account numbers become proposals',()=>{
 assert.equal(openingCandidates('תז 123456789 מספר חשבון: 123456').policy,'123456');
 assert.equal(openingCandidates('מספר חשבון: 123456 מספר פוליסה: 987654').policy,'');
 assert.equal(openingCandidates('123456789').policy,'');
 assert.equal(openingCandidates('מספר בנק: 12 מספר חשבון: 678680\nקרן הפנסיה שמספרה: 3535048080').policy,'3535048080');
});
test('attachment preserves workflow and requires review; annex reuse retains provenance',()=>{
 const d={transfer:{inactive:false},pensionFlow:{version:1,signedDate:'2026-01-01'}};
 const file={name:'proof.pdf',data:'data:application/pdf;base64,JVBERg==',mailId:'m',attachmentIndex:0};
 const next={...d,...openingAttachment(d,file)};
 assert.equal(next.pensionFlow.openingVerified,undefined);
 assert.throws(()=>recordOpening(next,{}),/התאמת/);
 assert.throws(()=>reuseOpeningAnnex(next));
 next.pensionFlow.openingDocumentReviewed=true;
 assert.deepEqual(reuseOpeningAnnex(next).transfer,{inactive:false,annex:file});
 assert.equal(openingAttachment(next,{...file,name:'other.pdf'}).pensionFlow.openingDocumentReviewed,false);
});
