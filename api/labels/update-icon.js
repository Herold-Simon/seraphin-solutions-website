// api/labels/update-icon.js - Icon (logoBase64) der verknuepften Route bearbeiten
// Identitaet ist (floor_id + label_id): Das Icon-Override wird fuer GENAU dieses Stockwerk +
// Label geschrieben. Da dasselbe Gebaeude auf allen Geraeten dieselbe floor_id hat, wirkt die
// Aenderung geraeteuebergreifend; gleiche IDs auf anderen Stockwerken bleiben unberuehrt.
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
    const { floor_id, label_id } = body;

    if (!floor_id || !label_id || !('icon' in body)) {
      return send(res, 400, { success: false, error: 'floor_id, label_id und icon sind erforderlich' });
    }

    // icon normalisieren: null (Override entfernen) oder String (setzen/leeren)
    let icon = body.icon;
    if (icon !== null) {
      icon = String(icon);
      if (icon.length > MAX_ICON_LENGTH) {
        return send(res, 413, { success: false, error: 'Icon ist zu groß (max. ~1,5 MB Bild).' });
      }
    }

    const now = new Date().toISOString();
    // Nur icon + Konfliktschluessel uebergeben: per_language bleibt bei Konflikt erhalten.
    const { error } = await supabase
      .from('label_overrides')
      .upsert({
        account_id: accountId,
        floor_id: String(floor_id),
        label_id: String(label_id),
        icon: icon,
        updated_at: now
      }, { onConflict: 'account_id,floor_id,label_id' });

    if (error) {
      console.error('Label icon upsert error:', error.message);
      return send(res, 500, { success: false, error: 'Fehler beim Speichern des Icons' });
    }

    return send(res, 200, {
      success: true,
      message: 'Icon gespeichert',
      updated_at: now,
      affected_floors: 1
    });
  } catch (error) {
    console.error('Label icon update error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
