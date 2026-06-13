// api/accounts/login-device.js - Aktuelles Geraet in ein bestehendes Konto einloggen (Multi-Geraet)
const {
  supabase, hasSupabaseConfig, setCors, send, readBody, verifyPassword
} = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });

  if (!hasSupabaseConfig()) {
    return send(res, 500, { success: false, error: 'Server-Konfiguration fehlt' });
  }

  try {
    const { username, password, device_id, device_name } = readBody(req);

    if (!username || !password) {
      return send(res, 400, { success: false, error: 'Benutzername und Passwort sind erforderlich' });
    }

    const { data: account } = await supabase
      .from('accounts')
      .select('id, username, password_hash, is_master')
      .eq('username', String(username).trim())
      .maybeSingle();

    if (!account || account.is_master) {
      return send(res, 401, { success: false, error: 'Dieses Konto existiert nicht. Der Anmeldename oder das Passwort ist falsch.' });
    }

    const valid = await verifyPassword(password, account.password_hash);
    if (!valid) {
      return send(res, 401, { success: false, error: 'Das Passwort ist falsch. Bitte überprüfen Sie Ihre Eingaben.' });
    }

    if (device_id) {
      const { error: deviceError } = await supabase
        .from('devices')
        .upsert({
          account_id: account.id,
          device_id: String(device_id),
          device_name: device_name || `Gerät ${String(device_id).substring(0, 8)}`,
          last_active: new Date().toISOString()
        }, { onConflict: 'account_id,device_id' });
      if (deviceError) {
        console.error('Device registration error:', deviceError.message);
        return send(res, 500, { success: false, error: 'Fehler beim Registrieren des Geräts' });
      }
    }

    return send(res, 200, {
      success: true,
      message: 'Gerät erfolgreich mit dem Konto verbunden',
      account_id: account.id,
      username: account.username
    });
  } catch (error) {
    console.error('Device login error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
