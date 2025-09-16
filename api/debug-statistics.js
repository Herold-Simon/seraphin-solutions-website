import { createClient } from '@supabase/supabase-js';

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

export default async function handler(req, res) {
    // CORS-Preflight-Request behandeln
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        return res.status(200).end();
    }

    setCorsHeaders(res);

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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
