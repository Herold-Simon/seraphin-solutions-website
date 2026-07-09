// api/contact/update.js - Kontaktanfrage aktualisieren/loeschen (nur Master)
// Aktionen: { action: 'mark_read', id, is_read } oder { action: 'delete', id }
const { supabase, setCors, send, readBody, resolveSession } = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });

  try {
    const ctx = await resolveSession(req);
    if (!ctx) {
      return send(res, 401, { success: false, error: 'Nicht authentifiziert' });
    }
    if (!ctx.isMaster) {
      return send(res, 403, { success: false, error: 'Nur für Master-Konten verfügbar' });
    }

    const { action, id, is_read } = readBody(req);
    if (!id) {
      return send(res, 400, { success: false, error: 'ID fehlt' });
    }

    if (action === 'delete') {
      const { error } = await supabase
        .from('contact_submissions')
        .delete()
        .eq('id', id);
      if (error) {
        console.error('Contact delete error:', error.message);
        return send(res, 500, { success: false, error: 'Fehler beim Löschen' });
      }
      return send(res, 200, { success: true });
    }

    if (action === 'mark_read') {
      const { error } = await supabase
        .from('contact_submissions')
        .update({ is_read: Boolean(is_read) })
        .eq('id', id);
      if (error) {
        console.error('Contact update error:', error.message);
        return send(res, 500, { success: false, error: 'Fehler beim Aktualisieren' });
      }
      return send(res, 200, { success: true });
    }

    return send(res, 400, { success: false, error: 'Unbekannte Aktion' });
  } catch (error) {
    console.error('Contact update error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
