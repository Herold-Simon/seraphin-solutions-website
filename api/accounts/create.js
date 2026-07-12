// api/accounts/create.js - Neuen Account aus der Desktop-App anlegen
const {
  supabase, hasSupabaseConfig, setCors, send, readBody, hashPassword
} = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });

  if (!hasSupabaseConfig()) {
    return send(res, 500, { success: false, error: 'Server-Konfiguration fehlt' });
  }

  try {
    const { username, password, device_id, device_name, product_mode } = readBody(req);

    if (!username || !password) {
      return send(res, 400, { success: false, error: 'Benutzername und Passwort sind erforderlich' });
    }

    const cleanUsername = String(username).trim();

    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existing) {
      return send(res, 409, { success: false, error: 'Benutzername bereits vergeben' });
    }

    const passwordHash = await hashPassword(password);

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .insert({ username: cleanUsername, password_hash: passwordHash, is_master: false, product_mode: Boolean(product_mode) })
      .select('id, username')
      .single();

    if (accountError) {
      console.error('Account creation error:', accountError.message);
      return send(res, 500, { success: false, error: 'Fehler beim Erstellen des Accounts' });
    }

    if (device_id) {
      await supabase
        .from('devices')
        .upsert({
          account_id: account.id,
          device_id: String(device_id),
          device_name: device_name || `Gerät ${String(device_id).substring(0, 8)}`,
          last_active: new Date().toISOString()
        }, { onConflict: 'account_id,device_id' });
    }

    return send(res, 201, {
      success: true,
      message: 'Account erfolgreich erstellt',
      account_id: account.id,
      username: account.username
    });
  } catch (error) {
    console.error('Account creation error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
