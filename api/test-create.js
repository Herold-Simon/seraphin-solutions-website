// api/test-create.js - Test-API für Account-Erstellung
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

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
  
  // Erlaube sowohl GET als auch POST für Tests
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'Test-API ist erreichbar. Verwenden Sie POST mit {"username": "test", "password": "test123"}',
      method: 'GET',
      timestamp: new Date().toISOString()
    });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort sind erforderlich' });
    }

    // Test: Versuche eine einfache Datenbankabfrage
    const { data: testData, error: testError } = await supabase
      .from('admin_users')
      .select('count')
      .limit(1);

    if (testError) {
      console.error('Database connection test failed:', testError);
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: testError.message,
        code: testError.code
      });
    }

    // Test: Hash ein Passwort
    const hashedPassword = await bcrypt.hash(password, 10);

    return res.status(200).json({
      success: true,
      message: 'Test erfolgreich',
      username: username,
      passwordHashed: hashedPassword ? 'Yes' : 'No',
      databaseConnected: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Test error:', error);
    return res.status(500).json({ 
      error: 'Test failed',
      details: error.message,
      stack: error.stack
    });
  }
};
