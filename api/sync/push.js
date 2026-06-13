// api/sync/push.js - App pusht vollstaendigen Stand: Route-Statistiken + routen-verknuepfte Labels
const {
  supabase, hasSupabaseConfig, setCors, send, readBody, timestampToIso
} = require('../_lib/db');

// Ersetzt alle Zeilen eines Geraets in einer Tabelle LÜCKENLOS und fehlerfest:
//  1) Neue/aktualisierte Zeilen werden in kleinen Chunks per Upsert geschrieben
//     (kein vorheriges Löschen -> es gibt nie ein Zeitfenster ohne Daten).
//  2) Schlägt ein Chunk fehl, wird abgebrochen und der alte Bestand bleibt erhalten,
//     damit nichts grundlos "verschwindet" und der Client erneut pushen kann.
//  3) Erst nach erfolgreichem Upsert werden verwaiste Zeilen entfernt (die im
//     aktuellen Stand nicht mehr vorkommen).
// Gibt { ok, error } zurück.
async function replaceDeviceRows({ table, onConflict, rows, keyOf, accountId, deviceId, chunkSize = 10 }) {
  // 1) Upsert in Chunks
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      console.error(`${table} upsert error:`, error.message);
      return { ok: false, error };
    }
  }

  // 2) Verwaiste Zeilen ermitteln und entfernen (nur nach erfolgreichem Upsert)
  const keep = new Set(rows.map(keyOf));
  const { data: existing, error: selError } = await supabase
    .from(table)
    .select('id, ' + onConflict.split(',').map(s => s.trim()).join(', '))
    .eq('account_id', accountId)
    .eq('device_id', deviceId);
  if (selError) {
    console.error(`${table} select error:`, selError.message);
    return { ok: false, error: selError };
  }

  const toDelete = (existing || [])
    .filter(r => !keep.has(keyOf(r)))
    .map(r => r.id);

  for (let i = 0; i < toDelete.length; i += 100) {
    const chunk = toDelete.slice(i, i + 100);
    const { error: delError } = await supabase.from(table).delete().in('id', chunk);
    if (delError) {
      console.error(`${table} delete error:`, delError.message);
      return { ok: false, error: delError };
    }
  }

  return { ok: true };
}

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
    const languages = Array.isArray(body.languages) ? body.languages : [];

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

    // Sprachdefinitionen (id + Name) saeubern
    const languageList = languages
      .filter(l => l && l.id != null)
      .map(l => ({ id: String(l.id), name: String(l.name != null ? l.name : l.id) }));

    await supabase
      .from('devices')
      .upsert({
        account_id: accountId,
        device_id: deviceId,
        device_name: device_name || `Gerät ${deviceId.substring(0, 8)}`,
        last_active: now,
        total_videos: routes.length,
        floors: floorSummary,
        languages: languageList
      }, { onConflict: 'account_id,device_id' });

    // Route-Statistiken: lueckenloser Ersatz fuer dieses Geraet
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
    const routeResult = await replaceDeviceRows({
      table: 'route_stats',
      onConflict: 'account_id,device_id,route_id',
      rows: Array.from(routeMap.values()),
      keyOf: (r) => String(r.route_id),
      accountId,
      deviceId,
      chunkSize: 25
    });
    if (!routeResult.ok) {
      return send(res, 500, { success: false, error: 'Statistiken konnten nicht gespeichert werden' });
    }

    // Labels (routen-verknuepft): lueckenloser Ersatz fuer dieses Geraet
    // Deduplizieren nach (floor_id, label_id) (Unique-Constraint)
    const labelMap = new Map();
    for (const l of labels) {
      if (l.floor_id == null || l.label_id == null) continue;
      const key = `${String(l.floor_id)}\u001f${String(l.label_id)}`;
      labelMap.set(key, {
        account_id: accountId,
        device_id: deviceId,
        floor_id: String(l.floor_id),
        label_id: String(l.label_id),
        route_id: l.route_id != null ? String(l.route_id) : null,
        per_language: l.per_language || {},
        icon: l.icon != null ? String(l.icon) : null,
        updated_at: now
      });
    }
    // Kleine Chunks, da jede Zeile ein (ggf. grosses) Base64-Icon enthaelt
    const labelResult = await replaceDeviceRows({
      table: 'labels',
      onConflict: 'account_id,device_id,floor_id,label_id',
      rows: Array.from(labelMap.values()),
      keyOf: (r) => `${String(r.floor_id)}\u001f${String(r.label_id)}`,
      accountId,
      deviceId,
      chunkSize: 8
    });
    if (!labelResult.ok) {
      return send(res, 500, { success: false, error: 'Labels konnten nicht gespeichert werden' });
    }

    return send(res, 200, { success: true, message: 'Synchronisation erfolgreich' });
  } catch (error) {
    console.error('Sync push error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
