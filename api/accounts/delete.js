// api/accounts/delete.js - Account-Löschung aus App
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS-Header setzen
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
    // CORS-Header für alle Anfragen setzen
    setCorsHeaders(res);
    
    // OPTIONS-Anfrage für Preflight behandeln
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { admin_user_id } = req.body;

        if (!admin_user_id) {
            return res.status(400).json({ error: 'Admin-Benutzer-ID ist erforderlich' });
        }

        // Prüfe ob Admin-Benutzer existiert
        const { data: adminUser, error: adminError } = await supabase
            .from('admin_users')
            .select('id, username')
            .eq('id', admin_user_id)
            .single();

        if (adminError || !adminUser) {
            return res.status(404).json({ error: 'Admin-Benutzer nicht gefunden' });
        }

        // Lösche alle zugehörigen Statistiken
        const { error: statsError } = await supabase
            .from('app_statistics')
            .delete()
            .eq('admin_user_id', admin_user_id);

        if (statsError) {
            console.error('Error deleting app statistics:', statsError);
        }

        const { error: videoStatsError } = await supabase
            .from('video_statistics')
            .delete()
            .eq('admin_user_id', admin_user_id);

        if (videoStatsError) {
            console.error('Error deleting video statistics:', videoStatsError);
        }

        const { error: floorStatsError } = await supabase
            .from('floor_statistics')
            .delete()
            .eq('admin_user_id', admin_user_id);

        if (floorStatsError) {
            console.error('Error deleting floor statistics:', floorStatsError);
        }

        // Lösche Website-Sessions
        const { error: sessionsError } = await supabase
            .from('website_sessions')
            .delete()
            .eq('user_id', (await supabase
                .from('website_users')
                .select('id')
                .eq('admin_user_id', admin_user_id)
                .single()
            ).data?.id);

        if (sessionsError) {
            console.error('Error deleting website sessions:', sessionsError);
        }

        // Lösche Website-Benutzer (CASCADE sollte auch admin_users löschen)
        const { error: websiteUserError } = await supabase
            .from('website_users')
            .delete()
            .eq('admin_user_id', admin_user_id);

        if (websiteUserError) {
            console.error('Error deleting website user:', websiteUserError);
            return res.status(500).json({ error: 'Fehler beim Löschen des Website-Benutzers' });
        }

        // Lösche Admin-Benutzer
        const { error: adminDeleteError } = await supabase
            .from('admin_users')
            .delete()
            .eq('id', admin_user_id);

        if (adminDeleteError) {
            console.error('Error deleting admin user:', adminDeleteError);
            return res.status(500).json({ error: 'Fehler beim Löschen des Admin-Benutzers' });
        }

        return res.status(200).json({
            success: true,
            message: 'Account und alle zugehörigen Daten erfolgreich gelöscht',
            deleted_username: adminUser.username
        });

    } catch (error) {
        console.error('Account deletion error:', error);
        return res.status(500).json({ error: 'Interner Serverfehler' });
    }
}
