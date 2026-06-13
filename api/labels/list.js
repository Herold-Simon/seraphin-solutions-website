// api/labels/list.js - Routen-verknuepfte Labels fuer das Dashboard (geraeteuebergreifend gemergt)
// Schluessel der Zusammenfuehrung: (floor_id + label_id). Effektiver Text = Override falls vorhanden,
// sonst der vom Geraet gemeldete Text.
const { supabase, setCors, send, resolveSession } = require('../_lib/db');

function mergeLanguageMaps(target, source) {
  if (!source || typeof source !== 'object') return;
  Object.keys(source).forEach(lang => {
    const entry = source[lang] || {};
    if (!target[lang]) target[lang] = { title: '', subtitle: '' };
    if (entry.title !== undefined && entry.title !== null && String(entry.title).length > 0 && !target[lang].title) {
      target[lang].title = entry.title;
    }
    if (entry.subtitle !== undefined && entry.subtitle !== null && String(entry.subtitle).length > 0 && !target[lang].subtitle) {
      target[lang].subtitle = entry.subtitle;
    }
  });
}

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

    const { data: labelRows, error: labelError } = await supabase
      .from('labels')
      .select('device_id, floor_id, label_id, route_id, per_language')
      .eq('account_id', accountId);
    if (labelError) {
      return send(res, 500, { success: false, error: 'Fehler beim Laden der Labels' });
    }

    const { data: overrideRows } = await supabase
      .from('label_overrides')
      .select('floor_id, label_id, per_language, updated_at')
      .eq('account_id', accountId);

    const overrideMap = new Map();
    (overrideRows || []).forEach(o => {
      overrideMap.set(`${o.floor_id}\u001f${o.label_id}`, o);
    });

    // Gruppieren nach (floor_id, label_id)
    const groups = new Map();
    (labelRows || []).forEach(l => {
      const key = `${l.floor_id}\u001f${l.label_id}`;
      if (!groups.has(key)) {
        groups.set(key, {
          floor_id: l.floor_id,
          label_id: l.label_id,
          route_id: l.route_id || null,
          device_ids: new Set(),
          reported: {}
        });
      }
      const g = groups.get(key);
      if (l.device_id) g.device_ids.add(l.device_id);
      if (!g.route_id && l.route_id) g.route_id = l.route_id;
      mergeLanguageMaps(g.reported, l.per_language);
    });

    const labels = [];
    groups.forEach((g, key) => {
      const override = overrideMap.get(key);
      const languages = {};

      // Basis: gemeldete Texte
      Object.keys(g.reported).forEach(lang => {
        languages[lang] = {
          title: g.reported[lang].title || '',
          subtitle: g.reported[lang].subtitle || ''
        };
      });

      // Overlay: Override (kanonisch)
      if (override && override.per_language) {
        Object.keys(override.per_language).forEach(lang => {
          const o = override.per_language[lang] || {};
          if (!languages[lang]) languages[lang] = { title: '', subtitle: '' };
          if (o.title !== undefined && o.title !== null) languages[lang].title = o.title;
          if (o.subtitle !== undefined && o.subtitle !== null) languages[lang].subtitle = o.subtitle;
        });
      }

      labels.push({
        floor_id: g.floor_id,
        label_id: g.label_id,
        route_id: g.route_id,
        device_ids: Array.from(g.device_ids),
        languages,
        has_override: Boolean(override)
      });
    });

    labels.sort((a, b) => {
      if (a.floor_id === b.floor_id) return String(a.label_id).localeCompare(String(b.label_id));
      return String(a.floor_id).localeCompare(String(b.floor_id));
    });

    return send(res, 200, { success: true, labels });
  } catch (error) {
    console.error('Labels list error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
