// api/products/pull.js - App holt Produktmodus-Aenderungen (Website -> Geraet).
// Liefert Produkte, Produktkategorien und Zuordnungen (inkl. deleted-Flag), die seit
// `since` aktualisiert wurden. Ohne `since` wird der gesamte Bestand geliefert.
const {
  supabase, hasSupabaseConfig, setCors, send
} = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return send(res, 405, { success: false, error: 'Method not allowed' });
  if (!hasSupabaseConfig()) return send(res, 500, { success: false, error: 'Server-Konfiguration fehlt' });

  try {
    const accountId = req.query.account_id;
    const deviceId = req.query.device_id;
    const since = req.query.since;

    if (!accountId) {
      return send(res, 400, { success: false, error: 'account_id ist erforderlich' });
    }

    if (deviceId) {
      await supabase
        .from('devices')
        .update({ last_active: new Date().toISOString() })
        .eq('account_id', String(accountId))
        .eq('device_id', String(deviceId));
    }

    const buildQuery = (table, columns) => {
      let q = supabase
        .from(table)
        .select(columns)
        .eq('account_id', String(accountId))
        .order('updated_at', { ascending: true });
      if (since) q = q.gt('updated_at', since);
      return q;
    };

    const [{ data: products, error: pErr }, { data: categories, error: cErr }, { data: assignments, error: aErr }] = await Promise.all([
      buildQuery('products', 'product_id, title, per_language, keywords, image, route_id, is_placeholder, "order", deleted, updated_at'),
      buildQuery('product_categories', 'category_id, title, per_language, keywords, image, "order", deleted, updated_at'),
      buildQuery('product_category_assignments', 'product_id, category_id, "order", deleted, updated_at')
    ]);

    if (pErr || cErr || aErr) {
      return send(res, 500, { success: false, error: 'Fehler beim Laden der Produktdaten' });
    }

    return send(res, 200, {
      success: true,
      products: products || [],
      product_categories: categories || [],
      product_category_assignments: assignments || [],
      server_time: new Date().toISOString()
    });
  } catch (error) {
    console.error('Products pull error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
