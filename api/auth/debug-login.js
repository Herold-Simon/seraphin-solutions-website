// api/auth/debug-login.js - Debug Login API
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const cookie = require('cookie');

// CORS-Header setzen
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

module.exports = async (req, res) => {
  // CORS-Header setzen
  setCorsHeaders(res);

  // OPTIONS-Request für CORS-Preflight behandeln
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Nur POST-Requests erlauben
  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.'
    });
    return;
  }

  try {
    // Debug: Umgebungsvariablen prüfen
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('🔍 Debug-Login gestartet');
    console.log('Supabase URL vorhanden:', !!supabaseUrl);
    console.log('Supabase Service Key vorhanden:', !!supabaseServiceKey);
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Supabase-Umgebungsvariablen fehlen');
      res.status(500).json({
        success: false,
        error: 'Supabase-Konfiguration fehlt',
        debug: {
          supabaseUrl: !!supabaseUrl,
          supabaseServiceKey: !!supabaseServiceKey,
          allEnvVars: Object.keys(process.env).filter(key => key.includes('SUPABASE'))
        }
      });
      return;
    }

    const { username, password } = req.body;

    console.log('🔍 Login-Versuch:', { username, password: password ? '***' : 'undefined' });

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: 'Benutzername und Passwort sind erforderlich'
      });
      return;
    }

    // Supabase-Client erstellen
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Supabase-Client erstellt');

    // Website-User aus der Datenbank abrufen
    const { data: websiteUser, error: userError } = await supabase
      .from('website_users')
      .select('*')
      .eq('username', username)
      .single();

    if (userError) {
      console.error('❌ Fehler beim Abrufen des Users:', userError);
      res.status(500).json({
        success: false,
        error: 'Datenbankfehler beim Abrufen des Users: ' + userError.message,
        debug: {
          userError: userError.message,
          code: userError.code,
          hint: userError.hint
        }
      });
      return;
    }

    if (!websiteUser) {
      console.log('❌ User nicht gefunden:', username);
      res.status(401).json({
        success: false,
        error: 'Ungültige Anmeldedaten'
      });
      return;
    }

    console.log('✅ User gefunden:', websiteUser.username);

    // Passwort überprüfen
    const passwordMatch = await bcrypt.compare(password, websiteUser.password_hash);
    
    if (!passwordMatch) {
      console.log('❌ Passwort falsch für User:', username);
      res.status(401).json({
        success: false,
        error: 'Ungültige Anmeldedaten'
      });
      return;
    }

    console.log('✅ Passwort korrekt für User:', username);

    // Session-Token generieren
    const sessionToken = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Stunden

    // Session in der Datenbank speichern
    const { error: sessionError } = await supabase
      .from('website_sessions')
      .insert({
        session_token: sessionToken,
        admin_user_id: websiteUser.admin_user_id,
        expires_at: expiresAt.toISOString()
      });

    if (sessionError) {
      console.error('❌ Fehler beim Speichern der Session:', sessionError);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Erstellen der Session: ' + sessionError.message,
        debug: {
          sessionError: sessionError.message,
          code: sessionError.code,
          hint: sessionError.hint
        }
      });
      return;
    }

    console.log('✅ Session erstellt für User:', username);

    // Session-Cookie setzen
    const sessionCookie = cookie.serialize('session_token', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 Stunden
      path: '/'
    });

    res.setHeader('Set-Cookie', sessionCookie);

    res.status(200).json({
      success: true,
      message: 'Login erfolgreich',
      user: {
        username: websiteUser.username,
        admin_user_id: websiteUser.admin_user_id
      }
    });

  } catch (error) {
    console.error('❌ Unerwarteter Fehler im Debug-Login:', error);
    res.status(500).json({
      success: false,
      error: 'Interner Serverfehler: ' + error.message,
      debug: {
        error: error.message,
        stack: error.stack
      }
    });
  }
};
