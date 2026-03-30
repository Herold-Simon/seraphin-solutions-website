/**
 * Auswertung von Resend-/Mail-Versand-Fehlern für HTTP-Antworten und Logs.
 */
function analyzeMailSendError(err) {
  const message = (err && err.message) || String(err);

  if (/Resend\s+403|domain.*not verified|not allowed to send/i.test(message)) {
    return {
      httpStatus: 503,
      code: 'RESEND_DOMAIN_OR_PERMISSION',
      message,
      hint:
        'Resend: Absender-Domain in https://resend.com/domains verifizieren oder testweise Resend-Onboarding-Absender nutzen. REPORT_MAIL_FROM muss einer verifizierten Domain entsprechen.',
    };
  }

  if (/Resend\s+422|Resend\s+400|validation|invalid_from|invalid_to/i.test(message)) {
    return {
      httpStatus: 502,
      code: 'RESEND_VALIDATION',
      message,
      hint:
        'Resend lehnt die Anfrage ab (ungültiges from/to/subject). REPORT_MAIL_FROM und Empfänger prüfen.',
    };
  }

  if (/RESEND_API_KEY|REPORT_MAIL_FROM fehlt/i.test(message)) {
    return {
      httpStatus: 503,
      code: 'MAIL_NOT_CONFIGURED',
      message,
      hint:
        'Vercel: RESEND_API_KEY und REPORT_MAIL_FROM (z. B. "Name <mail@domain>") setzen.',
    };
  }

  if (/Resend\s+/i.test(message)) {
    return {
      httpStatus: 502,
      code: 'RESEND_ERROR',
      message,
      hint: 'Resend-Dashboard und Logs prüfen: https://resend.com/overview',
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
