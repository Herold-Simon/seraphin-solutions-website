const { createClient } = require('@supabase/supabase-js');
const cookie = require('cookie');

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

module.exports = async (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed. Use GET.' });
    }

    try {
        const cookies = cookie.parse(req.headers.cookie || '');
        const sessionToken = cookies.session_token;
        let adminUserId = null;

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return res.status(500).json({ success: false, error: 'Server-Konfiguration fehlt' });
        }

        // Session-Verifikation
        if (sessionToken) {
            const { data: session } = await supabase
                .from('website_sessions')
                .select(`expires_at, website_users!inner(admin_user_id)`)
                .eq('session_token', sessionToken)
                .gt('expires_at', new Date().toISOString())
                .single();

            if (session) {
                adminUserId = session.website_users.admin_user_id;
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

        // Alle Geräte-Sessions parallel laden (aktive + alle als Fallback)
        const [{ data: sessionDevices }, { data: adminUser }] = await Promise.all([
            supabase
                .from('device_sessions')
                .select('device_id, device_name, last_active, created_at, is_active')
                .eq('admin_user_id', adminUserId)
                .order('last_active', { ascending: false }),
            supabase
                .from('admin_users')
                .select('device_id')
                .eq('id', adminUserId)
                .single()
        ]);

        // Geräte zusammenführen (Sessions haben Priorität)
        const deviceMap = new Map();

        if (sessionDevices) {
            for (const d of sessionDevices) {
                deviceMap.set(d.device_id, {
                    device_id: d.device_id,
                    device_name: d.device_name || d.device_id,
                    last_active: d.last_active,
                    created_at: d.created_at,
                    source: d.is_active ? 'active_session' : 'inactive_session',
                    is_active: d.is_active
                });
            }
        }

        // Ursprüngliches Gerät ergänzen (falls noch nicht vorhanden)
        if (adminUser?.device_id && !deviceMap.has(adminUser.device_id)) {
            deviceMap.set(adminUser.device_id, {
                device_id: adminUser.device_id,
                device_name: adminUser.device_id,
                last_active: null,
                created_at: null,
                source: 'original',
                is_active: false
            });
        }

        const allDevices = [...deviceMap.values()].sort((a, b) => {
            if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
            if (a.last_active && b.last_active) return new Date(b.last_active) - new Date(a.last_active);
            if (a.last_active) return -1;
            if (b.last_active) return 1;
            return 0;
        });

        res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');

        return res.status(200).json({
            success: true,
            devices: allDevices,
            total_devices: allDevices.length
        });

    } catch (error) {
        console.error('Devices list error:', error.message);
        return res.status(500).json({ success: false, error: 'Interner Serverfehler' });
    }
};
