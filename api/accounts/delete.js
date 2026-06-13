// api/accounts/delete.js - Account und alle zugehoerigen Daten loeschen (Kaskade)
const { supabase, setCors, send, readBody, resolveSession } = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return send(res, 405, { success: false, error: 'Method not allowed' });
  }

  try {
    const body = readBody(req);
    let accountId = null;

    // Website: ueber Session (verkoerpertes Konto)
    const ctx = await resolveSession(req);
    if (ctx) {
      accountId = ctx.effectiveAccountId;
    } else if (body.account_id) {
      // App: direkter Aufruf mit Account-ID
      accountId = String(body.account_id);
    }

    if (!accountId) {
      return send(res, 400, { success: false, error: 'Account-ID ist erforderlich' });
    }

    // Master-Konto darf nicht ueber diesen Endpunkt geloescht werden
    const { data: account } = await supabase
      .from('accounts')
      .select('id, is_master')
      .eq('id', accountId)
      .maybeSingle();

    if (!account) {
      return send(res, 404, { success: false, error: 'Konto nicht gefunden' });
    }
    if (account.is_master) {
      return send(res, 403, { success: false, error: 'Master-Konto kann nicht gelöscht werden' });
    }

    const { error } = await supabase.from('accounts').delete().eq('id', accountId);
    if (error) {
      console.error('Account delete error:', error.message);
      return send(res, 500, { success: false, error: 'Fehler beim Löschen des Accounts' });
    }

    return send(res, 200, { success: true, message: 'Account erfolgreich gelöscht' });
  } catch (error) {
    console.error('Account delete error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
