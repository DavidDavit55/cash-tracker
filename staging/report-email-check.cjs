const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{const p=await b.newPage();const source=fs.readFileSync('.local-preview/maslaka-upload-owner.js','utf8').replace('export function','function');
 const result=await p.evaluate(source=>{const prepare=new Function(source+';return prepareMaslakaUpload;')();const xml='<Root><YeshutMaasik><E-MAIL>employer@example.com</E-MAIL></YeshutMaasik><YeshutLakoach><MISPAR-ZIHUY-LAKOACH>123456789</MISPAR-ZIHUY-LAKOACH><E-MAIL>CLIENT@example.com</E-MAIL></YeshutLakoach></Root>';const valid=prepare([{text:xml}],'123456789');let wrong=false;try{prepare([{text:xml}],'987654321');}catch{wrong=true;}return {emails:valid.customerEmails,wrong};},source);
 assert.deepEqual(result,{emails:['client@example.com'],wrong:true});console.log('PASS: only identity-matched customer email, employer excluded');
}finally{await b.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
