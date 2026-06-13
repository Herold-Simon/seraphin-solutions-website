// api/labels/update-icon.js - Icon (logoBase64) der verknuepften Route bearbeiten
// Identitaet ist label_id: Das Icon-Override wird fuer ALLE Stockwerke geschrieben,
// die diese label_id fuehren, damit die Aenderung geraeteuebergreifend wirkt.
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
    const { label_id } = body;

    if (!label_id || !('icon' in body)) {
      return send(res, 400, { success: false, error: 'label_id und icon sind erforderlich' });
    }

    // icon normalisieren: null (Override entfernen) oder String (setzen/leeren)
    let icon = body.icon;
    if (icon !== null) {
      icon = String(icon);
      if (icon.length > MAX_ICON_LENGTH) {
        return send(res, 413, { success: false, error: 'Icon ist zu groß (max. ~1,5 MB Bild).' });
      }
    }

    // Alle Stockwerke ermitteln, die diese label_id fuehren
    const floorIdSet = new Set();
    const { data: labelRows } = await supabase
      .from('labels')
      .select('floor_id')
      .eq('account_id', accountId)
      .eq('label_id', String(label_id));
    (labelRows || []).forEach(r => { if (r.floor_id != null) floorIdSet.add(String(r.floor_id)); });

    const { data: existingOverrides } = await supabase
      .from('label_overrides')
      .select('floor_id')
      .eq('account_id', accountId)
      .eq('label_id', String(label_id));
    (existingOverrides || []).forEach(r => { if (r.floor_id != null) floorIdSet.add(String(r.floor_id)); });

    if (body.floor_id != null) floorIdSet.add(String(body.floor_id));

    if (floorIdSet.size === 0) {
      return send(res, 404, { success: false, error: 'Keine zugehörigen Stockwerke gefunden' });
    }

    const now = new Date().toISOString();
    // Nur icon + Konfliktschluessel uebergeben: per_language bleibt bei Konflikt erhalten.
    const rows = Array.from(floorIdSet).map(fid => ({
      account_id: accountId,
      floor_id: fid,
      label_id: String(label_id),
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
