// api/auth/reset-password.js - Passwort-Reset ohne aktuelles Passwort
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

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
        const { username, newPassword } = req.body;

        if (!username || !newPassword) {
            return res.status(400).json({ error: 'Benutzername und neues Passwort sind erforderlich' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Das Passwort muss mindestens 6 Zeichen lang sein' });
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

        // Hash das neue Passwort
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Aktualisiere das Passwort
        const { data: updatedUser, error: updateError } = await supabase
            .from('admin_users')
            .update({
                password_hash: hashedPassword,
                updated_at: new Date().toISOString()
            })
            .eq('id', existingUser.id)
            .select('id, username')
            .single();

        if (updateError) {
            console.error('Password update error:', updateError);
            return res.status(500).json({ error: 'Fehler beim Aktualisieren des Passworts' });
        }

        // Aktualisiere auch das Website-Benutzer-Passwort (falls vorhanden)
        const { error: websiteUpdateError } = await supabase
            .from('website_users')
            .update({
                password_hash: hashedPassword,
                updated_at: new Date().toISOString()
            })
            .eq('admin_user_id', existingUser.id);

        if (websiteUpdateError) {
            console.error('Website user password update error:', websiteUpdateError);
            // Nicht kritisch, da der Admin-User bereits aktualisiert wurde
        }

        return res.status(200).json({
            success: true,
            message: 'Passwort erfolgreich zurückgesetzt',
            user: {
                id: updatedUser.id,
                username: updatedUser.username
            }
        });

    } catch (error) {
        console.error('Password reset error:', error);
        return res.status(500).json({ error: 'Interner Serverfehler' });
    }
}
