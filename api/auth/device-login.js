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
    const { username, password, device_id } = req.body;

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
        error: 'Server-Konfiguration fehlt'
      });
      return;
    }

    // Supabase-Client erstellen
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Admin-User aus der Datenbank abrufen
    const { data: adminUser, error: userError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .single();

    if (userError) {
      console.error('❌ Fehler beim Abrufen des Admin-Users:', userError);
      res.status(500).json({
        success: false,
        error: 'Datenbankfehler'
      });
      return;
    }

    if (!adminUser) {
      res.status(401).json({
        success: false,
        error: 'Ungültige Anmeldedaten'
      });
      return;
    }

    // Passwort überprüfen
    const passwordMatch = await bcrypt.compare(password, adminUser.password_hash);
    
    if (!passwordMatch) {
      res.status(401).json({
        success: false,
        error: 'Ungültige Anmeldedaten'
      });
      return;
    }

    // Geräte-Session aktualisieren oder erstellen
    let deviceSessionId = null;
    if (device_id) {
      console.log('📱 Updating device session for admin user:', adminUser.id, 'device:', device_id);
      
      const { data: sessionData, error: sessionError } = await supabase
        .rpc('update_device_activity', {
          p_admin_user_id: adminUser.id,
          p_device_id: device_id,
          p_device_name: `Device ${device_id.substring(0, 8)}`
        });

      if (sessionError) {
        console.error('❌ Error updating device session:', sessionError);
        // Nicht kritisch, weiter mit Login
      } else {
        deviceSessionId = sessionData;
        console.log('✅ Device session updated successfully:', deviceSessionId);
      }
    }

    // Aktualisiere last_login für Admin-User
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({ 
        last_login: new Date().toISOString(),
        device_id: device_id || adminUser.device_id
      })
      .eq('id', adminUser.id);

    if (updateError) {
      console.error('❌ Error updating admin user last_login:', updateError);
      // Nicht kritisch, Login kann trotzdem erfolgreich sein
    }

    console.log('✅ Device login successful for admin user:', adminUser.id);

    res.status(200).json({
      success: true,
      message: 'Login erfolgreich',
      admin_user_id: adminUser.id,
      username: adminUser.username,
      device_session_id: deviceSessionId
    });

  } catch (error) {
    console.error('❌ Unerwarteter Fehler im Device-Login:', error);
    res.status(500).json({
      success: false,
      error: 'Interner Serverfehler'
    });
  }
};
