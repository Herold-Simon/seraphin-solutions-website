/**
 * Versand von Statistik-Berichten über Resend (HTTPS-API, geeignet für Vercel Serverless).
 * https://resend.com/docs/api-reference/emails/send-email
 */

const RESEND_API = 'https://api.resend.com/emails';

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

function getReportMailFrom() {
  const from = normalizeEnvString(process.env.REPORT_MAIL_FROM);
  if (!from) {
    throw new Error(
      'REPORT_MAIL_FROM fehlt. In Vercel z. B. setzen: Gebäudenavi <berichte@deine-domain.de> — Domain muss in Resend verifiziert sein.'
    );
  }
  return from;
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

/**
 * @param {string[]} emails
 * @param {string} subject
 * @param {string} html
 */
async function sendStatisticsReport(emails, subject, html) {
  const apiKey = normalizeEnvString(process.env.RESEND_API_KEY);
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY fehlt — API-Schlüssel aus dem Resend-Dashboard in Vercel Environment Variables eintragen.'
    );
  }

  const from = getReportMailFrom();
  const to = (Array.isArray(emails) ? emails : [emails]).map((e) => String(e).trim()).filter(Boolean);

  if (to.length === 0) {
    throw new Error('Keine gültigen Empfänger-Adressen.');
  }

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
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
      (data && data.message) ||
      (data && data.error && data.error.message) ||
      JSON.stringify(data) ||
      res.statusText;
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
}

module.exports = {
  sendStatisticsReport,
  buildReportEmailHtml,
};
