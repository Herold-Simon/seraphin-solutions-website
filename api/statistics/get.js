// api/statistics/get.js - Statistiken für Website abrufen
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
    // CORS-Header für alle Anfragen setzen
    setCorsHeaders(res);
    
    // OPTIONS-Anfrage für Preflight behandeln
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const cookies = cookie.parse(req.headers.cookie || '');
        const sessionToken = cookies.session_token;

        if (!sessionToken) {
            return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
        }

        // Validiere Session
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

        if (sessionError || !session) {
            console.log('Statistics API - Session validation failed:', sessionError?.message || 'Session not found');
            return res.status(401).json({ success: false, error: 'Ungültige Session' });
        }

        // Überprüfe Ablaufzeit
        const now = new Date();
        const expiresAt = new Date(session.expires_at);
        
        if (now > expiresAt) {
            console.log('Statistics API - Session expired');
            return res.status(401).json({ success: false, error: 'Session abgelaufen' });
        }

        const adminUserId = session.website_users.admin_user_id;
        console.log('Statistics API - Loading data for admin_user_id:', adminUserId);

        // Hole App-Statistiken
        const { data: appStats } = await supabase
            .from('app_statistics')
            .select('*')
            .eq('admin_user_id', adminUserId)
            .order('date', { ascending: false })
            .limit(30);

        // Hole Video-Statistiken
        const { data: videoStats } = await supabase
            .from('video_statistics')
            .select('*')
            .eq('admin_user_id', adminUserId)
            .order('views', { ascending: false });

        // Hole Floor-Statistiken
        const { data: floorStats } = await supabase
            .from('floor_statistics')
            .select('*')
            .eq('admin_user_id', adminUserId);

        // Berechne Gesamtstatistiken
        const totalStats = {
            total_videos: videoStats?.reduce((sum, video) => sum + (video.views || 0), 0) || 0,
            videos_with_views: videoStats?.filter(video => video.views > 0).length || 0,
            total_views: videoStats?.reduce((sum, video) => sum + (video.views || 0), 0) || 0,
            total_floors: floorStats?.length || 0,
            total_rooms: floorStats?.reduce((sum, floor) => sum + (floor.room_count || 0), 0) || 0
        };

        // Hole aktuelle Statistiken
        const currentStats = appStats?.[0] || totalStats;

        return res.status(200).json({
            success: true,
            statistics: {
                current: currentStats,
                total: totalStats,
                videos: videoStats || [],
                floors: floorStats || [],
                history: appStats || []
            }
        });

    } catch (error) {
        console.error('Statistics fetch error:', error);
        return res.status(500).json({ success: false, error: 'Interner Serverfehler: ' + error.message });
    }
}
