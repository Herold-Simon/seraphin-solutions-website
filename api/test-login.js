// api/test-login.js - Test-API für Login
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
  
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'Login Test-API ist erreichbar. Verwenden Sie POST mit {"username": "test", "password": "test123"}',
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

    // Test: Prüfe Website-Benutzer
    const { data: user, error: userError } = await supabase
      .from('website_users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (userError) {
      return res.status(200).json({
        success: false,
        error: 'Database query failed',
        details: userError.message,
        code: userError.code,
        timestamp: new Date().toISOString()
      });
    }

    if (!user) {
      return res.status(200).json({
        success: false,
        error: 'User not found',
        message: 'Benutzer nicht gefunden oder inaktiv',
        timestamp: new Date().toISOString()
      });
    }

    // Test: Passwort-Hash überprüfen
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    return res.status(200).json({
      success: true,
      message: 'Login test successful',
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        admin_user_id: user.admin_user_id
      },
      passwordMatch: passwordMatch,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(200).json({
      success: false,
      error: 'Login test failed',
      details: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
};
