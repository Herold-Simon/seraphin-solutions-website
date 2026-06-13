// api/sync/push.js - App pusht vollstaendigen Stand: Route-Statistiken + routen-verknuepfte Labels
const {
  supabase, hasSupabaseConfig, setCors, send, readBody, timestampToIso
} = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });

  if (!hasSupabaseConfig()) {
    return send(res, 500, { success: false, error: 'Server-Konfiguration fehlt' });
  }

  try {
    const body = readBody(req);
    const { account_id, device_id, device_name } = body;
    const routes = Array.isArray(body.routes) ? body.routes : [];
    const labels = Array.isArray(body.labels) ? body.labels : [];
    const floors = Array.isArray(body.floors) ? body.floors : [];

    if (!account_id || !device_id) {
      return send(res, 400, { success: false, error: 'account_id und device_id sind erforderlich' });
    }

    // Konto pruefen
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', String(account_id))
      .maybeSingle();

    if (!account) {
      return send(res, 404, { success: false, error: 'Konto nicht gefunden' });
    }

    const now = new Date().toISOString();
    const accountId = account.id;
    const deviceId = String(device_id);

    // Geraet aktualisieren (inkl. Stockwerk-Zusammenfassung fuer die Dashboard-Karten)
    const floorSummary = floors.map(f => ({
      id: String(f.id),
      name: f.name || '',
      room_count: typeof f.room_count === 'number'
        ? f.room_count
        : (Array.isArray(f.objectVideoMappings) ? f.objectVideoMappings.length
          : (Array.isArray(f.objectRouteMappings) ? f.objectRouteMappings.length : 0))
    }));

    await supabase
      .from('devices')
      .upsert({
        account_id: accountId,
        device_id: deviceId,
        device_name: device_name || `Gerät ${deviceId.substring(0, 8)}`,
        last_active: now,
        total_videos: routes.length,
        floors: floorSummary
      }, { onConflict: 'account_id,device_id' });

    // Route-Statistiken: vollstaendiger Ersatz fuer dieses Geraet
    await supabase
      .from('route_stats')
      .delete()
      .eq('account_id', accountId)
      .eq('device_id', deviceId);

    if (routes.length > 0) {
      // Deduplizieren nach route_id (Unique-Constraint account_id, device_id, route_id)
      const routeMap = new Map();
      for (const r of routes) {
        const routeId = String(r.route_id != null ? r.route_id : r.id);
        if (!routeId) continue;
        routeMap.set(routeId, {
          account_id: accountId,
          device_id: deviceId,
          route_id: routeId,
          title: r.title || '',
          views: parseInt(r.views, 10) || 0,
          last_viewed: timestampToIso(r.last_viewed != null ? r.last_viewed : r.lastViewed),
          view_history: r.view_history || r.viewHistory || {},
          updated_at: now
        });
      }
      const routeRows = Array.from(routeMap.values());
      if (routeRows.length > 0) {
        const { error: routeError } = await supabase.from('route_stats').insert(routeRows);
        if (routeError) console.error('route_stats insert error:', routeError.message);
      }
    }

    // Labels (routen-verknuepft): vollstaendiger Ersatz fuer dieses Geraet
    await supabase
      .from('labels')
      .delete()
      .eq('account_id', accountId)
      .eq('device_id', deviceId);

    if (labels.length > 0) {
      // Deduplizieren nach (floor_id, label_id) (Unique-Constraint)
      const labelMap = new Map();
      for (const l of labels) {
        if (l.floor_id == null || l.label_id == null) continue;
        const key = `${l.floor_id}\u001f${l.label_id}`;
        labelMap.set(key, {
          account_id: accountId,
          device_id: deviceId,
          floor_id: String(l.floor_id),
          label_id: String(l.label_id),
          route_id: l.route_id != null ? String(l.route_id) : null,
          per_language: l.per_language || {},
          updated_at: now
        });
      }
      const labelRows = Array.from(labelMap.values());
      if (labelRows.length > 0) {
        const { error: labelError } = await supabase.from('labels').insert(labelRows);
        if (labelError) console.error('labels insert error:', labelError.message);
      }
    }

    return send(res, 200, { success: true, message: 'Synchronisation erfolgreich' });
  } catch (error) {
    console.error('Sync push error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
