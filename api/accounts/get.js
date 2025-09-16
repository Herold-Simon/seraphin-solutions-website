// api/accounts/get.js - Account-Daten abrufen
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS-Header setzen
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

    // Prüfe Umgebungsvariablen
    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Missing environment variables');
        return res.status(500).json({ 
            error: 'Server configuration error',
            details: 'Missing Supabase credentials'
        });
    }

    try {
        // Hole alle Admin-Benutzer (sollte nur einen geben)
        const { data: adminUsers, error: adminError } = await supabase
            .from('admin_users')
            .select('id, username, created_at')
            .order('created_at', { ascending: false });

        if (adminError) {
            console.error('Error fetching admin users:', adminError);
            return res.status(500).json({ 
                error: 'Database error',
                details: 'Failed to fetch admin users'
            });
        }

        if (!adminUsers || adminUsers.length === 0) {
            return res.status(200).json({
                success: true,
                hasAccount: false,
                message: 'Kein Account vorhanden'
            });
        }

        // Es sollte nur einen Account geben
        const adminUser = adminUsers[0];

        return res.status(200).json({
            success: true,
            hasAccount: true,
            account: {
                id: adminUser.id,
                username: adminUser.username,
                created_at: adminUser.created_at
            }
        });

    } catch (error) {
        console.error('Account fetch error:', error);
        return res.status(500).json({ error: 'Interner Serverfehler' });
    }
}
