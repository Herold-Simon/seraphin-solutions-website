// api/auth/get-pending-reset-requests.js - Ausstehende Reset-Requests abrufen
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
        // Hole alle ausstehenden Reset-Requests
        const { data: resetRequests, error: fetchError } = await supabase
            .from('password_reset_requests')
            .select('*')
            .eq('status', 'pending')
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (fetchError) {
            console.error('Error fetching reset requests:', fetchError);
            return res.status(500).json({ 
                error: 'Database error',
                details: 'Failed to fetch reset requests'
            });
        }

        return res.status(200).json({
            success: true,
            requests: resetRequests || [],
            count: resetRequests ? resetRequests.length : 0
        });

    } catch (error) {
        console.error('Get pending reset requests error:', error);
        return res.status(500).json({ error: 'Interner Serverfehler' });
    }
}
