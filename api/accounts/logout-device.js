// api/accounts/logout-device.js - Ein Geraet vom Konto abmelden (Daten dieses Geraets entfernen)
// Beim Logout im Programm sollen die Statistiken UND Labels genau dieses Geraets von der
// Website verschwinden. Zusaetzlich werden verwaiste Label-Overrides aufgeraeumt, damit
// kuenftige Beschriftungsaenderungen nur noch eingeloggte (verbleibende) Geraete betreffen.
const { supabase, hasSupabaseConfig, setCors, send, readBody } = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return send(res, 405, { success: false, error: 'Method not allowed' });
  }

  if (!hasSupabaseConfig()) {
    return send(res, 500, { success: false, error: 'Server-Konfiguration fehlt' });
  }

  try {
    const body = readBody(req);
    const accountId = body.account_id != null ? String(body.account_id) : null;
    const deviceId = body.device_id != null ? String(body.device_id) : null;

    if (!accountId || !deviceId) {
      return send(res, 400, { success: false, error: 'account_id und device_id sind erforderlich' });
    }

    // Statistiken dieses Geraets entfernen
    await supabase
      .from('route_stats')
      .delete()
      .eq('account_id', accountId)
      .eq('device_id', deviceId);

    // Routen-verknuepfte Labels dieses Geraets entfernen
    await supabase
      .from('labels')
      .delete()
      .eq('account_id', accountId)
      .eq('device_id', deviceId);

    // Geraet selbst entfernen
    await supabase
      .from('devices')
      .delete()
      .eq('account_id', accountId)
      .eq('device_id', deviceId);

    // Verwaiste Label-Overrides aufraeumen: nur Stockwerke behalten, die noch
    // von einem verbleibenden (eingeloggten) Geraet gemeldet werden.
    const { data: remainingLabels } = await supabase
      .from('labels')
      .select('floor_id')
      .eq('account_id', accountId);
    const remainingFloorIds = new Set(
      (remainingLabels || []).map(r => String(r.floor_id)).filter(Boolean)
    );

    const { data: overrideRows } = await supabase
      .from('label_overrides')
      .select('floor_id')
      .eq('account_id', accountId);
    const orphanFloorIds = Array.from(
      new Set(
        (overrideRows || [])
          .map(r => String(r.floor_id))
          .filter(fid => fid && !remainingFloorIds.has(fid))
      )
    );

    if (orphanFloorIds.length > 0) {
      await supabase
        .from('label_overrides')
        .delete()
        .eq('account_id', accountId)
        .in('floor_id', orphanFloorIds);
    }

    return send(res, 200, { success: true, message: 'Gerät erfolgreich abgemeldet' });
  } catch (error) {
    console.error('Device logout error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
