// api/debug-sync.js - Debug Sync API
const { createClient } = require('@supabase/supabase-js');

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
      environment: {
        supabaseUrl: supabaseUrl ? 'Set' : 'Not Set',
        supabaseKey: supabaseServiceKey ? 'Set' : 'Not Set'
      }
    };

    if (req.method === 'POST') {
      debugInfo.requestBody = req.body;
      debugInfo.bodyKeys = Object.keys(req.body || {});
      
      const { admin_user_id, statistics } = req.body;
      debugInfo.parsedData = {
        admin_user_id: admin_user_id,
        hasStatistics: !!statistics,
        statisticsKeys: statistics ? Object.keys(statistics) : []
      };

      if (admin_user_id) {
        // Teste Admin-User-Abfrage
        const { data: adminUser, error: adminError } = await supabase
          .from('admin_users')
          .select('id')
          .eq('id', admin_user_id)
          .single();

        debugInfo.adminUserQuery = {
          success: !adminError,
          error: adminError?.message || null,
          userFound: !!adminUser
        };

        if (adminUser) {
          // Teste App-Statistics-Insert
          const testStats = {
            admin_user_id,
            date: new Date().toISOString().split('T')[0],
            total_videos: 0,
            videos_with_views: 0,
            total_views: 0,
            total_floors: 0,
            total_rooms: 0
          };

          const { error: testError } = await supabase
            .from('app_statistics')
            .upsert(testStats, {
              onConflict: 'admin_user_id,date'
            });

          debugInfo.testInsert = {
            success: !testError,
            error: testError?.message || null
          };
        }
      }
    }

    res.status(200).json({
      success: true,
      debug: debugInfo
    });

  } catch (error) {
    console.error('Debug sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      debug: {
        timestamp: new Date().toISOString(),
        method: req.method
      }
    });
  }
};
