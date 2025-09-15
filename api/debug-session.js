// api/debug-session.js - Debug Session Information
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

  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      method: req.method,
      headers: {
        cookie: req.headers.cookie || 'No cookies found',
        userAgent: req.headers['user-agent'] || 'No user agent'
      },
      environment: {
        supabaseUrl: supabaseUrl ? 'Set' : 'Not Set',
        supabaseKey: supabaseServiceKey ? 'Set' : 'Not Set'
      }
    };

    // Cookie-Parsing
    if (req.headers.cookie) {
      const parsedCookies = cookie.parse(req.headers.cookie);
      debugInfo.parsedCookies = parsedCookies;
      
      const sessionToken = parsedCookies.session_token;
      debugInfo.sessionToken = sessionToken ? 'Found' : 'Not found';
      
      if (sessionToken) {
        // Versuche Session in Datenbank zu finden
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

        debugInfo.databaseQuery = {
          success: !sessionError,
          error: sessionError?.message || null,
          sessionFound: !!session
        };

        if (session) {
          debugInfo.sessionInfo = {
            id: session.id,
            userId: session.user_id,
            expiresAt: session.expires_at,
            createdAt: session.created_at,
            username: session.website_users?.username,
            adminUserId: session.website_users?.admin_user_id
          };

          // Überprüfe Ablaufzeit
          const now = new Date();
          const expiresAt = new Date(session.expires_at);
          debugInfo.sessionValidity = {
            now: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            isExpired: now > expiresAt,
            timeUntilExpiry: expiresAt.getTime() - now.getTime()
          };
        }
      }
    }

    // Alle Sessions in der Datenbank auflisten (für Debugging)
    const { data: allSessions, error: allSessionsError } = await supabase
      .from('website_sessions')
      .select(`
        id,
        user_id,
        session_token,
        expires_at,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    debugInfo.allSessions = {
      success: !allSessionsError,
      error: allSessionsError?.message || null,
      count: allSessions?.length || 0,
      sessions: allSessions || []
    };

    res.status(200).json({
      success: true,
      debug: debugInfo
    });

  } catch (error) {
    console.error('Debug session error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      debug: {
        timestamp: new Date().toISOString(),
        method: req.method
      }
    });
  }
};
