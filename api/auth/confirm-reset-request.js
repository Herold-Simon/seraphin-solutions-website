// api/auth/confirm-reset-request.js - Reset-Request bestätigen
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
    
    if (req.method !== 'POST') {
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
        const { requestId, username } = req.body;

        if (!requestId || !username) {
            return res.status(400).json({ error: 'Request-ID und Benutzername sind erforderlich' });
        }

        // Prüfe ob der Reset-Request existiert und noch gültig ist
        const { data: resetRequest, error: checkError } = await supabase
            .from('password_reset_requests')
            .select('*')
            .eq('id', requestId)
            .eq('username', username)
            .eq('status', 'pending')
            .gte('expires_at', new Date().toISOString())
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            console.error('Error checking reset request:', checkError);
            return res.status(500).json({ 
                error: 'Database error',
                details: 'Failed to check reset request'
            });
        }

        if (!resetRequest) {
            return res.status(404).json({ 
                error: 'Reset-Request nicht gefunden oder bereits abgelaufen' 
            });
        }

        // Bestätige den Reset-Request
        const { data: updatedRequest, error: updateError } = await supabase
            .from('password_reset_requests')
            .update({
                status: 'confirmed',
                confirmed_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .select()
            .single();

        if (updateError) {
            console.error('Error confirming reset request:', updateError);
            return res.status(500).json({ error: 'Fehler beim Bestätigen des Reset-Requests' });
        }

        return res.status(200).json({
            success: true,
            message: 'Reset-Request erfolgreich bestätigt',
            request: updatedRequest
        });

    } catch (error) {
        console.error('Confirm reset request error:', error);
        return res.status(500).json({ error: 'Interner Serverfehler' });
    }
}
