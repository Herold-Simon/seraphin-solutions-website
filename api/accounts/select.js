// api/accounts/select.js - Master verkoerpert ein Konto (oder hebt es auf)
const { supabase, setCors, send, readBody, resolveSession } = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });

  try {
    const ctx = await resolveSession(req);
    if (!ctx) {
      return send(res, 401, { success: false, error: 'Nicht authentifiziert' });
    }
    if (!ctx.isMaster) {
      return send(res, 403, { success: false, error: 'Nur für Master-Konten verfügbar' });
    }

    const { account_id } = readBody(req);

    // null/leer => Auswahl aufheben
    let actingId = null;
    if (account_id) {
      const { data: target } = await supabase
        .from('accounts')
        .select('id, username, is_master')
        .eq('id', String(account_id))
        .maybeSingle();

      if (!target || target.is_master) {
        return send(res, 404, { success: false, error: 'Konto nicht gefunden' });
      }
      actingId = target.id;
    }

    const { error } = await supabase
      .from('sessions')
      .update({ acting_account_id: actingId })
      .eq('id', ctx.sessionId);

    if (error) {
      return send(res, 500, { success: false, error: 'Fehler beim Auswählen des Kontos' });
    }

    return send(res, 200, {
      success: true,
      acting_account_id: actingId,
      message: actingId ? 'Konto ausgewählt' : 'Auswahl aufgehoben'
    });
  } catch (error) {
    console.error('Account select error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
