// api/products/save.js - Produkt anlegen/bearbeiten (Session-Auth, Dashboard).
// Setzt source='web' und updated_at=now, damit die Website-Aenderung beim naechsten
// Programm-Push per Last-Writer-Wins gewinnt. Ausserdem koennen Produkt<->Kategorie-
// Zuordnungen (category_ids) mitgegeben werden.
const crypto = require('crypto');
const { supabase, setCors, send, readBody, resolveSession } = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return send(res, 405, { success: false, error: 'Method not allowed' });
  }

  try {
    const ctx = await resolveSession(req);
    if (!ctx) return send(res, 401, { success: false, error: 'Nicht authentifiziert' });
    const accountId = ctx.effectiveAccountId;

    const body = readBody(req);
    const now = new Date().toISOString();

    let productId = body.product_id != null ? String(body.product_id) : '';
    const isNew = !productId;
    if (isNew) productId = `web-${crypto.randomUUID()}`;

    // Bestehende Zeile laden (Order beibehalten, Existenz pruefen).
    let existing = null;
    if (!isNew) {
      const { data } = await supabase
        .from('products')
        .select('product_id, "order", is_placeholder')
        .eq('account_id', accountId)
        .eq('product_id', productId)
        .maybeSingle();
      existing = data || null;
      if (!existing) return send(res, 404, { success: false, error: 'Produkt nicht gefunden' });
      if (existing.is_placeholder) return send(res, 400, { success: false, error: 'Platzhalter-Produkt ist nicht bearbeitbar' });
    }

    const row = {
      account_id: accountId,
      product_id: productId,
      title: body.title != null ? String(body.title) : '',
      per_language: body.per_language && typeof body.per_language === 'object' ? body.per_language : {},
      keywords: Array.isArray(body.keywords) ? body.keywords.map(k => String(k)) : [],
      image: body.image != null ? String(body.image) : null,
      route_id: body.route_id != null && body.route_id !== '' ? String(body.route_id) : null,
      is_placeholder: false,
      order: existing ? (existing.order || 0) : (parseInt(body.order, 10) || 0),
      source: 'web',
      deleted: false,
      updated_at: now,
    };

    const { error: upErr } = await supabase
      .from('products')
      .upsert(row, { onConflict: 'account_id,product_id' });
    if (upErr) {
      console.error('Product save upsert error:', upErr.message);
      return send(res, 500, { success: false, error: 'Produkt konnte nicht gespeichert werden' });
    }

    // Optional: Kategorie-Zuordnungen aktualisieren (vollstaendige Ersetzung).
    if (Array.isArray(body.category_ids)) {
      const desired = new Set(body.category_ids.map(c => String(c)));
      const { data: existingAsg } = await supabase
        .from('product_category_assignments')
        .select('id, category_id, deleted')
        .eq('account_id', accountId)
        .eq('product_id', productId);

      const existingActive = new Map();
      (existingAsg || []).forEach(a => existingActive.set(String(a.category_id), a));

      // Hinzufuegen / Reaktivieren
      const toUpsert = [];
      desired.forEach(cid => {
        toUpsert.push({
          account_id: accountId,
          product_id: productId,
          category_id: cid,
          order: 0,
          source: 'web',
          deleted: false,
          updated_at: now,
        });
      });
      if (toUpsert.length) {
        await supabase
          .from('product_category_assignments')
          .upsert(toUpsert, { onConflict: 'account_id,product_id,category_id' });
      }

      // Entfernte Zuordnungen soft-loeschen
      const toRemove = (existingAsg || [])
        .filter(a => !a.deleted && !desired.has(String(a.category_id)))
        .map(a => a.id);
      if (toRemove.length) {
        await supabase
          .from('product_category_assignments')
          .update({ deleted: true, updated_at: now })
          .in('id', toRemove);
      }
    }

    return send(res, 200, { success: true, product_id: productId, created: isNew });
  } catch (error) {
    console.error('Product save error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
