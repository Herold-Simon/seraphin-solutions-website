// api/test-db.js - Test-API für Datenbankverbindung
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = async function handler(req, res) {
  // CORS-Header setzen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // OPTIONS-Anfrage für Preflight behandeln
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Test 1: Einfache Datenbankabfrage
    const { data: testData, error: testError } = await supabase
      .from('admin_users')
      .select('count')
      .limit(1);

    if (testError) {
      return res.status(200).json({
        success: false,
        error: 'Database connection failed',
        details: testError.message,
        code: testError.code,
        hint: testError.hint,
        timestamp: new Date().toISOString()
      });
    }

    // Test 2: Versuche einen Test-Benutzer zu erstellen
    const testUsername = 'test_' + Date.now();
    const testPassword = 'test123';
    
    const { data: insertData, error: insertError } = await supabase
      .from('admin_users')
      .insert({
        username: testUsername,
        password_hash: 'test_hash',
        full_name: 'Test User'
      })
      .select();

    if (insertError) {
      return res.status(200).json({
        success: false,
        error: 'Database insert failed',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint,
        timestamp: new Date().toISOString()
      });
    }

    // Test 3: Lösche den Test-Benutzer wieder
    const { error: deleteError } = await supabase
      .from('admin_users')
      .delete()
      .eq('username', testUsername);

    return res.status(200).json({
      success: true,
      message: 'Database connection and operations successful',
      tests: {
        connection: 'OK',
        insert: 'OK',
        delete: deleteError ? 'Warning: ' + deleteError.message : 'OK'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(200).json({
      success: false,
      error: 'Unexpected error',
      details: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
};
