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
    let adminUserId = null;
    let isFallbackMode = false;

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

    // Versuche zuerst normale Session-Verifikation
    if (sessionToken) {
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

      if (session && !sessionError) {
        // Überprüfe Ablaufzeit
        const now = new Date();
        const expiresAt = new Date(session.expires_at);
        
        if (now <= expiresAt) {
          adminUserId = session.website_users.admin_user_id;
          console.log('Devices API - Session valid, admin_user_id:', adminUserId);
        } else {
          console.log('Devices API - Session expired, trying fallback mode');
          isFallbackMode = true;
        }
      } else {
        console.log('Devices API - Session validation failed, trying fallback mode');
        isFallbackMode = true;
      }
    } else {
      console.log('Devices API - No session token, trying fallback mode');
      isFallbackMode = true;
    }

    // Fallback-Modus: Versuche Admin-User über aktuelle Statistiken zu finden
    if (isFallbackMode) {
      console.log('Devices API - Entering fallback mode to find admin user by recent statistics');
      
      // Hole die neuesten Statistiken um den Admin-User zu identifizieren
      const { data: recentStats, error: statsError } = await supabase
        .from('app_statistics')
        .select('admin_user_id, device_id, date')
        .order('date', { ascending: false })
        .limit(1)
        .single();
      
      if (statsError || !recentStats) {
        console.log('Devices API - No recent statistics found in fallback mode:', statsError?.message);
        return res.status(401).json({ success: false, error: 'Keine Statistiken verfügbar' });
      }
      
      adminUserId = recentStats.admin_user_id;
      console.log('Devices API - Found admin user from recent statistics:', adminUserId, 'device:', recentStats.device_id);
    }

    if (!adminUserId) {
      return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
    }
    console.log('Devices API - Loading devices for admin_user_id:', adminUserId);

    // NEUE LOGIK: Sammle alle Geräte aus verschiedenen Quellen
    
    // 1. Hole alle aktiven Geräte aus device_sessions (eingeloggte Geräte)
    const { data: sessionDevices, error: sessionError } = await supabase
      .from('device_sessions')
      .select('device_id, device_name, last_active, created_at')
      .eq('admin_user_id', adminUserId)
      .eq('is_active', true)
      .order('last_active', { ascending: false });

    console.log('📱 Session devices:', sessionDevices?.map(d => d.device_id) || []);

    // 2. Hole das ursprüngliche Gerät aus admin_users
    const { data: adminUser, error: adminUserError } = await supabase
      .from('admin_users')
      .select('device_id')
      .eq('id', adminUserId)
      .single();

    console.log('📱 Original device from admin_users:', adminUser?.device_id);

    // 3. Erstelle eine einheitliche Geräte-Liste
    let allDevices = [];
    
    // Füge eingeloggte Geräte hinzu
    if (sessionDevices && sessionDevices.length > 0) {
      sessionDevices.forEach(device => {
        allDevices.push({
          device_id: device.device_id,
          device_name: device.device_name || device.device_id,
          last_active: device.last_active,
          created_at: device.created_at,
          source: 'session' // Markierung für Debugging
        });
      });
    }
    
    // Füge das ursprüngliche Gerät hinzu (falls nicht bereits vorhanden)
    if (adminUser?.device_id) {
      const originalExists = allDevices.some(device => device.device_id === adminUser.device_id);
      if (!originalExists) {
        allDevices.push({
          device_id: adminUser.device_id,
          device_name: adminUser.device_id,
          last_active: null,
          created_at: null,
          source: 'original' // Markierung für Debugging
        });
        console.log('📱 Added original device:', adminUser.device_id);
      } else {
        console.log('📱 Original device already in list:', adminUser.device_id);
      }
    }
    
    console.log('📱 Final device list:', allDevices.map(d => ({ id: d.device_id, source: d.source })));
    console.log('📱 Session devices count:', sessionDevices?.length || 0);
    console.log('📱 Original device found:', !!adminUser?.device_id);
    console.log('📱 Original device ID:', adminUser?.device_id);
    
    console.log('✅ Devices loaded successfully:', allDevices.length);
    console.log('📱 ===== API RESPONSE SENDING =====');

    res.status(200).json({
      success: true,
      devices: allDevices,
      total_devices: allDevices.length
    });

  } catch (error) {
    console.error('❌ Unerwarteter Fehler beim Laden der Geräte:', error);
    res.status(500).json({
      success: false,
      error: 'Interner Serverfehler'
    });
  }
};
