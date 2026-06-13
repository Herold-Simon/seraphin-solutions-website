// api/labels/update.js - Label-Texte (Titel/Untertitel je Sprache) bearbeiten
// Schreibt eine kanonische Override-Zeile (floor_id + label_id), die alle Geraete beim Pull anwenden.
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

    // per_language saeubern: nur title/subtitle je Sprache uebernehmen
    const cleaned = {};
    Object.keys(per_language).forEach(lang => {
      const entry = per_language[lang] || {};
      cleaned[lang] = {
        title: entry.title != null ? String(entry.title) : '',
        subtitle: entry.subtitle != null ? String(entry.subtitle) : ''
      };
    });

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

    return send(res, 200, { success: true, message: 'Label-Änderung gespeichert', updated_at: now });
  } catch (error) {
    console.error('Label update error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
