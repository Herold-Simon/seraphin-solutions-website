/**
 * Zoho Mail REST API (EU) mit OAuth 2.0 Refresh Token — kein SMTP.
 * Siehe: https://www.zoho.com/mail/help/api/post-send-an-email.html
 */

function normalizeEnvString(raw) {
  if (raw == null) return '';
  let s = String(raw).trim();
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/[\u200B-\u200D\uFEFF]/g, '');
}

function buildFromAddress(fromEmail, fromName) {
  const email = normalizeEnvString(fromEmail);
  if (!email) return '';
  const name = normalizeEnvString(fromName);
  if (name) {
    return `"${name.replace(/"/g, '')}" <${email}>`;
  }
  return email;
}

async function getZohoAccessToken() {
  const clientId = normalizeEnvString(process.env.ZOHO_CLIENT_ID);
  const clientSecret = normalizeEnvString(process.env.ZOHO_CLIENT_SECRET);
  const refreshToken = normalizeEnvString(process.env.ZOHO_REFRESH_TOKEN);
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Zoho OAuth: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET und ZOHO_REFRESH_TOKEN müssen in den Umgebungsvariablen gesetzt sein.'
    );
  }

  const tokenBase =
    normalizeEnvString(process.env.ZOHO_ACCOUNTS_BASE) || 'https://accounts.zoho.eu';
  const tokenUrl = `${tokenBase.replace(/\/$/, '')}/oauth/v2/token`;

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  let data = {};
  try {
    data = await res.json();
  } catch (_) {
    /* ignore */
  }

  if (!res.ok) {
    const detail =
      data.error_description || data.error || JSON.stringify(data) || res.statusText;
    throw new Error(`Zoho OAuth token ${res.status}: ${detail}`);
  }
  if (!data.access_token) {
    throw new Error('Zoho OAuth: Kein access_token in der Antwort.');
  }
  return data.access_token;
}

async function sendZohoMailMessage({
  accessToken,
  accountId,
  fromAddress,
  toAddress,
  subject,
  content,
  mailFormat = 'html',
}) {
  const mailBase =
    normalizeEnvString(process.env.ZOHO_MAIL_API_BASE) || 'https://mail.zoho.eu';
  const url = `${mailBase.replace(/\/$/, '')}/api/accounts/${accountId}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fromAddress,
      toAddress,
      subject,
      content,
      mailFormat,
    }),
  });

  let data = {};
  try {
    data = await res.json();
  } catch (_) {
    /* ignore */
  }

  if (!res.ok) {
    const detail =
      (data && data.data && data.data.errorCode) ||
      data.message ||
      data.error ||
      JSON.stringify(data) ||
      res.statusText;
    throw new Error(`Zoho Mail API ${res.status}: ${detail}`);
  }
  return data;
}

/**
 * Ein oder mehrere Empfänger: pro Adresse eine API-Anfrage (wie n separate Mails).
 * @param {{ to: string|string[], subject: string, htmlBody: string, fromEmail?: string, fromName?: string }} opts
 */
async function sendEmailViaZoho(opts) {
  const { to, subject, htmlBody, fromEmail, fromName } = opts;
  const accountId = normalizeEnvString(process.env.ZOHO_ACCOUNT_ID);
  if (!accountId) {
    throw new Error('ZOHO_ACCOUNT_ID fehlt — Zoho-Mail-Konto-ID in den Umgebungsvariablen setzen.');
  }

  const defaultFrom = normalizeEnvString(
    process.env.ZOHO_DEFAULT_FROM_EMAIL ||
      process.env.ZOHO_MAIL_FROM ||
      process.env.ZOHO_SMTP_USER
  );
  const defaultName = normalizeEnvString(
    process.env.ZOHO_DEFAULT_FROM_NAME || process.env.ZOHO_MAIL_FROM_NAME
  );

  let fromAddress;
  if (normalizeEnvString(fromEmail)) {
    fromAddress = buildFromAddress(fromEmail, fromName);
  } else {
    fromAddress = buildFromAddress(defaultFrom, fromName !== undefined ? fromName : defaultName);
  }
  if (!fromAddress) {
    throw new Error(
      'Absender fehlt: ZOHO_DEFAULT_FROM_EMAIL oder ZOHO_MAIL_FROM (oder ZOHO_SMTP_USER) in Vercel setzen — dieselbe Mailbox wie bei der OAuth-App.'
    );
  }

  const rawTo = Array.isArray(to) ? to : String(to).split(/[,;]/);
  const toList = rawTo.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  if (toList.length === 0) {
    throw new Error('Mindestens eine Empfänger-Adresse (to) ist erforderlich.');
  }

  const accessToken = await getZohoAccessToken();

  for (const toAddress of toList) {
    await sendZohoMailMessage({
      accessToken,
      accountId,
      fromAddress,
      toAddress,
      subject,
      content: htmlBody,
      mailFormat: 'html',
    });
  }
}

module.exports = {
  normalizeEnvString,
  getZohoAccessToken,
  sendZohoMailMessage,
  sendEmailViaZoho,
  buildFromAddress,
};
