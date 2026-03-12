// api/statistics/get.js - Statistiken für Website abrufen
const { createClient } = require('@supabase/supabase-js');
const cookie = require('cookie');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// In-Memory-Cache: reduziert Supabase-Egress bei häufigen Requests
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 Minuten

function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCached(key, data) {
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

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
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const cookies = cookie.parse(req.headers.cookie || '');
        const sessionToken = cookies.session_token;
        let adminUserId = null;

        // Session-Verifikation
        if (sessionToken) {
            const { data: session } = await supabase
                .from('website_sessions')
                .select(`expires_at, website_users!inner(admin_user_id)`)
                .eq('session_token', sessionToken)
                .single();

            if (session) {
                const now = new Date();
                const expiresAt = new Date(session.expires_at);
                if (now <= expiresAt) {
                    adminUserId = session.website_users.admin_user_id;
                }
            }
        }

        // Fallback: Admin-User aus neuesten Statistiken ermitteln
        if (!adminUserId) {
            const { data: recentStats } = await supabase
                .from('app_statistics')
                .select('admin_user_id')
                .order('date', { ascending: false })
                .limit(1)
                .single();

            if (!recentStats) {
                return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
            }
            adminUserId = recentStats.admin_user_id;
        }

        const deviceId = req.query.device_id;
        const includeHistory = req.query.include_history === 'true';

        // Cache-Key: pro User + Abfrageparameter
        const cacheKey = `stats:${adminUserId}:${deviceId || 'all'}:${includeHistory}`;
        const cached = getCached(cacheKey);
        if (cached) {
            res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
            res.setHeader('X-Cache', 'HIT');
            return res.status(200).json(cached);
        }

        const videoSelectBase = 'video_id, video_title, views, last_viewed, created_at, updated_at';
        const videoSelectFull = `${videoSelectBase}, view_history`;

        // App-Statistiken laden
        let appStats;
        if (deviceId && deviceId !== 'all') {
            const { data } = await supabase
                .from('device_statistics')
                .select('admin_user_id, device_id, date, total_videos, videos_with_views, total_views, total_floors, total_rooms, pie_chart_video_count, line_chart_video_count, bar_chart_video_count, line_race_video_count')
                .eq('admin_user_id', adminUserId)
                .eq('device_id', deviceId)
                .order('date', { ascending: false })
                .limit(30);
            appStats = data || [];
        } else {
            const { data: aggregated } = await supabase
                .rpc('get_aggregated_device_statistics', { p_admin_user_id: adminUserId });

            if (aggregated && aggregated.length > 0) {
                const a = aggregated[0];
                appStats = [{
                    admin_user_id: adminUserId,
                    date: new Date().toISOString().split('T')[0],
                    total_videos: a.total_videos,
                    videos_with_views: a.videos_with_views,
                    total_views: a.total_views,
                    total_floors: a.total_floors,
                    total_rooms: a.total_rooms,
                    pie_chart_video_count: a.pie_chart_video_count,
                    line_chart_video_count: a.line_chart_video_count,
                    bar_chart_video_count: a.bar_chart_video_count,
                    line_race_video_count: a.line_race_video_count,
                    device_count: a.device_count
                }];
            } else {
                const { data: direct } = await supabase
                    .from('app_statistics')
                    .select('admin_user_id, date, total_videos, videos_with_views, total_views, total_floors, total_rooms, pie_chart_video_count, line_chart_video_count, bar_chart_video_count, line_race_video_count, device_count')
                    .eq('admin_user_id', adminUserId)
                    .order('date', { ascending: false })
                    .limit(30);
                appStats = direct || [];
            }
        }

        // Video-Statistiken laden
        let videoStats = [];

        if (deviceId && deviceId !== 'all') {
            // Geräte-spezifisch: nur device_video_statistics
            const { data } = await supabase
                .from('device_video_statistics')
                .select(includeHistory ? videoSelectFull : videoSelectBase)
                .eq('admin_user_id', adminUserId)
                .eq('device_id', deviceId)
                .order('views', { ascending: false });
            videoStats = data || [];
        } else {
            // Alle Geräte: device_video_statistics zuerst, video_statistics nur als Fallback
            // (vermeidet doppelten Egress durch parallele Abfragen)
            const videoSelect = includeHistory ? videoSelectFull : videoSelectBase;

            const { data: dvData } = await supabase
                .from('device_video_statistics')
                .select(videoSelect)
                .eq('admin_user_id', adminUserId)
                .order('views', { ascending: false });

            const hasHistory = (rows) => rows && rows.some(v => v.view_history && Object.keys(v.view_history).length > 0);

            if (dvData && dvData.length > 0 && (!includeHistory || hasHistory(dvData))) {
                videoStats = dvData;
            } else {
                // Fallback: video_statistics laden
                const { data: vsData } = await supabase
                    .from('video_statistics')
                    .select(videoSelect)
                    .eq('admin_user_id', adminUserId)
                    .order('views', { ascending: false });

                if (includeHistory && vsData && hasHistory(vsData)) {
                    videoStats = vsData;
                } else {
                    videoStats = (dvData && dvData.length > 0) ? dvData : (vsData || []);
                }
            }
        }

        // Floor-Statistiken laden
        const { data: floorStats } = await supabase
            .from('floor_statistics')
            .select('floor_id, floor_name, room_count, admin_user_id')
            .eq('admin_user_id', adminUserId)
            .limit(200);

        // Admin-Gerät und Gesamtstatistiken parallel laden
        const { data: adminUser } = await supabase
            .from('admin_users')
            .select('device_id')
            .eq('id', adminUserId)
            .single();

        const totalStats = {
            total_videos: videoStats.length,
            videos_with_views: videoStats.filter(v => (v.views || 0) > 0).length,
            total_views: videoStats.reduce((sum, v) => sum + (v.views || 0), 0),
            total_floors: floorStats?.length || 0,
            total_rooms: floorStats?.reduce((sum, f) => sum + (f.room_count || 0), 0) || 0
        };

        const structuredVideos = videoStats.map(video => ({
            id: video.video_id || '',
            title: video.video_title || 'Unbenanntes Video',
            views: parseInt(video.views) || 0,
            lastViewed: video.last_viewed || null,
            createdAt: video.created_at || null,
            updatedAt: video.updated_at || null,
            viewHistory: video.view_history || {}
        }));

        res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
        res.setHeader('X-Cache', 'MISS');

        const responseBody = {
            success: true,
            statistics: {
                current: appStats?.[0] || totalStats,
                total: totalStats,
                videos: structuredVideos,
                floors: floorStats || [],
                history: appStats || [],
                device_id: adminUser?.device_id || null
            }
        };

        setCached(cacheKey, responseBody);

        return res.status(200).json(responseBody);

    } catch (error) {
        console.error('Statistics fetch error:', error.message);
        return res.status(500).json({ success: false, error: 'Interner Serverfehler' });
    }
}
