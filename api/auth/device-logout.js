const { createClient } = require('@supabase/supabase-js');

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
    const { admin_user_id, device_id } = req.body;

    if (!admin_user_id) {
      res.status(400).json({
        success: false,
        error: 'Admin-Benutzer-ID ist erforderlich'
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

    // Prüfe ob Admin-User existiert
    const { data: adminUser, error: userError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', admin_user_id)
      .single();

    if (userError || !adminUser) {
      console.error('❌ Admin-User nicht gefunden:', userError);
      res.status(404).json({
        success: false,
        error: 'Admin-User nicht gefunden'
      });
      return;
    }

    // Geräte-Session deaktivieren falls device_id vorhanden
    if (device_id) {
      console.log('📱 Deactivating device session for admin user:', admin_user_id, 'device:', device_id);
      
      const { error: sessionError } = await supabase
        .from('device_sessions')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('admin_user_id', admin_user_id)
        .eq('device_id', device_id);

      if (sessionError) {
        console.error('❌ Error deactivating device session:', sessionError);
        // Nicht kritisch, Logout kann trotzdem erfolgreich sein
      } else {
        console.log('✅ Device session deactivated successfully');
      }
    }

    console.log('✅ Device logout successful for admin user:', admin_user_id);

    res.status(200).json({
      success: true,
      message: 'Logout erfolgreich'
    });

  } catch (error) {
    console.error('❌ Unerwarteter Fehler im Device-Logout:', error);
    res.status(500).json({
      success: false,
      error: 'Interner Serverfehler'
    });
  }
};
