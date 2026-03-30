/**
 * Vercel Cron: versendet fällige Statistik-E-Mails (Resend API).
 * Absicherung: Header Authorization: Bearer CRON_SECRET
 */
const { createClient } = require('@supabase/supabase-js');
const { computeReportForAdmin } = require('../lib/email-report-stats');
const { sendStatisticsReport, buildReportEmailHtml } = require('../lib/report-mail');
const { analyzeMailSendError } = require('../lib/mail-send-errors');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function authorizeCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-cron-secret'];
  return token === secret;
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!authorizeCron(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const nowIso = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from('statistics_email_reports')
    .select(
      'id, admin_user_id, emails, send_interval_days, period_days, last_sent_at'
    )
    .eq('enabled', true)
    .lte('next_run_at', nowIso)
    .limit(25);

  if (error) {
    console.error('cron fetch reports:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }

  let sent = 0;
  const failures = [];

  for (const row of rows || []) {
    const emails = (row.emails || []).filter(Boolean);
    if (emails.length === 0) continue;

    try {
      const stats = await computeReportForAdmin(
        supabase,
        row.admin_user_id,
        row.period_days
      );

      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('username')
        .eq('id', row.admin_user_id)
        .maybeSingle();

      const userLabel = adminRow?.username || row.admin_user_id;
      const subject = `Gebäudenavi Statistik — ${userLabel} (${stats.periodDays} Tage)`;
      const html = buildReportEmailHtml(stats);

      await sendStatisticsReport(emails, subject, html);

      const next = new Date();
      next.setUTCDate(next.getUTCDate() + row.send_interval_days);

      await supabase
        .from('statistics_email_reports')
        .update({
          last_sent_at: nowIso,
          next_run_at: next.toISOString(),
          updated_at: nowIso,
        })
        .eq('id', row.id);

      sent += 1;
    } catch (e) {
      const { code, message } = analyzeMailSendError(e);
      console.error('cron send failed', row.id, code, message);
      failures.push({ id: row.id, code, error: message });
    }
  }

  return res.status(200).json({
    ok: true,
    processed: (rows || []).length,
    sent,
    failures,
  });
};
