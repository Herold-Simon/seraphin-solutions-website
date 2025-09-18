// api/auth/check-reset-status.js - Passwort-Reset-Status überprüfen
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
        const { username } = req.query;

        if (!username) {
            return res.status(400).json({ error: 'Benutzername ist erforderlich' });
        }

        // Suche nach aktiven Reset-Requests für diesen Benutzer
        const { data: resetRequest, error: checkError } = await supabase
            .from('password_reset_requests')
            .select('*')
            .eq('username', username)
            .eq('status', 'confirmed')
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('Error checking reset status:', checkError);
            return res.status(500).json({ 
                error: 'Database error',
                details: 'Failed to check reset status'
            });
        }

        if (!resetRequest) {
            return res.status(200).json({
                success: true,
                confirmed: false,
                message: 'No confirmed reset request found'
            });
        }

        return res.status(200).json({
            success: true,
            confirmed: true,
            message: 'Reset request confirmed',
            requestId: resetRequest.id,
            confirmedAt: resetRequest.confirmed_at
        });

    } catch (error) {
        console.error('Reset status check error:', error);
        return res.status(500).json({ error: 'Interner Serverfehler' });
    }
}
