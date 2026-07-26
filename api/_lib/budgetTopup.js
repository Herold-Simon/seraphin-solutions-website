// api/_lib/budgetTopup.js
// Monatliches Budget-Modell:
// - Jeden Monat wird ein fest definierter Betrag (monthly_amount_cents) gutgeschrieben.
// - Nicht ausgegebenes Geld aus dem Vormonat wird als Überschuss (surplus_cents) übernommen.
// - Verfügbar im aktuellen Monat = Monatsbetrag + Überschuss vom letzten Monat.

function currentMonthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  return `${year}-${month}`;
}

function nextMonthKey(monthKey) {
  const [y, m] = String(monthKey || '').split('-').map(Number);
  if (!y || !m) return null;
  let year = y;
  let month = m + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

function compareMonthKeys(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function monthRange(monthKey) {
  const next = nextMonthKey(monthKey);
  return {
    start: `${monthKey}-01`,
    endExclusive: next ? `${next}-01` : null
  };
}

function toBerlinMonthKey(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    // Fallback fuer reine Datumsstrings YYYY-MM-DD
    return String(value).slice(0, 7);
  }
  return currentMonthKey(d);
}

function spentInMonth(expenses, budgetId, monthKey) {
  return (expenses || [])
    .filter(e => e.budget_id === budgetId)
    .filter(e => toBerlinMonthKey(e.spent_on) === monthKey)
    .reduce((sum, e) => sum + (Number(e.amount_cents) || 0), 0);
}

/**
 * Zieht Monatswechsel nach:
 * Für jeden abgeschlossenen Monat wird berechnet, wie viel übrig blieb,
 * und dieser Rest wird als Überschuss in den Folgemonat übernommen.
 * Der neue Monat startet wieder mit dem definierten Monatsbetrag + Überschuss.
 */
async function applyMonthlyTopups(supabase, budgets, expenses) {
  const nowMonth = currentMonthKey();
  const updated = [];
  const credits = [];

  for (const budget of budgets || []) {
    if (budget.is_archived) {
      updated.push(budget);
      continue;
    }

    const monthly = Math.max(0, Number(budget.monthly_amount_cents) || 0);
    let last = budget.last_credited_month || nowMonth;
    let surplus = Math.max(0, Number(budget.surplus_cents) || 0);

    if (compareMonthKeys(last, nowMonth) >= 0) {
      updated.push({
        ...budget,
        monthly_amount_cents: monthly,
        surplus_cents: surplus,
        amount_cents: monthly + surplus,
        last_credited_month: last
      });
      continue;
    }

    let guard = 0;
    while (compareMonthKeys(last, nowMonth) < 0 && guard < 240) {
      const available = monthly + surplus;
      const spent = spentInMonth(expenses, budget.id, last);
      surplus = Math.max(0, available - spent);

      const next = nextMonthKey(last);
      if (!next) break;

      credits.push({
        budget_id: budget.id,
        credit_month: next,
        amount_cents: monthly
      });

      last = next;
      guard += 1;
    }

    const amountCents = monthly + surplus;
    const { error: updateError } = await supabase
      .from('budgets')
      .update({
        monthly_amount_cents: monthly,
        surplus_cents: surplus,
        amount_cents: amountCents,
        last_credited_month: last,
        updated_at: new Date().toISOString()
      })
      .eq('id', budget.id);

    if (updateError) {
      console.error('Budget month rollover error:', updateError.message);
      updated.push(budget);
      continue;
    }

    updated.push({
      ...budget,
      monthly_amount_cents: monthly,
      surplus_cents: surplus,
      amount_cents: amountCents,
      last_credited_month: last
    });
  }

  if (credits.length > 0) {
    const { error: creditError } = await supabase
      .from('budget_credits')
      .upsert(credits, { onConflict: 'budget_id,credit_month', ignoreDuplicates: true });
    if (creditError) {
      console.error('Budget credit log error:', creditError.message);
    }
  }

  return { budgets: updated, currentMonth: nowMonth };
}

module.exports = {
  currentMonthKey,
  nextMonthKey,
  compareMonthKeys,
  toBerlinMonthKey,
  spentInMonth,
  applyMonthlyTopups
};
