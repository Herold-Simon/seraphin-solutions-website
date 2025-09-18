// api/auth/request-password-reset.js - Passwort-Reset-Anfrage erstellen
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Debug: Log environment variables (remove in production)
console.log('Supabase URL:', supabaseUrl ? 'Set' : 'Not set');
console.log('Supabase Key:', supabaseServiceKey ? 'Set' : 'Not set');

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
        console.error('Supabase URL:', supabaseUrl ? 'Set' : 'Not set');
        console.error('Supabase Key:', supabaseServiceKey ? 'Set' : 'Not set');
        return res.status(500).json({ 
            error: 'Server configuration error',
            details: 'Missing Supabase credentials',
            debug: {
                urlSet: !!supabaseUrl,
                keySet: !!supabaseServiceKey
            }
        });
    }

    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Benutzername ist erforderlich' });
        }

        // Prüfe ob der Benutzer existiert
        const { data: existingUser, error: checkError } = await supabase
            .from('admin_users')
            .select('id, username')
            .eq('username', username)
            .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('Error checking existing user:', checkError);
            return res.status(500).json({ 
                error: 'Database error',
                details: 'Failed to check user existence'
            });
        }

        if (!existingUser) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        // Lösche eventuell bestehende Reset-Requests für diesen Benutzer
        await supabase
            .from('password_reset_requests')
            .delete()
            .eq('username', username);

        // Erstelle neuen Reset-Request
        const { data: resetRequest, error: createError } = await supabase
            .from('password_reset_requests')
            .insert({
                username: username,
                status: 'pending',
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 Minuten
            })
            .select()
            .single();

        if (createError) {
            console.error('Reset request creation error:', createError);
            return res.status(500).json({ error: 'Fehler beim Erstellen der Reset-Anfrage' });
        }

        return res.status(200).json({
            success: true,
            message: 'Reset-Anfrage erfolgreich erstellt',
            requestId: resetRequest.id,
            expiresAt: resetRequest.expires_at
        });

    } catch (error) {
        console.error('Reset request error:', error);
        return res.status(500).json({ error: 'Interner Serverfehler' });
    }
}
