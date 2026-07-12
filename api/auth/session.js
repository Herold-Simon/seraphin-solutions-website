// api/auth/session.js - Aktuelle Session pruefen (inkl. Master-Status + verkoerpertes Konto)
const { supabase, setCors, send, resolveSession } = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return send(res, 405, { success: false, error: 'Method not allowed' });

  try {
    const ctx = await resolveSession(req);
    if (!ctx) {
      return send(res, 401, { success: false, error: 'Nicht authentifiziert' });
    }

    // Effektives Konto (verkoerpertes Konto bei Master, sonst eigenes)
    let effectiveAccount = ctx.actingAccount || ctx.account;
    if (effectiveAccount.id !== ctx.account.id && !effectiveAccount.created_at) {
      const { data } = await supabase
        .from('accounts')
        .select('id, username, created_at')
        .eq('id', ctx.effectiveAccountId)
        .maybeSingle();
      if (data) effectiveAccount = data;
    }

    // Produktmodus-Flag des effektiven Kontos (bestimmt Standard-Landeseite + Menue).
    let productMode = false;
    try {
      const { data: pmRow } = await supabase
        .from('accounts')
        .select('product_mode')
        .eq('id', ctx.effectiveAccountId)
        .maybeSingle();
      productMode = Boolean(pmRow && pmRow.product_mode);
    } catch (e) {
      productMode = false;
    }

    return send(res, 200, {
      success: true,
      user: {
        id: ctx.account.id,
        username: ctx.account.username,
        is_master: ctx.isMaster
      },
      acting_account: ctx.actingAccount
        ? { id: ctx.actingAccount.id, username: ctx.actingAccount.username }
        : null,
      effective_account_id: ctx.effectiveAccountId,
      product_mode: productMode,
      account: {
        id: effectiveAccount.id,
        username: effectiveAccount.username,
        created_at: effectiveAccount.created_at || null
      }
    });
  } catch (error) {
    console.error('Session error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
