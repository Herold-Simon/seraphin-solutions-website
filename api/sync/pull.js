// api/sync/pull.js - App holt geaenderte Label-Overrides (Website -> Geraet)
const {
  supabase, hasSupabaseConfig, setCors, send
} = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return send(res, 405, { success: false, error: 'Method not allowed' });

  if (!hasSupabaseConfig()) {
    return send(res, 500, { success: false, error: 'Server-Konfiguration fehlt' });
  }

  try {
    const accountId = req.query.account_id;
    const deviceId = req.query.device_id;
    const since = req.query.since;

    if (!accountId) {
      return send(res, 400, { success: false, error: 'account_id ist erforderlich' });
    }

    // Geraeteaktivitaet aktualisieren (best effort)
    if (deviceId) {
      await supabase
        .from('devices')
        .update({ last_active: new Date().toISOString() })
        .eq('account_id', String(accountId))
        .eq('device_id', String(deviceId));
    }

    let query = supabase
      .from('label_overrides')
      .select('floor_id, label_id, per_language, icon, keywords, updated_at')
      .eq('account_id', String(accountId))
      .order('updated_at', { ascending: true });

    if (since) {
      query = query.gt('updated_at', since);
    }

    const { data: overrides, error } = await query;
    if (error) {
      return send(res, 500, { success: false, error: 'Fehler beim Laden der Änderungen' });
    }

    return send(res, 200, {
      success: true,
      overrides: (overrides || []).map(o => ({
        floor_id: o.floor_id,
        label_id: o.label_id,
        per_language: o.per_language || {},
        icon: o.icon === undefined ? null : o.icon,
        keywords: Array.isArray(o.keywords) ? o.keywords : null,
        updated_at: o.updated_at
      })),
      server_time: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sync pull error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
