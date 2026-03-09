// api/statistics/sync.js - Statistiken-Synchronisation aus App
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
}

// Konvertiert Unix-Timestamps zu ISO-Strings
function convertTimestamp(timestamp) {
    if (!timestamp) return null;
    if (typeof timestamp === 'number' && timestamp > 1000000000000) {
        return new Date(timestamp).toISOString();
    } else if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? null : date.toISOString();
    }
    return null;
}

module.exports = async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { admin_user_id, statistics, device_id } = req.body;

        if (!admin_user_id || !statistics) {
            return res.status(400).json({ success: false, error: 'Admin-Benutzer-ID und Statistiken sind erforderlich' });
        }

        // Admin-Benutzer prüfen
        const { data: adminUser } = await supabase
            .from('admin_users')
            .select('id')
            .eq('id', admin_user_id)
            .single();

        if (!adminUser) {
            return res.status(404).json({ error: 'Admin-Benutzer nicht gefunden' });
        }

        // Geräte-Session aktualisieren (falls device_id vorhanden)
        if (device_id) {
            const { error: sessionError } = await supabase
                .rpc('update_device_activity', {
                    p_admin_user_id: admin_user_id,
                    p_device_id: device_id,
                    p_device_name: `Device ${device_id.substring(0, 8)}`
                });

            if (sessionError) {
                console.error('Device session update error:', sessionError.message);
            }
        }

        const today = new Date().toISOString().split('T')[0];
        const statsBase = {
            admin_user_id,
            date: today,
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
            time_range_end: statistics.time_range_end,
            updated_at: new Date().toISOString()
        };

        // App-Statistiken (einzelner Upsert)
        const { error: appStatsError } = await supabase
            .from('app_statistics')
            .upsert(statsBase, { onConflict: 'admin_user_id,date' });

        if (appStatsError) {
            console.error('App statistics sync error:', appStatsError.message);
            return res.status(500).json({ success: false, error: 'Fehler beim Synchronisieren der App-Statistiken' });
        }

        // Geräte-spezifische Statistiken (einzelner Upsert)
        if (device_id) {
            const { error: deviceStatsError } = await supabase
                .from('device_statistics')
                .upsert({ ...statsBase, device_id }, { onConflict: 'admin_user_id,device_id,date' });

            if (deviceStatsError) {
                console.error('Device statistics sync error:', deviceStatsError.message);
            }
        }

        // Video-Statistiken (Batch-Upsert statt N+1-Schleife)
        if (statistics.videos && Array.isArray(statistics.videos) && statistics.videos.length > 0) {
            const videoRows = statistics.videos.map(video => {
                const row = {
                    admin_user_id,
                    video_id: video.id,
                    video_title: video.title,
                    views: video.views || 0,
                    last_viewed: convertTimestamp(video.lastViewed),
                    created_at: convertTimestamp(video.createdAt),
                    updated_at: convertTimestamp(video.updatedAt)
                };
                if (video.viewHistory) row.view_history = video.viewHistory;
                return row;
            });

            const { error: videoError } = await supabase
                .from('video_statistics')
                .upsert(videoRows, { onConflict: 'admin_user_id,video_id' });

            if (videoError) {
                console.error('Video statistics sync error:', videoError.message);
            }

            // Geräte-spezifische Video-Statistiken (Batch-Upsert)
            if (device_id) {
                const deviceVideoRows = statistics.videos.map(video => {
                    const row = {
                        admin_user_id,
                        device_id,
                        video_id: video.id,
                        video_title: video.title,
                        views: video.views || 0,
                        last_viewed: convertTimestamp(video.lastViewed),
                        created_at: convertTimestamp(video.createdAt),
                        updated_at: convertTimestamp(video.updatedAt)
                    };
                    if (video.viewHistory) row.view_history = video.viewHistory;
                    return row;
                });

                const { error: deviceVideoError } = await supabase
                    .from('device_video_statistics')
                    .upsert(deviceVideoRows, { onConflict: 'admin_user_id,device_id,video_id' });

                if (deviceVideoError) {
                    console.error('Device video statistics sync error:', deviceVideoError.message);
                }
            }
        }

        // Floor-Statistiken (Batch-Upsert)
        if (statistics.floors && Array.isArray(statistics.floors) && statistics.floors.length > 0) {
            const floorRows = statistics.floors.map(floor => ({
                admin_user_id,
                floor_id: floor.id,
                floor_name: floor.name,
                room_count: floor.objectVideoMappings?.length || 0
            }));

            const { error: floorError } = await supabase
                .from('floor_statistics')
                .upsert(floorRows, { onConflict: 'admin_user_id,floor_id' });

            if (floorError) {
                console.error('Floor statistics sync error:', floorError.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Statistiken erfolgreich synchronisiert'
        });

    } catch (error) {
        console.error('Statistics sync error:', error.message);
        return res.status(500).json({ success: false, error: 'Interner Serverfehler' });
    }
}
