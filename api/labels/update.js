// api/labels/update.js - Label-Texte (Titel/Untertitel je Sprache) bearbeiten
// Eingang: per_language nach SPRACHNAMEN. Wird auf alle Sprach-Codes/IDs aller Geraete
// zurueckgemappt, damit jedes Geraet beim Pull seine eigene Sprach-ID bedient bekommt.
// Identitaet ist die route_id: Es werden Override-Zeilen fuer ALLE (floor_id + label_id)-Paare
// geschrieben, die zu dieser Route gehoeren (mehrstoeckige Routen fuehren das Label auf mehreren
// Stockwerken). Ohne route_id wird genau das uebergebene (floor_id + label_id) geschrieben.
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
    const { floor_id, label_id, route_id, per_language } = readBody(req);

    if ((!floor_id || !label_id) && !route_id) {
      return send(res, 400, { success: false, error: 'route_id oder (floor_id + label_id) sind erforderlich' });
    }
    if (!per_language || typeof per_language !== 'object') {
      return send(res, 400, { success: false, error: 'per_language ist erforderlich' });
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

    // Zielzeilen bestimmen: bei route_id ALLE (floor_id,label_id)-Paare dieser Route,
    // sonst genau das uebergebene Paar.
    const pairSet = new Map(); // "floor\u001flabel" -> { floor_id, label_id }
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
    const rows = Array.from(pairSet.values()).map(p => ({
      account_id: accountId,
      floor_id: p.floor_id,
      label_id: p.label_id,
      per_language: cleaned,
      updated_at: now
    }));

    const { error } = await supabase
      .from('label_overrides')
      .upsert(rows, { onConflict: 'account_id,floor_id,label_id' });

    if (error) {
      console.error('Label override upsert error:', error.message);
      return send(res, 500, { success: false, error: 'Fehler beim Speichern der Label-Änderung' });
    }

    return send(res, 200, {
      success: true,
      message: 'Label-Änderung gespeichert',
      updated_at: now,
      affected_floors: rows.length
    });
  } catch (error) {
    console.error('Label update error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
