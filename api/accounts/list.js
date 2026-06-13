// api/accounts/list.js - Alle Konten auflisten (nur Master)
const { supabase, setCors, send, resolveSession } = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return send(res, 405, { success: false, error: 'Method not allowed' });

  try {
    const ctx = await resolveSession(req);
    if (!ctx) {
      return send(res, 401, { success: false, error: 'Nicht authentifiziert' });
    }
    if (!ctx.isMaster) {
      return send(res, 403, { success: false, error: 'Nur für Master-Konten verfügbar' });
    }

    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('id, username, created_at')
      .eq('is_master', false)
      .order('username', { ascending: true });

    if (error) {
      return send(res, 500, { success: false, error: 'Fehler beim Laden der Konten' });
    }

    // Geraetezahl pro Konto ermitteln
    const ids = (accounts || []).map(a => a.id);
    const deviceCounts = {};
    if (ids.length > 0) {
      const { data: devices } = await supabase
        .from('devices')
        .select('account_id')
        .in('account_id', ids);
      (devices || []).forEach(d => {
        deviceCounts[d.account_id] = (deviceCounts[d.account_id] || 0) + 1;
      });
    }

    const result = (accounts || []).map(a => ({
      id: a.id,
      username: a.username,
      created_at: a.created_at,
      device_count: deviceCounts[a.id] || 0
    }));

    return send(res, 200, {
      success: true,
      accounts: result,
      acting_account_id: ctx.actingAccount ? ctx.actingAccount.id : null
    });
  } catch (error) {
    console.error('Accounts list error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
