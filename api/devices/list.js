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

    // VERBESSERTE LOGIK: Hole direkt alle aktiven Geräte aus der Datenbank
    
    // 1. Hole alle aktiven Geräte-Sessions (eingeloggte Geräte)
    const { data: activeDevices, error: sessionError } = await supabase
      .from('device_sessions')
      .select('device_id, device_name, last_active, created_at, is_active')
      .eq('admin_user_id', adminUserId)
      .eq('is_active', true)
      .order('last_active', { ascending: false });

    console.log('📱 Active session devices:', activeDevices?.map(d => d.device_id) || []);

    // 2. Hole zusätzlich alle Geräte aus Statistiken (falls Sessions nicht vollständig sind)
    const { data: statsDevices, error: statsError } = await supabase
      .from('app_statistics')
      .select('device_id, date')
      .eq('admin_user_id', adminUserId)
      .not('device_id', 'is', null)
      .order('date', { ascending: false })
      .limit(50); // Begrenze auf die neuesten 50 Einträge

    console.log('📱 Statistics devices:', statsDevices?.map(s => s.device_id) || []);

    // 3. Hole das ursprüngliche Gerät aus admin_users
    const { data: adminUser, error: adminUserError } = await supabase
      .from('admin_users')
      .select('device_id')
      .eq('id', adminUserId)
      .single();

    console.log('📱 Original device from admin_users:', adminUser?.device_id);

    // 4. Erstelle eine einheitliche Geräte-Liste - PRIORISIERE AKTIVE SESSIONS
    let allDevices = [];
    let deviceIds = new Set(); // Verhindere Duplikate
    
    // ZUERST: Füge alle aktiven Geräte-Sessions hinzu (höchste Priorität)
    if (activeDevices && activeDevices.length > 0) {
      activeDevices.forEach(device => {
        if (!deviceIds.has(device.device_id)) {
          allDevices.push({
            device_id: device.device_id,
            device_name: device.device_name || device.device_id,
            last_active: device.last_active,
            created_at: device.created_at,
            source: 'active_session',
            is_active: true
          });
          deviceIds.add(device.device_id);
        }
      });
      console.log('📱 Added active session devices:', activeDevices.length);
    }
    
    // ZWEITENS: Füge Geräte aus Statistiken hinzu (falls noch nicht vorhanden)
    if (statsDevices && statsDevices.length > 0) {
      const uniqueStatsDevices = [...new Set(statsDevices.map(s => s.device_id))];
      uniqueStatsDevices.forEach(deviceId => {
        if (!deviceIds.has(deviceId)) {
          allDevices.push({
            device_id: deviceId,
            device_name: deviceId,
            last_active: null,
            created_at: null,
            source: 'statistics',
            is_active: false
          });
          deviceIds.add(deviceId);
        }
      });
      console.log('📱 Added statistics devices:', uniqueStatsDevices.length);
    }
    
    // DRITTENS: Füge das ursprüngliche Gerät hinzu (falls noch nicht vorhanden)
    if (adminUser?.device_id && !deviceIds.has(adminUser.device_id)) {
      allDevices.push({
        device_id: adminUser.device_id,
        device_name: adminUser.device_id,
        last_active: null,
        created_at: null,
        source: 'original',
        is_active: false
      });
      deviceIds.add(adminUser.device_id);
      console.log('📱 Added original device:', adminUser.device_id);
    }
    
    // Sortiere Geräte: Aktive Sessions zuerst, dann nach letzter Aktivität
    allDevices.sort((a, b) => {
      // Aktive Sessions haben höchste Priorität
      if (a.is_active && !b.is_active) return -1;
      if (!a.is_active && b.is_active) return 1;
      
      // Dann nach letzter Aktivität
      if (a.last_active && b.last_active) {
        return new Date(b.last_active) - new Date(a.last_active);
      }
      if (a.last_active && !b.last_active) return -1;
      if (!a.last_active && b.last_active) return 1;
      
      return 0;
    });
    
    console.log('📱 Final device list:', allDevices.map(d => ({ 
      id: d.device_id, 
      source: d.source, 
      is_active: d.is_active,
      last_active: d.last_active 
    })));
    console.log('📱 Total devices found:', allDevices.length);
    console.log('📱 Active devices:', allDevices.filter(d => d.is_active).length);
    
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
