// api/contact/submit.js - Kontaktformular speichern (oeffentlich, kein Login)
const { supabase, hasSupabaseConfig, setCors, send, readBody } = require('../_lib/db');

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function clean(value, maxLength) {
  const str = String(value == null ? '' : value).trim();
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });

  if (!hasSupabaseConfig()) {
    return send(res, 500, { success: false, error: 'Server-Konfiguration fehlt' });
  }

  try {
    const body = readBody(req);

    const name = clean(body.name, 200);
    const email = clean(body.email, 200);
    const institution = clean(body.institution, 200);
    const message = clean(body.message, 5000);
    const wantsDemo = Boolean(body.wants_demo);

    if (!name || !email || !institution || !message) {
      return send(res, 400, { success: false, error: 'Bitte füllen Sie alle Pflichtfelder aus.' });
    }

    if (!isValidEmail(email)) {
      return send(res, 400, { success: false, error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' });
    }

    const { error } = await supabase
      .from('contact_submissions')
      .insert({
        name,
        email,
        institution: institution || null,
        message,
        wants_demo: wantsDemo
      });

    if (error) {
      console.error('Contact insert error:', error.message);
      return send(res, 500, { success: false, error: 'Fehler beim Speichern der Nachricht' });
    }

    return send(res, 200, { success: true, message: 'Nachricht gespeichert' });
  } catch (error) {
    console.error('Contact submit error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
