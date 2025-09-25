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

    // Hole alle aktiven Geräte für diesen Admin-User
    const { data: devices, error: devicesError } = await supabase
      .from('device_sessions')
      .select('device_id, device_name, last_active, created_at')
      .eq('admin_user_id', adminUserId)
      .eq('is_active', true)
      .order('last_active', { ascending: false });

    console.log('📱 Device sessions query result:', { devices, devicesError, adminUserId });
    console.log('📱 Number of devices from device_sessions:', devices?.length || 0);

    if (devicesError) {
      console.error('❌ Error loading devices:', devicesError);
      return res.status(500).json({
        success: false,
        error: 'Fehler beim Laden der Geräte'
      });
    }

    // Hole das ursprüngliche Gerät aus admin_users
    const { data: adminUser, error: adminUserError } = await supabase
      .from('admin_users')
      .select('device_id')
      .eq('id', adminUserId)
      .single();

    console.log('📱 Admin user query result:', { adminUser, adminUserError, adminUserId });

    let allDevices = devices || [];
    
    // Zusätzlich: Hole alle Geräte aus den Statistiken, die möglicherweise nicht in device_sessions sind
    console.log('📱 Loading devices from statistics as fallback...');
    const { data: statsDevices, error: statsDevicesError } = await supabase
      .from('app_statistics')
      .select('device_id')
      .eq('admin_user_id', adminUserId)
      .not('device_id', 'is', null);
    
    console.log('📱 Statistics devices query result:', { statsDevices, statsDevicesError });
    
    if (statsDevices && statsDevices.length > 0) {
      // Erstelle eine Liste aller eindeutigen Geräte-IDs aus den Statistiken
      const uniqueStatsDevices = [...new Set(statsDevices.map(s => s.device_id))];
      console.log('📱 Unique devices from statistics:', uniqueStatsDevices);
      
      // Füge Geräte aus Statistiken hinzu, die nicht in device_sessions sind
      uniqueStatsDevices.forEach(deviceId => {
        if (!allDevices.some(device => device.device_id === deviceId)) {
          console.log('📱 Adding device from statistics:', deviceId);
          allDevices.push({
            device_id: deviceId,
            device_name: deviceId,
            last_active: null,
            created_at: null,
            is_original: false
          });
        }
      });
    }
    
    // Füge das ursprüngliche Gerät hinzu, falls es nicht bereits in der Liste ist
    console.log('📱 Processing original device logic...');
    console.log('📱 Admin user device_id:', adminUser?.device_id);
    console.log('📱 Current allDevices before original device processing:', allDevices.map(d => d.device_id));
    
    if (adminUser?.device_id) {
      const originalDeviceExists = allDevices.some(device => device.device_id === adminUser.device_id);
      console.log('📱 Original device exists in list:', originalDeviceExists);
      
      if (!originalDeviceExists) {
        console.log('📱 Adding original device to list:', adminUser.device_id);
        allDevices.unshift({
          device_id: adminUser.device_id,
          device_name: adminUser.device_id,
          last_active: null,
          created_at: null,
          is_original: true
        });
      } else {
        console.log('📱 Original device already in list, marking as original:', adminUser.device_id);
        // Markiere das ursprüngliche Gerät in der Liste
        const originalDeviceIndex = allDevices.findIndex(device => device.device_id === adminUser.device_id);
        if (originalDeviceIndex !== -1) {
          allDevices[originalDeviceIndex].is_original = true;
          console.log('📱 Marked device at index', originalDeviceIndex, 'as original');
        }
      }
    } else {
      console.log('⚠️ No original device found for admin user:', adminUserId);
      console.log('⚠️ Admin user data:', adminUser);
      console.log('⚠️ Admin user error:', adminUserError);
      
      // Fallback: Versuche das ursprüngliche Gerät aus den Statistiken zu bekommen
      console.log('📱 Trying to get original device from statistics as fallback...');
      
      // Hole die ältesten Statistiken um die ursprüngliche device_id zu bekommen
      const { data: oldestStats, error: oldestStatsError } = await supabase
        .from('app_statistics')
        .select('device_id, date')
        .eq('admin_user_id', adminUserId)
        .not('device_id', 'is', null)
        .order('date', { ascending: true })
        .limit(1)
        .single();
      
      console.log('📱 Oldest statistics result:', { oldestStats, oldestStatsError });
      
      if (oldestStats?.device_id && !allDevices.some(device => device.device_id === oldestStats.device_id)) {
        console.log('📱 Adding original device from oldest statistics:', oldestStats.device_id);
        allDevices.unshift({
          device_id: oldestStats.device_id,
          device_name: oldestStats.device_id,
          last_active: null,
          created_at: null,
          is_original: true
        });
      } else if (oldestStats?.device_id) {
        console.log('📱 Original device from statistics already in list, marking as original:', oldestStats.device_id);
        const originalDeviceIndex = allDevices.findIndex(device => device.device_id === oldestStats.device_id);
        if (originalDeviceIndex !== -1) {
          allDevices[originalDeviceIndex].is_original = true;
        }
      } else {
        console.log('⚠️ Could not determine original device from statistics either');
      }
    }
    
    console.log('📱 Final allDevices after original device processing:', allDevices.map(d => ({ id: d.device_id, is_original: d.is_original })));

    console.log('✅ Devices loaded successfully:', allDevices.length);
    console.log('📱 Final devices list:', allDevices.map(d => ({ id: d.device_id, is_original: d.is_original })));

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
