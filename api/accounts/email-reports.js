// GET/PUT Einstellungen für automatische Statistik-E-Mails
const { createClient } = require('@supabase/supabase-js');
const cookie = require('cookie');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function parseSessionToken(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  return cookies.session_token || null;
}

async function getAdminUserIdFromSession(req) {
  const sessionToken = parseSessionToken(req);
  if (!sessionToken) return { error: 401, message: 'Keine gültige Session' };

  const { data: session, error } = await supabase
    .from('website_sessions')
    .select(
      'expires_at, website_users!inner(admin_user_id)'
    )
    .eq('session_token', sessionToken)
    .single();

  if (error || !session) {
    return { error: 401, message: 'Ungültige oder abgelaufene Session' };
  }
  if (new Date(session.expires_at) < new Date()) {
    return { error: 401, message: 'Session abgelaufen' };
  }
  const adminUserId = session.website_users?.admin_user_id;
  if (!adminUserId) return { error: 400, message: 'Keine Admin-User-ID' };
  return { adminUserId };
}

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function normalizeEmails(rawList) {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set();
  const out = [];
  for (const e of rawList) {
    const s = String(e || '')
      .trim()
      .toLowerCase();
    if (!s || seen.has(s)) continue;
    if (!EMAIL_RE.test(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function addDaysUtc(d, days) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ success: false, error: 'Server-Konfiguration unvollständig' });
  }

  const sessionResult = await getAdminUserIdFromSession(req);
  if (sessionResult.error) {
    return res.status(sessionResult.error).json({
      success: false,
      error: sessionResult.message,
    });
  }
  const { adminUserId } = sessionResult;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('statistics_email_reports')
      .select(
        'emails, send_interval_days, period_days, enabled, next_run_at, last_sent_at'
      )
      .eq('admin_user_id', adminUserId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('email-reports GET:', error);
      return res.status(500).json({ success: false, error: 'Datenbankfehler' });
    }

    return res.status(200).json({
      success: true,
      settings: data || {
        emails: [],
        send_interval_days: 7,
        period_days: 7,
        enabled: false,
        next_run_at: null,
        last_sent_at: null,
      },
    });
  }

  if (req.method === 'PUT') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const emails = normalizeEmails(body.emails);
    const send_interval_days = Math.min(
      365,
      Math.max(1, parseInt(body.send_interval_days, 10) || 7)
    );
    const period_days = Math.min(
      365,
      Math.max(1, parseInt(body.period_days, 10) || 7)
    );
    const enabled = Boolean(body.enabled);

    if (enabled && emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Mindestens eine gültige E-Mail-Adresse ist nötig, wenn der Versand aktiv ist.',
      });
    }

    const { data: existing } = await supabase
      .from('statistics_email_reports')
      .select('id, last_sent_at, next_run_at, send_interval_days, enabled')
      .eq('admin_user_id', adminUserId)
      .maybeSingle();

    const now = new Date();
    let next_run_at = null;
    if (enabled) {
      const prev = existing;
      if (!prev || !prev.enabled) {
        next_run_at = addDaysUtc(now, send_interval_days).toISOString();
      } else if (send_interval_days !== prev.send_interval_days) {
        const base = prev.last_sent_at ? new Date(prev.last_sent_at) : now;
        const candidate = addDaysUtc(base, send_interval_days);
        next_run_at = (
          candidate > now ? candidate : addDaysUtc(now, send_interval_days)
        ).toISOString();
      } else if (prev.next_run_at && new Date(prev.next_run_at) > now) {
        next_run_at = prev.next_run_at;
      } else {
        next_run_at = addDaysUtc(now, send_interval_days).toISOString();
      }
    }

    const row = {
      admin_user_id: adminUserId,
      emails,
      send_interval_days,
      period_days,
      enabled,
      next_run_at: enabled ? next_run_at : null,
      updated_at: now.toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('statistics_email_reports')
      .upsert(row, { onConflict: 'admin_user_id' });

    if (upsertError) {
      console.error('email-reports upsert:', upsertError);
      if (upsertError.code === '42P01' || upsertError.message?.includes('does not exist')) {
        return res.status(500).json({
          success: false,
          error:
            'Tabelle statistics_email_reports fehlt. Bitte Migration in Supabase ausführen.',
        });
      }
      return res.status(500).json({ success: false, error: 'Speichern fehlgeschlagen' });
    }

    return res.status(200).json({
      success: true,
      settings: {
        emails,
        send_interval_days,
        period_days,
        enabled,
        next_run_at: enabled ? next_run_at : null,
        last_sent_at: existing?.last_sent_at || null,
      },
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
};
