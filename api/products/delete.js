// api/products/delete.js - Produkt loeschen (Soft-Delete, Session-Auth).
// Setzt deleted=true, source='web', updated_at=now und loescht zugehoerige
// Kategorie-Zuordnungen (ebenfalls Soft-Delete), damit die Loeschung per
// Last-Writer-Wins ans Programm und an Web-Versionen propagiert.
const { supabase, setCors, send, readBody, resolveSession } = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return send(res, 405, { success: false, error: 'Method not allowed' });
  }

  try {
    const ctx = await resolveSession(req);
    if (!ctx) return send(res, 401, { success: false, error: 'Nicht authentifiziert' });
    const accountId = ctx.effectiveAccountId;

    const body = readBody(req);
    const productId = body.product_id != null ? String(body.product_id) : (req.query.product_id ? String(req.query.product_id) : '');
    if (!productId) return send(res, 400, { success: false, error: 'product_id ist erforderlich' });

    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('products')
      .select('product_id, is_placeholder')
      .eq('account_id', accountId)
      .eq('product_id', productId)
      .maybeSingle();
    if (!existing) return send(res, 404, { success: false, error: 'Produkt nicht gefunden' });
    if (existing.is_placeholder) return send(res, 400, { success: false, error: 'Platzhalter-Produkt kann nicht gelöscht werden' });

    const { error: delErr } = await supabase
      .from('products')
      .update({ deleted: true, source: 'web', updated_at: now })
      .eq('account_id', accountId)
      .eq('product_id', productId);
    if (delErr) {
      console.error('Product delete error:', delErr.message);
      return send(res, 500, { success: false, error: 'Produkt konnte nicht gelöscht werden' });
    }

    await supabase
      .from('product_category_assignments')
      .update({ deleted: true, source: 'web', updated_at: now })
      .eq('account_id', accountId)
      .eq('product_id', productId);

    return send(res, 200, { success: true });
  } catch (error) {
    console.error('Product delete error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
