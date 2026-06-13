// api/devices/list.js - Geraeteliste fuer das (verkoerperte) Konto im Dashboard
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

    const accountId = ctx.effectiveAccountId;

    const { data: devices, error } = await supabase
      .from('devices')
      .select('device_id, device_name, last_active, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true });

    if (error) {
      return send(res, 500, { success: false, error: 'Fehler beim Laden der Geräte' });
    }

    const result = (devices || []).map(d => ({
      device_id: d.device_id,
      device_name: d.device_name || `Gerät ${String(d.device_id).substring(0, 8)}`,
      last_active: d.last_active,
      created_at: d.created_at
    }));

    return send(res, 200, {
      success: true,
      devices: result,
      total_devices: result.length
    });
  } catch (error) {
    console.error('Devices list error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
