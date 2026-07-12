// api/products/push.js - App pusht Produktmodus-Daten (Produkte, Produktkategorien,
// Zuordnungen) in die kontobezogenen Tabellen. Kein Cookie: account_id + device_id im Body.
//
// Konfliktloesung (Last-Writer-Wins): Eine eingehende Zeile ueberschreibt die
// bestehende nur, wenn ihr updated_at strikt neuer ist. Website-Aenderungen setzen
// serverseitig updated_at=now und gewinnen so gegen aelteren Programm-Stand.
// Loeschungen werden per Soft-Delete (deleted=true) synchronisiert, aber NUR fuer
// Zeilen mit source='device' (von der Website angelegte Produkte bleiben unberuehrt).
const {
  supabase, hasSupabaseConfig, setCors, send, readBody, timestampToIso
} = require('../_lib/db');

function toMs(iso) {
  const t = Date.parse(iso);
  return isNaN(t) ? 0 : t;
}

async function upsertChunks(table, rows, onConflict, chunkSize = 10) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      console.error(`${table} upsert error:`, error.message);
      return { ok: false, error };
    }
  }
  return { ok: true };
}

// LWW-Sync fuer Produkte/Produktkategorien (einfacher Business-Key + Inhalt).
async function lwwSync({ table, bizKey, incoming, mapRow, accountId, now }) {
  const { data: existingRows, error: selError } = await supabase
    .from(table)
    .select(`id, ${bizKey}, updated_at, source, deleted`)
    .eq('account_id', accountId);
  if (selError) return { ok: false, error: selError };

  const existingByKey = new Map((existingRows || []).map(r => [String(r[bizKey]), r]));
  const incomingKeys = new Set();
  const rows = [];
  for (const item of incoming) {
    const mapped = mapRow(item);
    if (!mapped) continue;
    incomingKeys.add(mapped.key);
    const existing = existingByKey.get(mapped.key);
    if (existing && toMs(existing.updated_at) >= toMs(mapped.row.updated_at)) continue;
    rows.push(mapped.row);
  }

  const up = await upsertChunks(table, rows, `account_id,${bizKey}`, 8);
  if (!up.ok) return up;

  // Verwaiste device-Zeilen soft-loeschen (Website-Zeilen unberuehrt lassen).
  const toDelete = (existingRows || [])
    .filter(r => r.source === 'device' && !r.deleted && !incomingKeys.has(String(r[bizKey])))
    .map(r => String(r[bizKey]));
  for (let i = 0; i < toDelete.length; i += 100) {
    const chunk = toDelete.slice(i, i + 100);
    const { error } = await supabase
      .from(table)
      .update({ deleted: true, updated_at: now })
      .eq('account_id', accountId)
      .in(bizKey, chunk);
    if (error) return { ok: false, error };
  }
  return { ok: true };
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });
  if (!hasSupabaseConfig()) return send(res, 500, { success: false, error: 'Server-Konfiguration fehlt' });

  try {
    const body = readBody(req);
    const account_id = body.account_id;
    const products = Array.isArray(body.products) ? body.products : [];
    const categories = Array.isArray(body.product_categories) ? body.product_categories : [];
    const assignments = Array.isArray(body.product_category_assignments) ? body.product_category_assignments : [];

    if (!account_id) {
      return send(res, 400, { success: false, error: 'account_id ist erforderlich' });
    }

    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', String(account_id))
      .maybeSingle();
    if (!account) return send(res, 404, { success: false, error: 'Konto nicht gefunden' });

    const accountId = account.id;
    const now = new Date().toISOString();

    // --- Produkte ---
    const prodResult = await lwwSync({
      table: 'products',
      bizKey: 'product_id',
      incoming: products,
      accountId,
      now,
      mapRow: (p) => {
        const pid = String(p.product_id != null ? p.product_id : p.id || '');
        if (!pid) return null;
        const updatedAt = timestampToIso(p.updated_at != null ? p.updated_at : p.updatedAt) || now;
        return {
          key: pid,
          row: {
            account_id: accountId,
            product_id: pid,
            title: p.title || '',
            per_language: p.per_language || p.multilingualContent || {},
            keywords: Array.isArray(p.keywords) ? p.keywords.map(k => String(k)) : [],
            image: p.image != null ? String(p.image) : (p.imageBase64 != null ? String(p.imageBase64) : null),
            route_id: p.route_id != null ? String(p.route_id) : (p.routeId != null ? String(p.routeId) : null),
            is_placeholder: Boolean(p.is_placeholder != null ? p.is_placeholder : p.isPlaceholder),
            order: parseInt(p.order, 10) || 0,
            source: 'device',
            deleted: false,
            updated_at: updatedAt
          }
        };
      }
    });
    if (!prodResult.ok) return send(res, 500, { success: false, error: 'Produkte konnten nicht gespeichert werden' });

    // --- Produktkategorien ---
    const catResult = await lwwSync({
      table: 'product_categories',
      bizKey: 'category_id',
      incoming: categories,
      accountId,
      now,
      mapRow: (c) => {
        const cid = String(c.category_id != null ? c.category_id : c.id || '');
        if (!cid) return null;
        const updatedAt = timestampToIso(c.updated_at != null ? c.updated_at : c.updatedAt) || now;
        return {
          key: cid,
          row: {
            account_id: accountId,
            category_id: cid,
            title: c.title || '',
            per_language: c.per_language || c.multilingualContent || {},
            keywords: Array.isArray(c.keywords) ? c.keywords.map(k => String(k)) : [],
            image: c.image != null ? String(c.image) : (c.imageBase64 != null ? String(c.imageBase64) : null),
            order: parseInt(c.order, 10) || 0,
            source: 'device',
            deleted: false,
            updated_at: updatedAt
          }
        };
      }
    });
    if (!catResult.ok) return send(res, 500, { success: false, error: 'Produktkategorien konnten nicht gespeichert werden' });

    // --- Zuordnungen Produkt <-> Kategorie ---
    {
      const { data: existingRows } = await supabase
        .from('product_category_assignments')
        .select('id, product_id, category_id, source, deleted')
        .eq('account_id', accountId);
      const keyOf = (r) => `${String(r.product_id)}\u001f${String(r.category_id)}`;
      const incomingKeys = new Set();
      const rows = [];
      for (const a of assignments) {
        const pid = String(a.product_id != null ? a.product_id : a.productId || '');
        const cid = String(a.category_id != null ? a.category_id : a.categoryId || '');
        if (!pid || !cid) continue;
        const key = `${pid}\u001f${cid}`;
        incomingKeys.add(key);
        const existing = (existingRows || []).find(r => keyOf(r) === key);
        if (existing && existing.source === 'web') continue; // Website-Zuordnung nicht ueberschreiben
        rows.push({
          account_id: accountId,
          product_id: pid,
          category_id: cid,
          order: parseInt(a.order, 10) || 0,
          source: 'device',
          deleted: false,
          updated_at: now
        });
      }
      const up = await upsertChunks('product_category_assignments', rows, 'account_id,product_id,category_id', 25);
      if (!up.ok) return send(res, 500, { success: false, error: 'Zuordnungen konnten nicht gespeichert werden' });

      const toDelete = (existingRows || [])
        .filter(r => r.source === 'device' && !r.deleted && !incomingKeys.has(keyOf(r)))
        .map(r => r.id);
      for (let i = 0; i < toDelete.length; i += 100) {
        const chunk = toDelete.slice(i, i + 100);
        await supabase
          .from('product_category_assignments')
          .update({ deleted: true, updated_at: now })
          .in('id', chunk);
      }
    }

    return send(res, 200, { success: true, message: 'Produktdaten synchronisiert' });
  } catch (error) {
    console.error('Products push error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
