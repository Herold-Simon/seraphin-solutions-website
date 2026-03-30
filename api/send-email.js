/**
 * Vercel Serverless: E-Mail über Zoho Mail REST API (OAuth), kein SMTP.
 * Body (JSON): to, subject, htmlBody — optional fromEmail, fromName
 * Umgebung: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ACCOUNT_ID, optional ZOHO_DEFAULT_FROM_EMAIL / ZOHO_DEFAULT_FROM_NAME
 */
const { sendEmailViaZoho } = require('./lib/zoho-mail-oauth');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.',
    });
  }

  try {
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { to, subject, htmlBody, fromEmail, fromName } = body;

    if (
      to === undefined ||
      to === null ||
      to === '' ||
      subject === undefined ||
      subject === null ||
      htmlBody === undefined ||
      htmlBody === null
    ) {
      return res.status(400).json({
        success: false,
        error: 'Pflichtfelder: to, subject, htmlBody',
      });
    }

    await sendEmailViaZoho({ to, subject, htmlBody, fromEmail, fromName });

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('send-email:', e);
    return res.status(500).json({
      success: false,
      error: e.message || 'E-Mail-Versand fehlgeschlagen',
    });
  }
};
