// api/accounts/lookup.js - Hilfsendpunkt fuer die App: Benutzername-Verfuegbarkeit / Account-Existenz
const { supabase, hasSupabaseConfig, setCors, send } = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return send(res, 405, { success: false, error: 'Method not allowed' });

  if (!hasSupabaseConfig()) {
    return send(res, 500, { success: false, error: 'Server-Konfiguration fehlt' });
  }

  try {
    const { username, account_id } = req.query;

    if (account_id) {
      const { data } = await supabase
        .from('accounts')
        .select('id, username')
        .eq('id', String(account_id))
        .maybeSingle();
      return send(res, 200, {
        success: true,
        exists: Boolean(data),
        username: data ? data.username : null
      });
    }

    if (username) {
      const { data } = await supabase
        .from('accounts')
        .select('id')
        .eq('username', String(username).trim())
        .maybeSingle();
      return send(res, 200, {
        success: true,
        available: !data,
        exists: Boolean(data)
      });
    }

    return send(res, 400, { success: false, error: 'username oder account_id erforderlich' });
  } catch (error) {
    console.error('Account lookup error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
