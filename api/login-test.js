// api/login-test.js - Einfache Login-Test-API
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
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort sind erforderlich' });
    }

    // Prüfe Website-Benutzer
    const { data: user, error: userError } = await supabase
      .from('website_users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // Passwort überprüfen
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        admin_user_id: user.admin_user_id
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
};
