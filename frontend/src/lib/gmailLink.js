// Gmail identifiers belong to a mailbox; never use the CRM row UUID as a message ID.
export function gmailLink({mailbox,message_id,metadata={}}={}){
 if(typeof mailbox!=='string'||!/^\S+@[^\s@]+\.[^\s@]+$/.test(mailbox))return null;
 const id=message_id||metadata.threadId;
 if(typeof id!=='string'||!/^[a-f0-9]{8,32}$/i.test(id))return null;
 return 'https://mail.google.com/mail/?authuser='+encodeURIComponent(mailbox)+'#all/'+id;
}
