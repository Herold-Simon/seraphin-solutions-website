// api/products/list.js - Produktmodus-Daten fuer das Dashboard (Session-Auth).
// Liefert Produkte, Produktkategorien, Zuordnungen des effektiven Kontos sowie die
// Liste zuteilbarer Routen (Routen, denen im Programm bereits ein Produkt inkl.
// Platzhalter zugeteilt war) mit Routentiteln.
const { supabase, setCors, send, resolveSession } = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return send(res, 405, { success: false, error: 'Method not allowed' });

  try {
    const ctx = await resolveSession(req);
    if (!ctx) return send(res, 401, { success: false, error: 'Nicht authentifiziert' });
    const accountId = ctx.effectiveAccountId;

    const [{ data: productRows }, { data: categoryRows }, { data: assignmentRows }, { data: routeStatRows }, { data: deviceRows }] = await Promise.all([
      supabase.from('products')
        .select('product_id, title, per_language, keywords, image, route_id, is_placeholder, "order", deleted, updated_at')
        .eq('account_id', accountId),
      supabase.from('product_categories')
        .select('category_id, title, per_language, keywords, image, "order", deleted, updated_at')
        .eq('account_id', accountId),
      supabase.from('product_category_assignments')
        .select('product_id, category_id, "order", deleted')
        .eq('account_id', accountId),
      supabase.from('route_stats')
        .select('route_id, title')
        .eq('account_id', accountId),
      supabase.from('devices')
        .select('languages')
        .eq('account_id', accountId),
    ]);

    const allProducts = (productRows || []).filter(p => !p.deleted);
    // Zuteilbare Routen: alle route_ids, denen ein Produkt (inkl. Platzhalter) zugeteilt ist.
    const routeTitleById = {};
    (routeStatRows || []).forEach(r => {
      if (r.route_id != null && r.title && !routeTitleById[String(r.route_id)]) {
        routeTitleById[String(r.route_id)] = String(r.title);
      }
    });
    const assignableRouteIds = new Set();
    allProducts.forEach(p => { if (p.route_id) assignableRouteIds.add(String(p.route_id)); });
    const assignableRoutes = Array.from(assignableRouteIds).map(rid => ({
      route_id: rid,
      title: routeTitleById[rid] || rid,
    })).sort((a, b) => String(a.title).localeCompare(String(b.title)));

    // Sprachen (id + Name) aus den Geraeten fuer die mehrsprachige Titelbearbeitung.
    const languageMap = new Map();
    (deviceRows || []).forEach(d => {
      if (Array.isArray(d.languages)) {
        d.languages.forEach(l => {
          if (l && l.id != null && !languageMap.has(String(l.id))) {
            languageMap.set(String(l.id), { id: String(l.id), name: String(l.name != null ? l.name : l.id) });
          }
        });
      }
    });

    // Sichtbare Produkte (ohne Platzhalter) fuer Anzeige/Bearbeitung.
    const products = allProducts
      .filter(p => !p.is_placeholder)
      .map(p => ({
        product_id: p.product_id,
        title: p.title || '',
        per_language: p.per_language || {},
        keywords: Array.isArray(p.keywords) ? p.keywords : [],
        image: p.image || null,
        route_id: p.route_id || null,
        order: p.order || 0,
      }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const product_categories = (categoryRows || [])
      .filter(c => !c.deleted)
      .map(c => ({
        category_id: c.category_id,
        title: c.title || '',
        per_language: c.per_language || {},
        image: c.image || null,
        order: c.order || 0,
      }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const product_category_assignments = (assignmentRows || [])
      .filter(a => !a.deleted)
      .map(a => ({ product_id: a.product_id, category_id: a.category_id, order: a.order || 0 }));

    return send(res, 200, {
      success: true,
      products,
      product_categories,
      product_category_assignments,
      assignable_routes: assignableRoutes,
      languages: Array.from(languageMap.values()),
    });
  } catch (error) {
    console.error('Products list error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
