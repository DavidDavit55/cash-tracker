import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

export async function sendNewClientEmail({ name, phone, email }) {
  const to = process.env.ADMIN_EMAIL;
  const t = getTransporter();
  if (!t || !to) {
    console.log('⚠️  SMTP_USER/SMTP_PASS/ADMIN_EMAIL לא מוגדרים — לא נשלח מייל');
    return;
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject: '📋 לקוח חדש נרשם ב-NETWORTH',
      text: `שם: ${name || 'לא ידוע'}\nטלפון: ${phone || 'לא צוין'}\nמייל: ${email || 'לא ידוע'}`,
    });
  } catch (err) {
    console.error('Email notify failed:', err.message);
  }
}
