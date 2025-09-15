// api/auth/verify-session.js - Session-Verifikation
const { createClient } = require('@supabase/supabase-js');
const cookie = require('cookie');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS-Header setzen
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Session-Cookie aus den Headers extrahieren
    const cookies = req.headers.cookie;
    
    console.log('🔍 Verify Session - Cookies received:', cookies);
    
    if (!cookies) {
      console.log('❌ No cookies found in request');
      return res.status(401).json({ success: false, error: 'No session cookie found' });
    }

    const parsedCookies = cookie.parse(cookies);
    const sessionToken = parsedCookies.session_token;

    console.log('🔍 Parsed cookies:', parsedCookies);
    console.log('🔍 Session token:', sessionToken ? 'Found' : 'Not found');

    if (!sessionToken) {
      console.log('❌ No session token found in cookies');
      return res.status(401).json({ success: false, error: 'No session token found' });
    }

    // Session in der Datenbank überprüfen
    const { data: session, error: sessionError } = await supabase
      .from('website_sessions')
      .select(`
        id,
        user_id,
        session_token,
        expires_at,
        created_at,
        website_users!inner(
          id,
          username,
          admin_user_id
        )
      `)
      .eq('session_token', sessionToken)
      .single();

    if (sessionError || !session) {
      console.log('Session verification failed:', sessionError?.message || 'Session not found');
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    // Überprüfen, ob Session abgelaufen ist
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    
    if (now > expiresAt) {
      console.log('Session expired');
      return res.status(401).json({ success: false, error: 'Session expired' });
    }

    // Session ist gültig
    return res.status(200).json({ 
      success: true, 
      user: {
        id: session.website_users.id,
        username: session.website_users.username,
        admin_user_id: session.website_users.admin_user_id
      }
    });

  } catch (error) {
    console.error('Session verification error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
