const nodemailer = require('nodemailer');

function getTransport() {
  const host = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.eu';
  const port = parseInt(process.env.ZOHO_SMTP_PORT || '465', 10);
  const user = process.env.ZOHO_SMTP_USER;
  const pass = process.env.ZOHO_SMTP_PASS;
  const secure = port === 465;

  if (!user || !pass) {
    throw new Error('ZOHO_SMTP_USER und ZOHO_SMTP_PASS müssen gesetzt sein');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
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

function buildReportEmailHtml(payload) {
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

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"></head><body style="font-family:Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#222;">
<p>Gebäudenavi Statistikbericht</p>
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
  const from =
    process.env.ZOHO_MAIL_FROM || process.env.ZOHO_SMTP_USER;

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
};
