// api/auth/login.js - Website-Login (Account + Master) per Session-Cookie
const {
  supabase, hasSupabaseConfig, setCors, send, readBody,
  verifyPassword, createSession, buildSessionCookie
} = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });

  if (!hasSupabaseConfig()) {
    return send(res, 500, { success: false, error: 'Server-Konfiguration fehlt' });
  }

  try {
    const { username, password, rememberMe } = readBody(req);

    if (!username || !password) {
      return send(res, 400, { success: false, error: 'Benutzername und Passwort sind erforderlich' });
    }

    const { data: account } = await supabase
      .from('accounts')
      .select('id, username, password_hash, is_master')
      .eq('username', String(username).trim())
      .maybeSingle();

    if (!account) {
      return send(res, 401, { success: false, error: 'Dieses Konto existiert nicht. Der Anmeldename oder das Passwort ist falsch.' });
    }

    const valid = await verifyPassword(password, account.password_hash);
    if (!valid) {
      return send(res, 401, { success: false, error: 'Das Passwort ist falsch. Bitte überprüfen Sie Ihre Eingaben.' });
    }

    const token = await createSession(account.id);
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
    res.setHeader('Set-Cookie', buildSessionCookie(token, maxAge));

    return send(res, 200, {
      success: true,
      message: 'Login erfolgreich',
      user: {
        id: account.id,
        username: account.username,
        is_master: Boolean(account.is_master)
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
