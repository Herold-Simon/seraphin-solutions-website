// api/budget/list.js - Budgets + Ausgaben laden (nur Master)
const { supabase, setCors, send, resolveSession } = require('../_lib/db');

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
      .select('id, name, description, amount_cents, currency, period_start, period_end, color, is_archived, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (!includeArchived) {
      budgetQuery = budgetQuery.eq('is_archived', false);
    }

    const { data: budgets, error: budgetError } = await budgetQuery;
    if (budgetError) {
      console.error('Budget list error:', budgetError.message);
      return send(res, 500, { success: false, error: 'Fehler beim Laden der Budgets' });
    }

    const budgetIds = (budgets || []).map(b => b.id);
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

    const spentByBudget = {};
    expenses.forEach(e => {
      spentByBudget[e.budget_id] = (spentByBudget[e.budget_id] || 0) + (e.amount_cents || 0);
    });

    const enriched = (budgets || []).map(b => {
      const spent = spentByBudget[b.id] || 0;
      const remaining = b.amount_cents - spent;
      const usagePercent = b.amount_cents > 0 ? Math.round((spent / b.amount_cents) * 1000) / 10 : 0;
      return {
        ...b,
        spent_cents: spent,
        remaining_cents: remaining,
        usage_percent: usagePercent,
        expense_count: expenses.filter(e => e.budget_id === b.id).length
      };
    });

    const totalBudget = enriched.filter(b => !b.is_archived).reduce((s, b) => s + b.amount_cents, 0);
    const totalSpent = enriched.filter(b => !b.is_archived).reduce((s, b) => s + b.spent_cents, 0);

    return send(res, 200, {
      success: true,
      budgets: enriched,
      expenses,
      summary: {
        total_budget_cents: totalBudget,
        total_spent_cents: totalSpent,
        total_remaining_cents: totalBudget - totalSpent,
        active_budgets: enriched.filter(b => !b.is_archived).length
      }
    });
  } catch (error) {
    console.error('Budget list error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
