// api/contact/list.js - Kontaktanfragen auflisten (nur Master)
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
    if (!ctx.isMaster) {
      return send(res, 403, { success: false, error: 'Nur für Master-Konten verfügbar' });
    }

    const { data, error } = await supabase
      .from('contact_submissions')
      .select('id, name, email, institution, message, wants_demo, is_read, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Contact list error:', error.message);
      return send(res, 500, { success: false, error: 'Fehler beim Laden der Kontaktanfragen' });
    }

    const submissions = data || [];
    const unread = submissions.filter(s => !s.is_read).length;

    return send(res, 200, { success: true, submissions, unread });
  } catch (error) {
    console.error('Contact list error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
