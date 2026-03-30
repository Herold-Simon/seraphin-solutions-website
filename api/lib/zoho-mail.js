const nodemailer = require('nodemailer');

/** Trimmt typische Copy-Paste-Artefakte aus ZOHO_SMTP_HOST (verhindert dns.queryA EBADNAME). */
function normalizeSmtpHost(raw) {
  if (raw == null) return '';
  let h = String(raw).trim();
  if (
    (h.startsWith('"') && h.endsWith('"') && h.length >= 2) ||
    (h.startsWith("'") && h.endsWith("'") && h.length >= 2)
  ) {
    h = h.slice(1, -1).trim();
  }
  h = h.replace(/[\u200B-\u200D\uFEFF]/g, '');
  return h;
}

/** E-Mail-Adresse für SMTP-Kopfzeilen (Absender); Kleinbuchstaben, typische Paste-Artefakte entfernt. */
function normalizeEmail(raw) {
  const e = normalizeSmtpHost(raw);
  if (!e) return '';
  return e.toLowerCase();
}

/**
 * Einheitliche „From“-Angabe für Statistik-Mails.
 * Reihenfolge: ZOHO_MAIL_FROM → ZOHO_SMTP_USER (beide müssen zur SMTP-Auth passen, sonst Relay-Fehler bei Zoho).
 * Optional: ZOHO_MAIL_FROM_NAME → „Name“ <adresse>
 */
function getReportFromAddress() {
  const addr =
    normalizeEmail(process.env.ZOHO_MAIL_FROM) ||
    normalizeEmail(process.env.ZOHO_SMTP_USER);
  if (!addr || !addr.includes('@')) {
    throw new Error(
      'Absender fehlt oder ungültig — ZOHO_MAIL_FROM oder ZOHO_SMTP_USER als E-Mail setzen.'
    );
  }
  const nameRaw = normalizeSmtpHost(process.env.ZOHO_MAIL_FROM_NAME);
  if (nameRaw) {
    const safeName = nameRaw.replace(/[\r\n<>]/g, '').trim();
    if (safeName) {
      return `"${safeName.replace(/"/g, '')}" <${addr}>`;
    }
  }
  return addr;
}

function getTransport() {
  const host =
    normalizeSmtpHost(process.env.ZOHO_SMTP_HOST) || 'smtppro.zoho.eu';
  const port = parseInt(process.env.ZOHO_SMTP_PORT || '465', 10);
  const user = normalizeSmtpHost(process.env.ZOHO_SMTP_USER);
  const pass = normalizeSmtpHost(process.env.ZOHO_SMTP_PASS);
  const secure = port === 465;

  if (!user || !pass) {
    throw new Error('ZOHO_SMTP_USER und ZOHO_SMTP_PASS müssen gesetzt sein');
  }
  if (!host || /\s/.test(host)) {
    throw new Error(
      'ZOHO_SMTP_HOST ist leer oder ungültig — Host ohne Leerzeichen setzen (z. B. smtppro.zoho.eu).'
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: port === 587,
    auth: { user, pass },
  });
}

function formatComparisonLine(comparison, totalCurrent, totalPrevious) {
  if (comparison.direction === 'neu') {
    return `Vorperiod: ${totalPrevious} Aufrufe — jetzt ${totalCurrent} (vorher keine Aufrufe im Vergleichszeitraum).`;
  }
  if (comparison.pct === null || comparison.direction === 'gleich') {
    return `Vorperiod: ${totalPrevious} Aufrufe — Veränderung: ±0 %`;
  }
  const sign = comparison.pct > 0 ? '+' : '';
  const verb =
    comparison.direction === 'gestiegen'
      ? 'gestiegen'
      : comparison.direction === 'gesunken'
        ? 'gesunken'
        : 'unverändert';
  return `Vorperiod: ${totalPrevious} Aufrufe — im Vergleich ${verb} um ${sign}${comparison.pct.toFixed(1)} %`;
}

function buildReportEmailHtml(payload, options = {}) {
  const simulation = Boolean(options.simulation);
  const {
    totalCurrent,
    totalPrevious,
    comparison,
    top5,
    periodDays,
    windowCurrent,
    windowPrevious,
  } = payload;

  const comparisonText = formatComparisonLine(comparison, totalCurrent, totalPrevious);

  const topRows =
    top5.length === 0
      ? '<tr><td colspan="2">Keine Aufrufe in diesem Zeitraum</td></tr>'
      : top5
          .map(
            (row, i) =>
              `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${i + 1}. ${escapeHtml(
                row.title
              )}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${row.views}</td></tr>`
          )
          .join('');

  const simBanner = simulation
    ? '<div style="background:#fff8e1;border:1px solid #e65100;padding:12px;margin-bottom:16px;border-radius:6px;font-size:14px;"><strong>Simulation:</strong> Diese E-Mail ist ein Testversand. Automatische Berichte und Versandtermine im Account werden nicht verändert.</div>'
    : '';

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"></head><body style="font-family:Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#222;">
${simBanner}<p>Gebäudenavi Statistikbericht</p>
<p><strong>Zeitraum (letzte ${periodDays} Tage):</strong> ${escapeHtml(
    windowCurrent.start
  )} — ${escapeHtml(windowCurrent.end)}</p>
<p><strong>Insgesamt Aufrufe im Zeitraum:</strong> ${totalCurrent}</p>
<p><strong>Vergleich zum vorherigen Block (${escapeHtml(
    windowPrevious.start
  )} — ${escapeHtml(windowPrevious.end)}):</strong><br>${escapeHtml(
    comparisonText
  )}</p>
<h3 style="margin-top:1.5em;">Top 5 Wegbeschreibungen im Zeitraum</h3>
<table style="border-collapse:collapse;width:100%;max-width:560px;"><thead><tr><th style="text-align:left;padding:8px;border-bottom:2px solid #ccc;">Titel</th><th style="text-align:right;padding:8px;border-bottom:2px solid #ccc;">Aufrufe</th></tr></thead><tbody>${topRows}</tbody></table>
<p style="margin-top:2em;font-size:12px;color:#666;">Automatisch erstellt von Seraphin Solutions (Gebäudenavi).</p>
</body></html>`;
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendStatisticsReport(emails, subject, html) {
  const from = getReportFromAddress();
  const authUser = normalizeEmail(process.env.ZOHO_SMTP_USER);
  const fromAddrOnly = from.includes('<') ? from.replace(/^[^<]*<([^>]+)>.*$/, '$1').trim() : from;
  if (authUser && fromAddrOnly !== authUser) {
    console.warn(
      '[zoho-mail] ZOHO_MAIL_FROM unterscheidet sich von ZOHO_SMTP_USER — Zoho kann den Versand mit 553/554 ablehnen.'
    );
  }

  const transport = getTransport();
  await transport.sendMail({
    from,
    to: emails,
    subject,
    html,
  });
}

module.exports = {
  sendStatisticsReport,
  buildReportEmailHtml,
  getTransport,
  getReportFromAddress,
};
