// api/auth/logout.js - Session beenden und Cookie loeschen
const { supabase, setCors, send, getCookies, clearSessionCookie, SESSION_COOKIE } = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });

  try {
    const cookies = getCookies(req);
    const token = cookies[SESSION_COOKIE];
    if (token) {
      await supabase.from('sessions').delete().eq('session_token', token);
    }
    res.setHeader('Set-Cookie', clearSessionCookie());
    return send(res, 200, { success: true, message: 'Erfolgreich abgemeldet' });
  } catch (error) {
    console.error('Logout error:', error.message);
    res.setHeader('Set-Cookie', clearSessionCookie());
    return send(res, 200, { success: true, message: 'Abgemeldet' });
  }
};
