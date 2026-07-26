// api/budget/expense.js - Ausgaben erstellen/aktualisieren/loeschen (nur Master)
const { supabase, setCors, send, readBody, resolveSession } = require('../_lib/db');

function clean(value, maxLength) {
  const str = String(value == null ? '' : value).trim();
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

function parseEuroToCents(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');
  const euros = Number(normalized);
  if (!Number.isFinite(euros) || euros <= 0) return null;
  return Math.round(euros * 100);
}

function parseCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });

  try {
    const ctx = await resolveSession(req);
    if (!ctx) return send(res, 401, { success: false, error: 'Nicht authentifiziert' });
    if (!ctx.isMaster) return send(res, 403, { success: false, error: 'Nur für Master-Konten verfügbar' });

    const body = readBody(req);
    const action = clean(body.action, 40);

    if (action === 'create') {
      const budgetId = body.budget_id;
      const title = clean(body.title, 200);
      const amountCents = body.amount_cents != null
        ? parseCents(body.amount_cents)
        : parseEuroToCents(body.amount);
      // Immer aktueller Zeitstempel (Datum + Uhrzeit inkl. Sekunden)
      const spentOn = new Date().toISOString();

      if (!budgetId) return send(res, 400, { success: false, error: 'Budget fehlt' });
      if (!title) return send(res, 400, { success: false, error: 'Bitte einen Titel angeben.' });
      if (amountCents == null) return send(res, 400, { success: false, error: 'Bitte einen gültigen Betrag angeben.' });

      const { data: budget } = await supabase
        .from('budgets')
        .select('id')
        .eq('id', budgetId)
        .maybeSingle();
      if (!budget) return send(res, 404, { success: false, error: 'Budget nicht gefunden' });

      const { data, error } = await supabase
        .from('budget_expenses')
        .insert({
          budget_id: budgetId,
          title,
          amount_cents: amountCents,
          category: null,
          spent_on: spentOn,
          notes: null,
          updated_at: new Date().toISOString()
        })
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('Expense create error:', error.message);
        return send(res, 500, { success: false, error: 'Fehler beim Speichern der Ausgabe' });
      }
      return send(res, 200, { success: true, id: data && data.id });
    }

    if (action === 'update') {
      const id = body.id;
      if (!id) return send(res, 400, { success: false, error: 'ID fehlt' });

      const patch = { updated_at: new Date().toISOString() };
      if (body.budget_id != null) patch.budget_id = body.budget_id;
      if (body.title != null) {
        const title = clean(body.title, 200);
        if (!title) return send(res, 400, { success: false, error: 'Titel darf nicht leer sein.' });
        patch.title = title;
      }
      if (body.amount_cents != null || body.amount != null) {
        const amountCents = body.amount_cents != null
          ? parseCents(body.amount_cents)
          : parseEuroToCents(body.amount);
        if (amountCents == null) return send(res, 400, { success: false, error: 'Bitte einen gültigen Betrag angeben.' });
        patch.amount_cents = amountCents;
      }

      const { error } = await supabase.from('budget_expenses').update(patch).eq('id', id);
      if (error) {
        console.error('Expense update error:', error.message);
        return send(res, 500, { success: false, error: 'Fehler beim Aktualisieren' });
      }
      return send(res, 200, { success: true });
    }

    if (action === 'delete') {
      const id = body.id;
      if (!id) return send(res, 400, { success: false, error: 'ID fehlt' });
      const { error } = await supabase.from('budget_expenses').delete().eq('id', id);
      if (error) {
        console.error('Expense delete error:', error.message);
        return send(res, 500, { success: false, error: 'Fehler beim Löschen' });
      }
      return send(res, 200, { success: true });
    }

    return send(res, 400, { success: false, error: 'Unbekannte Aktion' });
  } catch (error) {
    console.error('Expense manage error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
