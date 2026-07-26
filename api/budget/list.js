// api/budget/list.js - Budgets + Ausgaben laden (nur Master)
// Monatliches Modell: Monatsbetrag + Überschuss vom letzten Monat.
const { supabase, setCors, send, resolveSession } = require('../_lib/db');
const {
  applyMonthlyTopups,
  currentMonthKey,
  spentInMonth
} = require('../_lib/budgetTopup');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return send(res, 405, { success: false, error: 'Method not allowed' });

  try {
    const ctx = await resolveSession(req);
    if (!ctx) return send(res, 401, { success: false, error: 'Nicht authentifiziert' });
    if (!ctx.isMaster) return send(res, 403, { success: false, error: 'Nur für Master-Konten verfügbar' });

    const includeArchived = String(req.query.include_archived || '') === '1';

    let budgetQuery = supabase
      .from('budgets')
      .select('id, name, description, amount_cents, monthly_amount_cents, surplus_cents, last_credited_month, currency, color, is_archived, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (!includeArchived) {
      budgetQuery = budgetQuery.eq('is_archived', false);
    }

    const { data: budgetsRaw, error: budgetError } = await budgetQuery;
    if (budgetError) {
      console.error('Budget list error:', budgetError.message);
      return send(res, 500, { success: false, error: 'Fehler beim Laden der Budgets' });
    }

    const budgetIds = (budgetsRaw || []).map(b => b.id);
    let expenses = [];
    if (budgetIds.length > 0) {
      const { data: expenseData, error: expenseError } = await supabase
        .from('budget_expenses')
        .select('id, budget_id, title, amount_cents, category, spent_on, notes, created_at, updated_at')
        .in('budget_id', budgetIds)
        .order('spent_on', { ascending: false });

      if (expenseError) {
        console.error('Expense list error:', expenseError.message);
        return send(res, 500, { success: false, error: 'Fehler beim Laden der Ausgaben' });
      }
      expenses = expenseData || [];
    }

    // Monatswechsel anwenden (Überschuss berechnen + neuer Monat)
    const { budgets, currentMonth } = await applyMonthlyTopups(supabase, budgetsRaw || [], expenses);

    const enriched = budgets.map(b => {
      const monthly = Math.max(0, Number(b.monthly_amount_cents) || 0);
      const surplus = Math.max(0, Number(b.surplus_cents) || 0);
      const available = monthly + surplus;
      const spentThisMonth = spentInMonth(expenses, b.id, currentMonth);
      const remaining = available - spentThisMonth;
      const usagePercent = available > 0
        ? Math.round((spentThisMonth / available) * 1000) / 10
        : 0;

      return {
        ...b,
        monthly_amount_cents: monthly,
        surplus_cents: surplus,
        available_cents: available,
        amount_cents: available,
        spent_cents: spentThisMonth,
        remaining_cents: remaining,
        usage_percent: usagePercent,
        expense_count: expenses.filter(e => e.budget_id === b.id).length,
        expense_count_month: expenses.filter(e => {
          const day = String(e.spent_on || '').slice(0, 7);
          return e.budget_id === b.id && day === currentMonth;
        }).length,
        current_month: currentMonth
      };
    });

    const active = enriched.filter(b => !b.is_archived);
    const totalMonthly = active.reduce((s, b) => s + b.monthly_amount_cents, 0);
    const totalSurplus = active.reduce((s, b) => s + b.surplus_cents, 0);
    const totalAvailable = active.reduce((s, b) => s + b.available_cents, 0);
    const totalSpent = active.reduce((s, b) => s + b.spent_cents, 0);

    return send(res, 200, {
      success: true,
      current_month: currentMonth || currentMonthKey(),
      budgets: enriched,
      expenses,
      summary: {
        total_monthly_cents: totalMonthly,
        total_surplus_cents: totalSurplus,
        total_budget_cents: totalAvailable,
        total_spent_cents: totalSpent,
        total_remaining_cents: totalAvailable - totalSpent,
        active_budgets: active.length
      }
    });
  } catch (error) {
    console.error('Budget list error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
