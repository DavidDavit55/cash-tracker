import twilio from 'twilio';
import { toE164 } from '../lib/twilioVerify.js';

// שולח דרך ה-WhatsApp sender הרשמי (Twilio+Meta), לא כמו whatsapp.js (session אישי לא רשמי).
// דורש: TWILIO_WHATSAPP_NUMBER (המספר הרשום) + Content SID מאושר ע"י Meta לכל סוג הודעה.
// אם אחד מהם חסר - מדלג בשקט ורק רושם ללוג, לא מפיל את הבקשה שגרמה להודעה.
function client() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

async function sendTemplate(to, contentSidEnvVar, contentVariables, approvedOverride) {
  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  const contentSid = approvedOverride || process.env[contentSidEnvVar];
  if (!from || !contentSid || !to) {
    console.log(`⚠️  WhatsApp (${contentSidEnvVar}): חסר ${!from ? 'TWILIO_WHATSAPP_NUMBER' : !contentSid ? contentSidEnvVar : 'יעד'} - לא נשלח`);
    return { status: "skipped", reason: !to ? "missing_phone" : "missing_configuration" };
  }
  try {
    const message = await client().messages.create({
      from: `whatsapp:${toE164(from)}`,
      to: `whatsapp:${toE164(to)}`,
      contentSid,
      contentVariables: JSON.stringify(contentVariables),
    });
    return { status: "accepted", messageId: message?.sid };
  } catch (err) {
    console.error(`WhatsApp send failed (${contentSidEnvVar}):`, err.message);
    return { status: "failed" };
  }
}

export function notifyAdminNewLead({ name, phone }) {
  return sendTemplate(process.env.ADMIN_WHATSAPP_NUMBER, 'TWILIO_CONTENT_SID_LEAD_ALERT', {
    1: name || 'לא ידוע',
    2: phone || 'לא צוין',
  });
}

export function notifyClientWelcome({ phone, name }) {
  return sendTemplate(phone, 'TWILIO_CONTENT_SID_WELCOME', { 1: name || '' });
}

export async function notifyClientNewRecommendations({ phone, name }) {
  const candidate = process.env.TWILIO_CONTENT_SID_RECOMMENDATIONS_WITH_LINK;
  let approvedSid;
  if (candidate && phone && process.env.TWILIO_WHATSAPP_NUMBER) {
    try {
      const approval = await client().content.v1.contents(candidate).approvalFetch().fetch();
      if (approval.whatsapp?.status === 'approved') approvedSid = candidate;
    } catch {
      console.warn('WhatsApp template approval check unavailable; using existing approved template');
    }
  }
  return sendTemplate(phone, 'TWILIO_CONTENT_SID_RECOMMENDATIONS', { 1: name || '' }, approvedSid);
}
