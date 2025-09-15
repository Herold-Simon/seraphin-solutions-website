// api/statistics/get.js - Statistiken für Website abrufen
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const sessionToken = req.cookies.session_token;

        if (!sessionToken) {
            return res.status(401).json({ error: 'Nicht authentifiziert' });
        }

        // Validiere Session
        const { data: session } = await supabase
            .from('website_sessions')
            .select('user_id, website_users!inner(admin_user_id)')
            .eq('session_token', sessionToken)
            .eq('expires_at', '>', new Date().toISOString())
            .single();

        if (!session) {
            return res.status(401).json({ error: 'Ungültige Session' });
        }

        const adminUserId = session.website_users.admin_user_id;

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
        return res.status(500).json({ error: 'Interner Serverfehler' });
    }
}
