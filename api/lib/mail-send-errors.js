/**
 * Auswertung von Zoho-Mail-API-/OAuth-Fehlern für HTTP-Antworten und Logs.
 */
function analyzeMailSendError(err) {
  const message = (err && err.message) || String(err);

  if (/Zoho OAuth|refresh_token|invalid_client|invalid_grant/i.test(message)) {
    return {
      httpStatus: 503,
      code: 'ZOHO_OAUTH_CONFIG',
      message,
      hint:
        'Zoho OAuth prüfen: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN (Scope ZohoMail.messages.CREATE oder ALL), Refresh-Token neu erzeugen falls abgelaufen.',
    };
  }

  if (/ZOHO_ACCOUNT_ID fehlt/i.test(message)) {
    return {
      httpStatus: 503,
      code: 'ZOHO_ACCOUNT_MISSING',
      message,
      hint:
        'ZOHO_ACCOUNT_ID in Vercel setzen (Z-Mail-Konto-ID, z. B. aus der Mail-API oder Setup-Doku).',
    };
  }

  if (/Absender fehlt/i.test(message)) {
    return {
      httpStatus: 503,
      code: 'ZOHO_FROM_MISSING',
      message,
      hint:
        'In Vercel: ZOHO_DEFAULT_FROM_EMAIL setzen — oder ZOHO_MAIL_FROM / ZOHO_SMTP_USER (Fallback im Code). Absender muss die OAuth-Mailbox sein.',
    };
  }

  if (/Zoho Mail API\s+4\d{2}/i.test(message)) {
    return {
      httpStatus: 502,
      code: 'ZOHO_MAIL_API_REJECTED',
      message,
      hint:
        'Zoho lehnt die Anfrage ab (Adresse, Scope oder Kontingent). Zoho Mail API-Dokumentation und Audit-Logs prüfen.',
    };
  }

  return {
    httpStatus: 502,
    code: 'MAIL_SEND_FAILED',
    message,
    hint: undefined,
  };
}

module.exports = { analyzeMailSendError };
