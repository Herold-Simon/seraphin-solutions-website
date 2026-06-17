// api/labels/list.js - Routen-verknuepfte Labels fuer das Dashboard (geraeteuebergreifend gemergt)
// Schluessel der Zusammenfuehrung: route_id (Fallback: floor_id + label_id ohne Route).
//   - Jede Beschriftung gehoert zu genau einer Route; eine mehrstoeckige Route kann dasselbe
//     Label auf mehreren Stockwerken fuehren -> wird zu EINEM Eintrag zusammengefasst.
//   - Verschiedene Routen bleiben getrennt, auch wenn sie dieselbe label_id haben (Blender
//     vergibt IDs pro Stockwerk neu).
//   - Geraeteuebergreifend: dieselbe route_id auf allen Geraeten -> ein Eintrag.
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
      .select('device_id, floor_id, label_id, route_id, per_language, icon, keywords')
      .eq('account_id', accountId);
    if (labelError) {
      return send(res, 500, { success: false, error: 'Fehler beim Laden der Labels' });
    }

    const { data: overrideRows } = await supabase
      .from('label_overrides')
      .select('floor_id, label_id, per_language, icon, keywords, updated_at')
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

    // Composite-Key aus floor_id + label_id (eine konkrete Beschriftungs-Zeile)
    const compositeKey = (floorId, labelId) => `${String(floorId)}\u001f${String(labelId)}`;
    // Gruppen-Key: primaer die route_id (eine Beschriftung gehoert zu genau einer Route und
    // kann bei mehrstoeckigen Routen auf mehreren Stockwerken liegen -> ein Eintrag).
    // Fallback ohne Route: (floor_id + label_id).
    const groupKeyFor = (routeId, floorId, labelId) =>
      routeId ? `r:${String(routeId)}` : `fl:${compositeKey(floorId, labelId)}`;

    // Overrides je konkreter Zeile (floor_id + label_id) buendeln, Sprachen nach NAMEN.
    const overrideByPair = new Map();
    const overrideIconByPair = new Map(); // pairKey -> icon (string oder '' zum Loeschen)
    const overrideKeywordsByPair = new Map(); // pairKey -> keywords (Array; auch [] zum Leeren)
    (overrideRows || [])
      .sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')))
      .forEach(o => {
        const key = compositeKey(o.floor_id, o.label_id);
        if (!overrideByPair.has(key)) overrideByPair.set(key, {});
        const target = overrideByPair.get(key);
        Object.keys(o.per_language || {}).forEach(code => {
          const name = codeToName(code);
          const e = o.per_language[code] || {};
          if (!target[name]) target[name] = { title: '', subtitle: '' };
          if (e.title !== undefined && e.title !== null) target[name].title = e.title;
          if (e.subtitle !== undefined && e.subtitle !== null) target[name].subtitle = e.subtitle;
        });
        // Icon-Override (zuletzt aktualisiertes gewinnt; null = kein Override)
        if (o.icon !== undefined && o.icon !== null) {
          overrideIconByPair.set(key, String(o.icon));
        }
        // Keyword-Override (zuletzt aktualisiertes gewinnt; null = kein Override)
        if (Array.isArray(o.keywords)) {
          overrideKeywordsByPair.set(key, o.keywords.map(k => String(k)).filter(k => k.length > 0));
        }
      });

    // Gruppieren nach route_id: geraete- UND stockwerkuebergreifend zu einem Eintrag.
    const groups = new Map();
    (labelRows || []).forEach(l => {
      if (l.floor_id == null) return;
      const routeId = l.route_id || null;
      const key = groupKeyFor(routeId, l.floor_id, l.label_id);
      if (!groups.has(key)) {
        groups.set(key, {
          label_id: l.label_id,
          route_id: routeId,
          floor_id: String(l.floor_id),
          pairs: new Map(),       // pairKey -> { floor_id, label_id }
          floor_ids: new Set(),
          floor_names: new Set(),
          device_ids: new Set(),
          reported: {},
          reportedIcon: '',
          reportedKeywords: null
        });
      }
      const g = groups.get(key);
      const pairKey = compositeKey(l.floor_id, l.label_id);
      g.pairs.set(pairKey, { floor_id: String(l.floor_id), label_id: String(l.label_id) });
      g.floor_ids.add(String(l.floor_id));
      if (floorNames[String(l.floor_id)]) g.floor_names.add(floorNames[String(l.floor_id)]);
      if (l.device_id) g.device_ids.add(l.device_id);
      if (!g.reportedIcon && l.icon) g.reportedIcon = String(l.icon);
      // Keywords sind routen-/labelweit (sprachunabhaengig): erstes nicht-leeres gewinnt
      if (!g.reportedKeywords && Array.isArray(l.keywords) && l.keywords.length > 0) {
        g.reportedKeywords = l.keywords.map(k => String(k)).filter(k => k.length > 0);
      }
      mergeByName(g.reported, l.per_language);
    });

    const labels = [];
    groups.forEach(g => {
      // Overrides ueber alle Zeilen der Gruppe sammeln (bei einer Route identisch geschrieben)
      const override = {};
      let hasOverride = false;
      let iconOverride; // string oder undefined
      let hasIconOverride = false;
      let keywordsOverride; // Array oder undefined
      let hasKeywordsOverride = false;
      g.pairs.forEach((_p, pairKey) => {
        const ov = overrideByPair.get(pairKey);
        if (ov) {
          hasOverride = true;
          Object.keys(ov).forEach(name => {
            if (!override[name]) override[name] = { title: '', subtitle: '' };
            if (ov[name].title !== undefined && ov[name].title !== null) override[name].title = ov[name].title;
            if (ov[name].subtitle !== undefined && ov[name].subtitle !== null) override[name].subtitle = ov[name].subtitle;
          });
        }
        if (overrideIconByPair.has(pairKey)) {
          iconOverride = overrideIconByPair.get(pairKey);
          hasIconOverride = true;
        }
        if (overrideKeywordsByPair.has(pairKey)) {
          keywordsOverride = overrideKeywordsByPair.get(pairKey);
          hasKeywordsOverride = true;
        }
      });

      const effectiveIcon = hasIconOverride ? iconOverride : (g.reportedIcon || '');
      const effectiveKeywords = hasKeywordsOverride ? (keywordsOverride || []) : (g.reportedKeywords || []);
      const languages = {};

      // Basis: gemeldete Texte
      Object.keys(g.reported).forEach(lang => {
        languages[lang] = {
          title: g.reported[lang].title || '',
          subtitle: g.reported[lang].subtitle || ''
        };
      });

      // Overlay: Override (kanonisch)
      if (hasOverride) {
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
        floor_ids: Array.from(g.floor_ids),
        floor_name: Array.from(g.floor_names).join(', '),
        route_id: g.route_id,
        // Alle konkreten (floor_id,label_id)-Paare dieser Route fuer gezielte Updates
        pairs: Array.from(g.pairs.values()),
        device_ids: Array.from(g.device_ids),
        languages,
        has_override: hasOverride,
        icon: effectiveIcon,
        has_icon: Boolean(effectiveIcon),
        has_icon_override: hasIconOverride,
        keywords: effectiveKeywords,
        has_keywords_override: hasKeywordsOverride
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
