// api/accounts/update.js - Benutzername/Passwort des (verkoerperten) Kontos aendern
const {
  supabase, setCors, send, readBody, resolveSession, hashPassword, verifyPassword
} = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PUT') return send(res, 405, { success: false, error: 'Method not allowed' });

  try {
    const ctx = await resolveSession(req);
    if (!ctx) {
      return send(res, 401, { success: false, error: 'Nicht authentifiziert' });
    }

    const accountId = ctx.effectiveAccountId;
    const body = readBody(req);

    // Benutzername aendern
    if (body.username !== undefined) {
      const newUsername = String(body.username).trim();
      if (!newUsername) {
        return send(res, 400, { success: false, error: 'Benutzername darf nicht leer sein' });
      }

      const { data: clash } = await supabase
        .from('accounts')
        .select('id')
        .eq('username', newUsername)
        .neq('id', accountId)
        .maybeSingle();

      if (clash) {
        return send(res, 409, { success: false, error: 'Benutzername bereits vergeben' });
      }

      const { error } = await supabase
        .from('accounts')
        .update({ username: newUsername, updated_at: new Date().toISOString() })
        .eq('id', accountId);

      if (error) {
        return send(res, 500, { success: false, error: 'Fehler beim Aktualisieren des Benutzernamens' });
      }

      return send(res, 200, { success: true, message: 'Benutzername erfolgreich geändert', username: newUsername });
    }

    // Passwort aendern
    if (body.newPassword !== undefined) {
      const { currentPassword, newPassword } = body;
      if (!newPassword) {
        return send(res, 400, { success: false, error: 'Neues Passwort darf nicht leer sein' });
      }

      const { data: account } = await supabase
        .from('accounts')
        .select('id, password_hash')
        .eq('id', accountId)
        .maybeSingle();

      if (!account) {
        return send(res, 404, { success: false, error: 'Konto nicht gefunden' });
      }

      // Master darf ohne aktuelles Passwort des verkoerperten Kontos aendern
      if (!ctx.isMaster) {
        const valid = await verifyPassword(currentPassword, account.password_hash);
        if (!valid) {
          return send(res, 401, { success: false, error: 'Das aktuelle Passwort ist falsch' });
        }
      }

      const passwordHash = await hashPassword(newPassword);
      const { error } = await supabase
        .from('accounts')
        .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
        .eq('id', accountId);

      if (error) {
        return send(res, 500, { success: false, error: 'Fehler beim Aktualisieren des Passworts' });
      }

      return send(res, 200, { success: true, message: 'Passwort erfolgreich geändert' });
    }

    return send(res, 400, { success: false, error: 'Keine gültigen Felder zum Aktualisieren' });
  } catch (error) {
    console.error('Account update error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
