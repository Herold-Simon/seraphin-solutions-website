// api/statistics/sync.js - Statistiken-Synchronisation aus App
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
    // CORS-Header für alle Anfragen setzen
    setCorsHeaders(res);
    
    // OPTIONS-Anfrage für Preflight behandeln
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('🔄 Statistics sync request received');
        
        const {
            admin_user_id,
            statistics
        } = req.body;

        console.log('📊 Sync data:', { admin_user_id, statisticsKeys: Object.keys(statistics || {}) });

        if (!admin_user_id || !statistics) {
            console.log('❌ Missing required fields:', { admin_user_id: !!admin_user_id, statistics: !!statistics });
            return res.status(400).json({ success: false, error: 'Admin-Benutzer-ID und Statistiken sind erforderlich' });
        }

        // Prüfe ob Admin-Benutzer existiert
        const { data: adminUser } = await supabase
            .from('admin_users')
            .select('id')
            .eq('id', admin_user_id)
            .single();

        if (!adminUser) {
            return res.status(404).json({ error: 'Admin-Benutzer nicht gefunden' });
        }

        // Synchronisiere App-Statistiken
        const { error: appStatsError } = await supabase
            .from('app_statistics')
            .upsert({
                admin_user_id,
                date: new Date().toISOString().split('T')[0],
                total_videos: statistics.total_videos || 0,
                videos_with_views: statistics.videos_with_views || 0,
                total_views: statistics.total_views || 0,
                total_floors: statistics.total_floors || 0,
                total_rooms: statistics.total_rooms || 0,
                pie_chart_video_count: statistics.pie_chart_video_count || 0,
                line_chart_video_count: statistics.line_chart_video_count || 0,
                bar_chart_video_count: statistics.bar_chart_video_count || 0,
                line_race_video_count: statistics.line_race_video_count || 0,
                time_range_start: statistics.time_range_start,
                time_range_end: statistics.time_range_end
            }, {
                onConflict: 'admin_user_id,date'
            });

        if (appStatsError) {
            console.error('❌ App statistics sync error:', appStatsError);
            return res.status(500).json({ success: false, error: 'Fehler beim Synchronisieren der App-Statistiken: ' + appStatsError.message });
        }

        console.log('✅ App statistics synced successfully');

        // Synchronisiere Video-Statistiken
        if (statistics.videos && Array.isArray(statistics.videos)) {
            for (const video of statistics.videos) {
                await supabase
                    .from('video_statistics')
                    .upsert({
                        admin_user_id,
                        video_id: video.id,
                        video_title: video.title,
                        views: video.views || 0,
                        last_viewed: video.lastViewed
                    }, {
                        onConflict: 'admin_user_id,video_id'
                    });
            }
        }

        // Synchronisiere Floor-Statistiken
        if (statistics.floors && Array.isArray(statistics.floors)) {
            for (const floor of statistics.floors) {
                await supabase
                    .from('floor_statistics')
                    .upsert({
                        admin_user_id,
                        floor_id: floor.id,
                        floor_name: floor.name,
                        room_count: floor.objectVideoMappings?.length || 0
                    }, {
                        onConflict: 'admin_user_id,floor_id'
                    });
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Statistiken erfolgreich synchronisiert'
        });

    } catch (error) {
        console.error('❌ Statistics sync error:', error);
        return res.status(500).json({ success: false, error: 'Interner Serverfehler: ' + error.message });
    }
}
