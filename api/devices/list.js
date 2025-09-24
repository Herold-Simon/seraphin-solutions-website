const { createClient } = require('@supabase/supabase-js');
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

  // Nur GET-Requests erlauben
  if (req.method !== 'GET') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET.'
    });
    return;
  }

  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const sessionToken = cookies.session_token;

    if (!sessionToken) {
      return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
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

    // Validiere Session
    const { data: session, error: sessionError } = await supabase
      .from('website_sessions')
      .select(`
        user_id,
        expires_at,
        website_users!inner(
          id,
          username,
          admin_user_id
        )
      `)
      .eq('session_token', sessionToken)
      .single();

    if (sessionError || !session) {
      console.log('Devices API - Session validation failed:', sessionError?.message || 'Session not found');
      return res.status(401).json({ success: false, error: 'Ungültige Session' });
    }

    // Überprüfe Ablaufzeit
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    
    if (now > expiresAt) {
      console.log('Devices API - Session expired');
      return res.status(401).json({ success: false, error: 'Session abgelaufen' });
    }

    const adminUserId = session.website_users.admin_user_id;
    console.log('Devices API - Loading devices for admin_user_id:', adminUserId);

    // Hole alle aktiven Geräte für diesen Admin-User
    const { data: devices, error: devicesError } = await supabase
      .from('device_sessions')
      .select('device_id, device_name, last_active, created_at')
      .eq('admin_user_id', adminUserId)
      .eq('is_active', true)
      .order('last_active', { ascending: false });

    if (devicesError) {
      console.error('❌ Error loading devices:', devicesError);
      return res.status(500).json({
        success: false,
        error: 'Fehler beim Laden der Geräte'
      });
    }

    console.log('✅ Devices loaded successfully:', devices?.length || 0);

    res.status(200).json({
      success: true,
      devices: devices || [],
      total_devices: devices?.length || 0
    });

  } catch (error) {
    console.error('❌ Unerwarteter Fehler beim Laden der Geräte:', error);
    res.status(500).json({
      success: false,
      error: 'Interner Serverfehler'
    });
  }
};
