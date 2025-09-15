// api/auth/test-login.js - Test Login API mit detaillierten Fehlermeldungen
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

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
    const { username, password } = req.body;

    console.log('🔍 Test-Login gestartet für:', username);

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: 'Benutzername und Passwort sind erforderlich'
      });
      return;
    }

    // Supabase-Umgebungsvariablen prüfen
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Supabase-Umgebungsvariablen fehlen');
      res.status(500).json({
        success: false,
        error: 'Server-Konfiguration fehlt - Supabase-Variablen nicht gesetzt'
      });
      return;
    }

    console.log('✅ Supabase-Variablen vorhanden');

    // Supabase-Client erstellen
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Supabase-Client erstellt');

    // Website-User aus der Datenbank abrufen
    console.log('🔍 Suche User in Datenbank:', username);
    const { data: websiteUser, error: userError } = await supabase
      .from('website_users')
      .select('*')
      .eq('username', username)
      .single();

    if (userError) {
      console.error('❌ Fehler beim Abrufen des Users:', userError);
      res.status(500).json({
        success: false,
        error: `Datenbankfehler: ${userError.message}`
      });
      return;
    }

    if (!websiteUser) {
      console.log('❌ User nicht gefunden:', username);
      res.status(401).json({
        success: false,
        error: 'Benutzername nicht gefunden'
      });
      return;
    }

    console.log('✅ User gefunden:', websiteUser.username);

    // Passwort überprüfen
    console.log('🔍 Überprüfe Passwort...');
    const passwordMatch = await bcrypt.compare(password, websiteUser.password_hash);
    
    if (!passwordMatch) {
      console.log('❌ Passwort falsch für User:', username);
      res.status(401).json({
        success: false,
        error: 'Passwort ist falsch'
      });
      return;
    }

    console.log('✅ Passwort korrekt für User:', username);

    // Erfolgreicher Login
    res.status(200).json({
      success: true,
      message: 'Test-Login erfolgreich!',
      user: {
        username: websiteUser.username,
        admin_user_id: websiteUser.admin_user_id
      }
    });

  } catch (error) {
    console.error('❌ Unerwarteter Fehler im Test-Login:', error);
    res.status(500).json({
      success: false,
      error: `Interner Serverfehler: ${error.message}`
    });
  }
};
