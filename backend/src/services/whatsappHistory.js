import twilio from 'twilio';
import { toE164 } from '../lib/twilioVerify.js';

// Read only: match both ends so other senders and clients are never included.
export async function getWhatsAppHistory(phone) {
  if (!phone) return { messages: [], unavailable: 'missing_phone' };
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_WHATSAPP_NUMBER: sender } = process.env;
  if (!sid || !token || !sender) return { messages: [], unavailable: 'missing_configuration' };
  const to = `whatsapp:${toE164(phone)}`, from = `whatsapp:${toE164(sender)}`;
  const provider = twilio(sid, token, { timeout: 15000 });
  const rows = await provider.messages.list({ to, from, limit: 51 });
  const matched = rows.filter(message => message.to === to && message.from === from);
  return {
    messages: matched.slice(0, 50).map(message => ({
      id: message.sid,
      body: message.body || '',
      status: message.status,
      createdAt: message.dateCreated,
      sentAt: message.dateSent,
      errorCode: message.errorCode || null,
      mediaCount: Number(message.numMedia) || 0,
    })),
    hasMore: matched.length > 50,
    checkedAt: new Date().toISOString(),
  };
}
