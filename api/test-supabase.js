// api/test-supabase.js - Test-API für Supabase-Verbindung
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // CORS-Header setzen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // OPTIONS-Anfrage für Preflight behandeln
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  try {
    // Test: Erstelle Supabase-Client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Test: Versuche eine einfache Abfrage
    const { data, error } = await supabase
      .from('admin_users')
      .select('count')
      .limit(1);
    
    if (error) {
      return res.status(200).json({
        success: false,
        error: 'Supabase query failed',
        details: error.message,
        code: error.code,
        hint: error.hint,
        supabaseUrl: supabaseUrl ? supabaseUrl.substring(0, 50) + '...' : 'Not set',
        supabaseKeyLength: supabaseServiceKey ? supabaseServiceKey.length : 0,
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Supabase connection successful',
      data: data,
      supabaseUrl: supabaseUrl ? supabaseUrl.substring(0, 50) + '...' : 'Not set',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return res.status(200).json({
      success: false,
      error: 'Supabase client creation failed',
      details: error.message,
      supabaseUrl: supabaseUrl ? supabaseUrl.substring(0, 50) + '...' : 'Not set',
      supabaseKeyLength: supabaseServiceKey ? supabaseServiceKey.length : 0,
      timestamp: new Date().toISOString()
    });
  }
};
