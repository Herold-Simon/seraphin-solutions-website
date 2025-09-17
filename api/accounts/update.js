// api/accounts/update.js - Account-Daten aktualisieren
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

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

module.exports = async function handler(req, res) {
    // CORS-Header für alle Anfragen setzen
    setCorsHeaders(res);
    
    // OPTIONS-Anfrage für Preflight behandeln
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'PUT') {
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
        // Hole Session-Token aus Cookie
        const sessionToken = req.headers.cookie
            ?.split(';')
            .find(c => c.trim().startsWith('session_token='))
            ?.split('=')[1];

        if (!sessionToken) {
            return res.status(401).json({ error: 'Keine gültige Session gefunden' });
        }

        // Validiere Session
        const { data: session, error: sessionError } = await supabase
            .from('website_sessions')
            .select('*, website_users!inner(*)')
            .eq('session_token', sessionToken)
            .eq('expires_at', new Date().toISOString(), { operator: 'gt' })
            .single();

        if (sessionError || !session) {
            return res.status(401).json({ error: 'Ungültige oder abgelaufene Session' });
        }

        const websiteUser = session.website_users;
        const adminUserId = websiteUser.admin_user_id;

        if (!adminUserId) {
            return res.status(400).json({ error: 'Keine Admin-User-ID gefunden' });
        }

        const { username, currentPassword, newPassword } = req.body;

        // Hole aktuellen Admin-User
        const { data: adminUser, error: adminError } = await supabase
            .from('admin_users')
            .select('*')
            .eq('id', adminUserId)
            .single();

        if (adminError || !adminUser) {
            return res.status(404).json({ error: 'Admin-User nicht gefunden' });
        }

        // Username ändern
        if (username) {
            if (username === adminUser.username) {
                return res.status(400).json({ error: 'Der neue Benutzername muss sich vom aktuellen unterscheiden' });
            }

            // Prüfe ob Username bereits existiert
            const { data: existingUser } = await supabase
                .from('admin_users')
                .select('id')
                .eq('username', username)
                .neq('id', adminUserId)
                .single();

            if (existingUser) {
                return res.status(409).json({ error: 'Benutzername bereits vergeben' });
            }

            // Aktualisiere Admin-User
            const { error: adminUpdateError } = await supabase
                .from('admin_users')
                .update({ 
                    username: username,
                    full_name: username
                })
                .eq('id', adminUserId);

            if (adminUpdateError) {
                console.error('Admin user update error:', adminUpdateError);
                return res.status(500).json({ error: 'Fehler beim Aktualisieren des Admin-Users' });
            }

            // Aktualisiere Website-User
            const { error: websiteUpdateError } = await supabase
                .from('website_users')
                .update({ 
                    username: username,
                    full_name: username
                })
                .eq('admin_user_id', adminUserId);

            if (websiteUpdateError) {
                console.error('Website user update error:', websiteUpdateError);
                return res.status(500).json({ error: 'Fehler beim Aktualisieren des Website-Users' });
            }

            console.log('✅ Username erfolgreich geändert für Admin-User-ID:', adminUserId);

            return res.status(200).json({
                success: true,
                message: 'Benutzername erfolgreich geändert',
                username: username
            });
        }

        // Passwort ändern
        if (currentPassword && newPassword) {
            // Validiere aktuelles Passwort
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, adminUser.password_hash);
            
            if (!isCurrentPasswordValid) {
                return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });
            }

            // Validiere neues Passwort
            if (!validatePassword(newPassword)) {
                return res.status(400).json({ 
                    error: 'Passwort erfüllt nicht alle Anforderungen',
                    requirements: [
                        'Mindestens 8 Zeichen lang',
                        'Mindestens einen Großbuchstaben',
                        'Mindestens einen Kleinbuchstaben',
                        'Mindestens eine Zahl'
                    ]
                });
            }

            // Hash neues Passwort
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);

            // Aktualisiere Admin-User
            const { error: adminUpdateError } = await supabase
                .from('admin_users')
                .update({ password_hash: hashedNewPassword })
                .eq('id', adminUserId);

            if (adminUpdateError) {
                console.error('Admin user password update error:', adminUpdateError);
                return res.status(500).json({ error: 'Fehler beim Aktualisieren des Passworts' });
            }

            // Aktualisiere Website-User (falls Passwort dort gespeichert ist)
            const { error: websiteUpdateError } = await supabase
                .from('website_users')
                .update({ password_hash: hashedNewPassword })
                .eq('admin_user_id', adminUserId);

            if (websiteUpdateError) {
                console.error('Website user password update error:', websiteUpdateError);
                // Nicht kritisch, da Admin-User bereits aktualisiert wurde
            }

            console.log('✅ Passwort erfolgreich geändert für Admin-User-ID:', adminUserId);

            return res.status(200).json({
                success: true,
                message: 'Passwort erfolgreich geändert'
            });
        }

        return res.status(400).json({ error: 'Keine gültigen Daten zum Aktualisieren bereitgestellt' });

    } catch (error) {
        console.error('Account update error:', error);
        return res.status(500).json({ error: 'Interner Serverfehler' });
    }
};

// Passwort validieren
function validatePassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);

    return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers;
}
