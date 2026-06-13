// api/labels/update-icon.js - Icon (logoBase64) der verknuepften Route bearbeiten
// Identitaet ist die route_id: Das Icon-Override wird fuer ALLE (floor_id + label_id)-Paare der
// Route geschrieben (mehrstoeckige Routen). Ohne route_id genau fuer das uebergebene Paar.
// icon: nicht-leerer String  -> Icon setzen
// icon: null                 -> Icon-Override entfernen (zurueck zum App-Icon)
// icon: ''                   -> Icon explizit ausblenden (kein Icon)
const { supabase, setCors, send, readBody, resolveSession } = require('../_lib/db');

const MAX_ICON_LENGTH = 2_000_000; // ~2 MB Base64-Schutzgrenze

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return send(res, 405, { success: false, error: 'Method not allowed' });
  }

  try {
    const ctx = await resolveSession(req);
    if (!ctx) {
      return send(res, 401, { success: false, error: 'Nicht authentifiziert' });
    }

    const accountId = ctx.effectiveAccountId;
    const body = readBody(req);
    const { floor_id, label_id, route_id } = body;

    if (((!floor_id || !label_id) && !route_id) || !('icon' in body)) {
      return send(res, 400, { success: false, error: 'route_id oder (floor_id + label_id) sowie icon sind erforderlich' });
    }

    // icon normalisieren: null (Override entfernen) oder String (setzen/leeren)
    let icon = body.icon;
    if (icon !== null) {
      icon = String(icon);
      if (icon.length > MAX_ICON_LENGTH) {
        return send(res, 413, { success: false, error: 'Icon ist zu groß (max. ~1,5 MB Bild).' });
      }
    }

    // Zielzeilen bestimmen: bei route_id ALLE (floor_id,label_id)-Paare der Route, sonst das Paar.
    const pairSet = new Map();
    const addPair = (fid, lid) => {
      if (fid == null || lid == null) return;
      pairSet.set(`${String(fid)}\u001f${String(lid)}`, { floor_id: String(fid), label_id: String(lid) });
    };

    if (route_id) {
      const { data: routeLabels } = await supabase
        .from('labels')
        .select('floor_id, label_id')
        .eq('account_id', accountId)
        .eq('route_id', String(route_id));
      (routeLabels || []).forEach(r => addPair(r.floor_id, r.label_id));
    }
    if (floor_id && label_id) addPair(floor_id, label_id);

    if (pairSet.size === 0) {
      return send(res, 404, { success: false, error: 'Keine zugehörige Beschriftung gefunden' });
    }

    const now = new Date().toISOString();
    // Nur icon + Konfliktschluessel uebergeben: per_language bleibt bei Konflikt erhalten.
    const rows = Array.from(pairSet.values()).map(p => ({
      account_id: accountId,
      floor_id: p.floor_id,
      label_id: p.label_id,
      icon: icon,
      updated_at: now
    }));

    const { error } = await supabase
      .from('label_overrides')
      .upsert(rows, { onConflict: 'account_id,floor_id,label_id' });

    if (error) {
      console.error('Label icon upsert error:', error.message);
      return send(res, 500, { success: false, error: 'Fehler beim Speichern des Icons' });
    }

    return send(res, 200, {
      success: true,
      message: 'Icon gespeichert',
      updated_at: now,
      affected_floors: rows.length
    });
  } catch (error) {
    console.error('Label icon update error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
