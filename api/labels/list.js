// api/labels/list.js - Routen-verknuepfte Labels fuer das Dashboard (geraeteuebergreifend gemergt)
// Schluessel der Zusammenfuehrung: (floor_id + label_id).
//   - Geraeteuebergreifend: dasselbe Gebaeude hat auf allen Geraeten dieselbe floor_id, daher
//     werden identische Labels mehrerer Geraete zu einem Eintrag zusammengefuehrt.
//   - Stockwerksweise getrennt: dieselbe label_id auf VERSCHIEDENEN Stockwerken bezeichnet
//     unterschiedliche Beschriftungen (Blender vergibt IDs pro Stockwerk neu) und bleibt getrennt.
// Sprachen werden nach NAMEN (nicht nach Code/ID) zusammengefuehrt, da Geraete fuer dieselbe
// Sprache unterschiedliche IDs vergeben koennen. So entsteht pro Sprachname genau ein Eintrag.
// Effektiver Text = Override falls vorhanden, sonst der vom Geraet gemeldete Text.
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

    const { data: labelRows, error: labelError } = await supabase
      .from('labels')
      .select('device_id, floor_id, label_id, route_id, per_language, icon')
      .eq('account_id', accountId);
    if (labelError) {
      return send(res, 500, { success: false, error: 'Fehler beim Laden der Labels' });
    }

    const { data: overrideRows } = await supabase
      .from('label_overrides')
      .select('floor_id, label_id, per_language, icon, updated_at')
      .eq('account_id', accountId);

    // Sprachnamen (Code -> Name) und Stockwerksnamen (floor_id -> Name) aus den Geraeten sammeln
    const { data: deviceRows } = await supabase
      .from('devices')
      .select('languages, floors')
      .eq('account_id', accountId);
    const languageNames = {};
    const floorNames = {};
    (deviceRows || []).forEach(d => {
      if (Array.isArray(d.languages)) {
        d.languages.forEach(l => {
          if (l && l.id != null && l.name) languageNames[String(l.id)] = String(l.name);
        });
      }
      if (Array.isArray(d.floors)) {
        d.floors.forEach(f => {
          if (f && f.id != null && f.name && !floorNames[String(f.id)]) {
            floorNames[String(f.id)] = String(f.name);
          }
        });
      }
    });

    // Sprachcode -> Anzeigename (Fallback: Code selbst)
    const codeToName = (code) =>
      languageNames[String(code)] || languageNames[String(code).toLowerCase()] || String(code);

    // Texte nach NAMEN zusammenfuehren (erstes nicht-leeres gewinnt)
    const mergeByName = (target, source) => {
      if (!source || typeof source !== 'object') return;
      Object.keys(source).forEach(code => {
        const name = codeToName(code);
        const entry = source[code] || {};
        if (!target[name]) target[name] = { title: '', subtitle: '' };
        if (entry.title != null && String(entry.title).length > 0 && !target[name].title) {
          target[name].title = entry.title;
        }
        if (entry.subtitle != null && String(entry.subtitle).length > 0 && !target[name].subtitle) {
          target[name].subtitle = entry.subtitle;
        }
      });
    };

    // Composite-Key aus floor_id + label_id
    const compositeKey = (floorId, labelId) => `${String(floorId)}\u001f${String(labelId)}`;

    // Overrides nach (floor_id + label_id) buendeln, Sprachen nach NAMEN (zuletzt aktualisiertes gewinnt)
    const overrideByLabel = new Map();
    const overrideIconByLabel = new Map(); // key -> icon (string oder '' zum Loeschen)
    (overrideRows || [])
      .sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')))
      .forEach(o => {
        const key = compositeKey(o.floor_id, o.label_id);
        if (!overrideByLabel.has(key)) overrideByLabel.set(key, {});
        const target = overrideByLabel.get(key);
        Object.keys(o.per_language || {}).forEach(code => {
          const name = codeToName(code);
          const e = o.per_language[code] || {};
          if (!target[name]) target[name] = { title: '', subtitle: '' };
          if (e.title !== undefined && e.title !== null) target[name].title = e.title;
          if (e.subtitle !== undefined && e.subtitle !== null) target[name].subtitle = e.subtitle;
        });
        // Icon-Override (zuletzt aktualisiertes gewinnt; null = kein Override)
        if (o.icon !== undefined && o.icon !== null) {
          overrideIconByLabel.set(key, String(o.icon));
        }
      });

    // Gruppieren nach (floor_id + label_id): geraeteuebergreifend gemergt, stockwerksweise getrennt
    const groups = new Map();
    (labelRows || []).forEach(l => {
      if (l.floor_id == null) return;
      const key = compositeKey(l.floor_id, l.label_id);
      if (!groups.has(key)) {
        groups.set(key, {
          label_id: l.label_id,
          floor_id: String(l.floor_id),
          route_id: l.route_id || null,
          device_ids: new Set(),
          reported: {},
          reportedIcon: ''
        });
      }
      const g = groups.get(key);
      if (l.device_id) g.device_ids.add(l.device_id);
      if (!g.route_id && l.route_id) g.route_id = l.route_id;
      if (!g.reportedIcon && l.icon) g.reportedIcon = String(l.icon);
      mergeByName(g.reported, l.per_language);
    });

    const labels = [];
    groups.forEach((g, key) => {
      const override = overrideByLabel.get(key);
      const iconOverride = overrideIconByLabel.get(key); // string oder undefined
      const hasIconOverride = iconOverride !== undefined;
      const effectiveIcon = hasIconOverride ? iconOverride : (g.reportedIcon || '');
      const languages = {};

      // Basis: gemeldete Texte
      Object.keys(g.reported).forEach(lang => {
        languages[lang] = {
          title: g.reported[lang].title || '',
          subtitle: g.reported[lang].subtitle || ''
        };
      });

      // Overlay: Override (kanonisch)
      if (override) {
        Object.keys(override).forEach(lang => {
          const o = override[lang] || {};
          if (!languages[lang]) languages[lang] = { title: '', subtitle: '' };
          if (o.title !== undefined && o.title !== null) languages[lang].title = o.title;
          if (o.subtitle !== undefined && o.subtitle !== null) languages[lang].subtitle = o.subtitle;
        });
      }

      labels.push({
        label_id: g.label_id,
        floor_id: g.floor_id,
        floor_ids: [g.floor_id],
        floor_name: floorNames[g.floor_id] || '',
        route_id: g.route_id,
        device_ids: Array.from(g.device_ids),
        languages,
        has_override: Boolean(override),
        icon: effectiveIcon,
        has_icon: Boolean(effectiveIcon),
        has_icon_override: hasIconOverride
      });
    });

    labels.sort((a, b) => {
      const f = String(a.floor_name || a.floor_id).localeCompare(String(b.floor_name || b.floor_id));
      if (f !== 0) return f;
      return String(a.label_id).localeCompare(String(b.label_id), undefined, { numeric: true });
    });

    return send(res, 200, { success: true, labels, language_names: languageNames });
  } catch (error) {
    console.error('Labels list error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
