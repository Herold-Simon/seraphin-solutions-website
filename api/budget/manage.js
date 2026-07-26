// api/budget/manage.js - Budget erstellen/aktualisieren/archivieren/loeschen (nur Master)
const { supabase, setCors, send, readBody, resolveSession } = require('../_lib/db');
const { currentMonthKey } = require('../_lib/budgetTopup');

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
  if (!Number.isFinite(euros) || euros < 0) return null;
  return Math.round(euros * 100);
}

function parseCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
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
      const name = clean(body.name, 120);
      const description = clean(body.description, 1000) || null;
      const monthlyCents = body.monthly_amount_cents != null
        ? parseCents(body.monthly_amount_cents)
        : parseEuroToCents(body.monthly_amount != null ? body.monthly_amount : body.amount);
      const color = clean(body.color, 20) || '#008CFF';
      const month = currentMonthKey();

      if (!name) return send(res, 400, { success: false, error: 'Bitte einen Budget-Namen angeben.' });
      if (monthlyCents == null || monthlyCents < 0) {
        return send(res, 400, { success: false, error: 'Bitte einen gültigen monatlichen Betrag angeben.' });
      }

      const { data, error } = await supabase
        .from('budgets')
        .insert({
          name,
          description,
          monthly_amount_cents: monthlyCents,
          surplus_cents: 0,
          amount_cents: monthlyCents,
          last_credited_month: month,
          color,
          updated_at: new Date().toISOString()
        })
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('Budget create error:', error.message);
        return send(res, 500, { success: false, error: 'Fehler beim Erstellen des Budgets' });
      }

      if (data && data.id) {
        await supabase.from('budget_credits').upsert({
          budget_id: data.id,
          credit_month: month,
          amount_cents: monthlyCents
        }, { onConflict: 'budget_id,credit_month', ignoreDuplicates: true });
      }

      return send(res, 200, { success: true, id: data && data.id });
    }

    if (action === 'update') {
      const id = body.id;
      if (!id) return send(res, 400, { success: false, error: 'ID fehlt' });

      const patch = { updated_at: new Date().toISOString() };
      if (body.name != null) {
        const name = clean(body.name, 120);
        if (!name) return send(res, 400, { success: false, error: 'Name darf nicht leer sein.' });
        patch.name = name;
      }
      if (body.description !== undefined) patch.description = clean(body.description, 1000) || null;

      if (body.monthly_amount_cents != null || body.monthly_amount != null || body.amount != null) {
        const monthlyCents = body.monthly_amount_cents != null
          ? parseCents(body.monthly_amount_cents)
          : parseEuroToCents(body.monthly_amount != null ? body.monthly_amount : body.amount);
        if (monthlyCents == null || monthlyCents < 0) {
          return send(res, 400, { success: false, error: 'Bitte einen gültigen monatlichen Betrag angeben.' });
        }
        patch.monthly_amount_cents = monthlyCents;

        // amount_cents = aktuelles Gesamtbudget (Monatsbetrag + bestehender Überschuss)
        const { data: existing } = await supabase
          .from('budgets')
          .select('surplus_cents')
          .eq('id', id)
          .maybeSingle();
        const surplus = Math.max(0, Number(existing && existing.surplus_cents) || 0);
        patch.amount_cents = monthlyCents + surplus;
      }

      if (body.color != null) patch.color = clean(body.color, 20) || '#008CFF';
      if (body.is_archived != null) patch.is_archived = Boolean(body.is_archived);

      const { error } = await supabase.from('budgets').update(patch).eq('id', id);
      if (error) {
        console.error('Budget update error:', error.message);
        return send(res, 500, { success: false, error: 'Fehler beim Aktualisieren' });
      }
      return send(res, 200, { success: true });
    }

    if (action === 'delete') {
      const id = body.id;
      if (!id) return send(res, 400, { success: false, error: 'ID fehlt' });
      const { error } = await supabase.from('budgets').delete().eq('id', id);
      if (error) {
        console.error('Budget delete error:', error.message);
        return send(res, 500, { success: false, error: 'Fehler beim Löschen' });
      }
      return send(res, 200, { success: true });
    }

    return send(res, 400, { success: false, error: 'Unbekannte Aktion' });
  } catch (error) {
    console.error('Budget manage error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
