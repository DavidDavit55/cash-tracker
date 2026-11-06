import api from '../api/client';
export async function archiveSourceFile(clientId,file,source) {
 const {data}=await api.post('/staging/files',await file.arrayBuffer(),{params:{clientId,source},headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name)}});
 return data;
}
export async function downloadSourceFile(file) {
 const {data}=await api.get('/staging/files/'+encodeURIComponent(file.id),{responseType:'blob'});
 const url=URL.createObjectURL(data),link=document.createElement('a');link.href=url;link.download=file.name;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
