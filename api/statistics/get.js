// api/statistics/get.js - Statistiken für Website abrufen
const { createClient } = require('@supabase/supabase-js');
const cookie = require('cookie');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CSV-Parsing-Funktionen entfernt - verwenden jetzt direkte Datenbankabfragen

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

    // Debug-Modus: Zeige alle Datenbankinhalte
    if (req.query.debug === 'true') {
        try {
            console.log('🔍 Debug: Checking all statistics data...');

            // Hole alle Admin-User
            const { data: adminUsers, error: adminError } = await supabase
                .from('admin_users')
                .select('id, username');

            if (adminError) {
                console.error('❌ Admin users query error:', adminError);
                return res.status(500).json({ error: 'Failed to fetch admin users' });
            }

            console.log('👥 Admin users:', adminUsers);

            // Hole alle App-Statistiken
            const { data: appStats, error: appError } = await supabase
                .from('app_statistics')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            if (appError) {
                console.error('❌ App statistics query error:', appError);
            } else {
                console.log('📊 App statistics (last 10):', appStats);
            }

            // Hole alle Video-Statistiken
            const { data: videoStats, error: videoError } = await supabase
                .from('video_statistics')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            if (videoError) {
                console.error('❌ Video statistics query error:', videoError);
            } else {
                console.log('🎥 Video statistics (last 10):', videoStats);
            }

            // Hole alle Floor-Statistiken
            const { data: floorStats, error: floorError } = await supabase
                .from('floor_statistics')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            if (floorError) {
                console.error('❌ Floor statistics query error:', floorError);
            } else {
                console.log('🏢 Floor statistics (last 10):', floorStats);
            }

            // Hole alle CSV-Statistiken
            const { data: csvStats, error: csvError } = await supabase
                .from('csv_statistics')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            if (csvError) {
                console.error('❌ CSV statistics query error:', csvError);
            } else {
                console.log('📄 CSV statistics (last 5):', csvStats);
            }

            return res.status(200).json({
                success: true,
                debug: {
                    adminUsers,
                    appStatistics: appStats,
                    videoStatistics: videoStats,
                    floorStatistics: floorStats,
                    csvStatistics: csvStats
                }
            });

        } catch (error) {
            console.error('❌ Debug statistics error:', error);
            return res.status(500).json({ 
                error: 'Internal server error',
                details: error.message 
            });
        }
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
        const deviceId = req.query.device_id;
        console.log('Statistics API - Loading data for admin_user_id:', adminUserId, 'device_id:', deviceId);

        // Hole Admin-User-Daten für Geräte-ID
        const { data: adminUser, error: adminUserError } = await supabase
            .from('admin_users')
            .select('device_id')
            .eq('id', adminUserId)
            .single();

        if (adminUserError) {
            console.error('❌ Admin user query error:', adminUserError);
        } else {
            console.log('📱 Device ID for admin user:', adminUser?.device_id);
        }

        // Hole App-Statistiken (geräte-spezifisch oder aggregiert)
        let appStats;
        if (deviceId && deviceId !== 'all') {
            // Geräte-spezifische Statistiken
            console.log('📱 Loading device-specific statistics for device:', deviceId);
            const { data: deviceStats } = await supabase
                .from('device_statistics')
                .select('*')
                .eq('admin_user_id', adminUserId)
                .eq('device_id', deviceId)
                .order('date', { ascending: false })
                .limit(30);
            appStats = deviceStats;
        } else {
            // Aggregierte Statistiken (alle Geräte)
            console.log('📊 Loading aggregated statistics for all devices');
            const { data: aggregatedStats } = await supabase
                .rpc('get_aggregated_device_statistics', {
                    p_admin_user_id: adminUserId
                });
            
            // Konvertiere aggregierte Daten in das erwartete Format
            if (aggregatedStats && aggregatedStats.length > 0) {
                const aggregated = aggregatedStats[0];
                appStats = [{
                    admin_user_id: adminUserId,
                    date: new Date().toISOString().split('T')[0],
                    total_videos: aggregated.total_videos,
                    videos_with_views: aggregated.videos_with_views,
                    total_views: aggregated.total_views,
                    total_floors: aggregated.total_floors,
                    total_rooms: aggregated.total_rooms,
                    pie_chart_video_count: aggregated.pie_chart_video_count,
                    line_chart_video_count: aggregated.line_chart_video_count,
                    bar_chart_video_count: aggregated.bar_chart_video_count,
                    line_race_video_count: aggregated.line_race_video_count,
                    device_count: aggregated.device_count
                }];
            } else {
                // Fallback zu normalen App-Statistiken
                const { data: fallbackStats } = await supabase
                    .from('app_statistics')
                    .select('*')
                    .eq('admin_user_id', adminUserId)
                    .order('date', { ascending: false })
                    .limit(30);
                appStats = fallbackStats;
            }
        }

        // Hole Video-Statistiken (geräte-spezifisch oder aggregiert)
        console.log('📊 Loading video statistics from database...');
        console.log('📊 Querying for admin_user_id:', adminUserId, 'device_id:', deviceId);
        
        let videoStats;
        if (deviceId && deviceId !== 'all') {
            // Geräte-spezifische Video-Statistiken
            console.log('📱 Loading device-specific video statistics for device:', deviceId);
            const { data: deviceVideoStats, error: deviceVideoError } = await supabase
                .from('device_video_statistics')
                .select('*')
                .eq('admin_user_id', adminUserId)
                .eq('device_id', deviceId)
                .order('views', { ascending: false });
            
            if (deviceVideoError) {
                console.error('❌ Device video statistics query error:', deviceVideoError);
                videoStats = [];
            } else {
                videoStats = deviceVideoStats;
            }
        } else {
            // Aggregierte Video-Statistiken (alle Geräte)
            console.log('📊 Loading aggregated video statistics for all devices');
            const { data: aggregatedVideoStats, error: aggregatedVideoError } = await supabase
                .rpc('get_aggregated_device_video_statistics', {
                    p_admin_user_id: adminUserId
                });
            
            if (aggregatedVideoError) {
                console.error('❌ Aggregated video statistics query error:', aggregatedVideoError);
                // Fallback zu normalen Video-Statistiken
                const { data: fallbackVideoStats, error: fallbackVideoError } = await supabase
                    .from('video_statistics')
                    .select('*')
                    .eq('admin_user_id', adminUserId)
                    .order('views', { ascending: false });
                
                if (fallbackVideoError) {
                    console.error('❌ Fallback video statistics query error:', fallbackVideoError);
                    videoStats = [];
                } else {
                    videoStats = fallbackVideoStats;
                }
            } else {
                // Konvertiere aggregierte Video-Daten in das erwartete Format
                videoStats = aggregatedVideoStats.map(video => ({
                    admin_user_id: adminUserId,
                    video_id: video.video_id,
                    video_title: video.video_title,
                    views: video.total_views,
                    last_viewed: video.last_viewed,
                    device_count: video.device_count,
                    aggregated_by_title: video.aggregated_by_title
                }));
            }
        }

        console.log('📊 Video statistics loaded:', videoStats?.length || 0, 'videos');
        if (videoStats && videoStats.length > 0) {
            console.log('📊 First video example:', videoStats[0]);
        } else {
            console.log('📊 No videos found in database for admin_user_id:', adminUserId);
            
            // Debug: Prüfe alle Video-Statistiken in der DB
            const { data: allVideos } = await supabase
                .from('video_statistics')
                .select('admin_user_id, video_id, video_title, views')
                .limit(10);
            
            console.log('📊 All videos in database (first 10):', allVideos);
        }

        // Hole Floor-Statistiken
        const { data: floorStats } = await supabase
            .from('floor_statistics')
            .select('*')
            .eq('admin_user_id', adminUserId);

        // Berechne Gesamtstatistiken
        const totalStats = {
            total_videos: videoStats?.length || 0,
            videos_with_views: videoStats?.filter(video => (video.views || 0) > 0).length || 0,
            total_views: videoStats?.reduce((sum, video) => sum + (video.views || 0), 0) || 0,
            total_floors: floorStats?.length || 0,
            total_rooms: floorStats?.reduce((sum, floor) => sum + (floor.room_count || 0), 0) || 0
        };

        // Hole aktuelle Statistiken
        const currentStats = appStats?.[0] || totalStats;

        // Strukturiere Video-Daten für das Dashboard
        const structuredVideos = (videoStats || []).map(video => ({
            id: video.video_id || '',
            title: video.video_title || 'Unbenanntes Video',
            views: parseInt(video.views) || 0,
            lastViewed: video.last_viewed || null,
            createdAt: video.created_at || null,
            updatedAt: video.updated_at || null,
            viewHistory: video.view_history || {} // Falls view_history in der DB gespeichert ist
        }));

        console.log('📊 Structured Videos:', structuredVideos.length, 'videos');
        console.log('📊 Total Stats:', totalStats);
        console.log('📊 Current Stats:', currentStats);

        // Prüfe ob überhaupt Daten vorhanden sind
        const hasAnyData = structuredVideos.length > 0 || 
                          (floorStats && floorStats.length > 0) || 
                          (appStats && appStats.length > 0) ||
                          Object.values(totalStats).some(val => val > 0);

        if (!hasAnyData) {
            console.log('📊 Keine Daten vorhanden, sende leere Statistiken');
        }

        return res.status(200).json({
            success: true,
            statistics: {
                current: currentStats,
                total: totalStats,
                videos: structuredVideos,
                floors: floorStats || [],
                history: appStats || [],
                device_id: adminUser?.device_id || null
            }
        });

    } catch (error) {
        console.error('Statistics fetch error:', error);
        return res.status(500).json({ success: false, error: 'Interner Serverfehler: ' + error.message });
    }
}
