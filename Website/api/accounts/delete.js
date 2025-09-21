const { createClient } = require('@supabase/supabase-js');

// CORS-Header setzen
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// Supabase-Client initialisieren
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase-Umgebungsvariablen fehlen');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  // CORS-Header setzen
  setCorsHeaders(res);

  // OPTIONS-Request für CORS-Preflight behandeln
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Nur DELETE-Requests erlauben
  if (req.method !== 'DELETE') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed. Use DELETE.'
    });
    return;
  }

  try {
    const { admin_user_id } = req.body;

    if (!admin_user_id) {
      res.status(400).json({
        success: false,
        error: 'Admin-User-ID ist erforderlich'
      });
      return;
    }

    console.log('🗑️ Account-Löschung gestartet für Admin-User-ID:', admin_user_id);

    // 1. Admin-User aus admin_users Tabelle löschen
    const { error: adminUserError } = await supabase
      .from('admin_users')
      .delete()
      .eq('id', admin_user_id);

    if (adminUserError) {
      console.error('❌ Fehler beim Löschen des Admin-Users:', adminUserError);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Löschen des Admin-Users: ' + adminUserError.message
      });
      return;
    }

    // 2. Website-User aus website_users Tabelle löschen (falls vorhanden)
    const { error: websiteUserError } = await supabase
      .from('website_users')
      .delete()
      .eq('admin_user_id', admin_user_id);

    if (websiteUserError) {
      console.error('❌ Fehler beim Löschen des Website-Users:', websiteUserError);
      // Nicht kritisch, da der Admin-User bereits gelöscht wurde
    }

    // 3. Alle Statistiken für diesen Admin-User löschen
    const { error: appStatsError } = await supabase
      .from('app_statistics')
      .delete()
      .eq('admin_user_id', admin_user_id);

    if (appStatsError) {
      console.error('❌ Fehler beim Löschen der App-Statistiken:', appStatsError);
      // Nicht kritisch, da der Admin-User bereits gelöscht wurde
    }

    const { error: videoStatsError } = await supabase
      .from('video_statistics')
      .delete()
      .eq('admin_user_id', admin_user_id);

    if (videoStatsError) {
      console.error('❌ Fehler beim Löschen der Video-Statistiken:', videoStatsError);
      // Nicht kritisch, da der Admin-User bereits gelöscht wurde
    }

    const { error: floorStatsError } = await supabase
      .from('floor_statistics')
      .delete()
      .eq('admin_user_id', admin_user_id);

    if (floorStatsError) {
      console.error('❌ Fehler beim Löschen der Floor-Statistiken:', floorStatsError);
      // Nicht kritisch, da der Admin-User bereits gelöscht wurde
    }

    // 4. Alle Sessions für diesen Admin-User löschen
    const { error: sessionsError } = await supabase
      .from('website_sessions')
      .delete()
      .eq('admin_user_id', admin_user_id);

    if (sessionsError) {
      console.error('❌ Fehler beim Löschen der Sessions:', sessionsError);
      // Nicht kritisch, da der Admin-User bereits gelöscht wurde
    }

    console.log('✅ Account erfolgreich gelöscht für Admin-User-ID:', admin_user_id);

    res.status(200).json({
      success: true,
      message: 'Account und alle zugehörigen Daten wurden erfolgreich gelöscht'
    });

  } catch (error) {
    console.error('❌ Unerwarteter Fehler beim Löschen des Accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Interner Serverfehler beim Löschen des Accounts: ' + error.message
    });
  }
};
