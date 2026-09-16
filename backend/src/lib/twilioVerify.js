import twilio from 'twilio';

export function verifyService() {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID);
}

// מספר ישראלי מקומי (05X-XXXXXXX) ל-E.164 (+9725XXXXXXXX) - Twilio Verify דורש E.164.
export function toE164(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('972')) return '+' + digits;
  if (digits.startsWith('0')) return '+972' + digits.slice(1);
  return '+' + digits;
}
