// api/labels/update.js - Label-Texte (Titel/Untertitel je Sprache) bearbeiten
// Eingang: per_language nach SPRACHNAMEN. Wird auf alle Sprach-Codes/IDs aller Geraete
// zurueckgemappt, damit jedes Geraet beim Pull seine eigene Sprach-ID bedient bekommt.
// Identitaet ist (floor_id + label_id): Es wird GENAU eine kanonische Override-Zeile fuer
// dieses Stockwerk + Label geschrieben. Da dasselbe Gebaeude auf allen Geraeten dieselbe
// floor_id hat, wirkt die Aenderung geraeteuebergreifend; gleiche IDs auf anderen Stockwerken
// bleiben unberuehrt.
const { supabase, setCors, send, readBody, resolveSession } = require('../_lib/db');

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
    const { floor_id, label_id, per_language } = readBody(req);

    if (!floor_id || !label_id || !per_language || typeof per_language !== 'object') {
      return send(res, 400, { success: false, error: 'floor_id, label_id und per_language sind erforderlich' });
    }

    // Sprachnamen -> Codes/IDs (geraeteuebergreifend). Eine Sprache (Name) kann auf mehreren
    // Geraeten unterschiedliche IDs haben; daher schreiben wir den Text fuer ALLE diese IDs.
    const { data: deviceRows } = await supabase
      .from('devices')
      .select('languages')
      .eq('account_id', accountId);
    const nameToCodes = new Map(); // name (lowercase) -> Set(codes)
    (deviceRows || []).forEach(d => {
      if (Array.isArray(d.languages)) {
        d.languages.forEach(l => {
          if (l && l.id != null) {
            const name = String(l.name != null ? l.name : l.id).toLowerCase();
            if (!nameToCodes.has(name)) nameToCodes.set(name, new Set());
            nameToCodes.get(name).add(String(l.id));
          }
        });
      }
    });

    // per_language (nach Namen) saeubern und auf alle Codes mappen
    const cleaned = {};
    Object.keys(per_language).forEach(name => {
      const entry = per_language[name] || {};
      const value = {
        title: entry.title != null ? String(entry.title) : '',
        subtitle: entry.subtitle != null ? String(entry.subtitle) : ''
      };
      // Den Namen selbst ebenfalls als Schluessel hinterlegen (Fallback)
      cleaned[name] = value;
      const codes = nameToCodes.get(String(name).toLowerCase());
      if (codes) {
        codes.forEach(code => { cleaned[code] = value; });
      }
    });

    // Genau eine Override-Zeile fuer dieses (floor_id + label_id) schreiben.
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('label_overrides')
      .upsert({
        account_id: accountId,
        floor_id: String(floor_id),
        label_id: String(label_id),
        per_language: cleaned,
        updated_at: now
      }, { onConflict: 'account_id,floor_id,label_id' });

    if (error) {
      console.error('Label override upsert error:', error.message);
      return send(res, 500, { success: false, error: 'Fehler beim Speichern der Label-Änderung' });
    }

    return send(res, 200, {
      success: true,
      message: 'Label-Änderung gespeichert',
      updated_at: now,
      affected_floors: 1
    });
  } catch (error) {
    console.error('Label update error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
