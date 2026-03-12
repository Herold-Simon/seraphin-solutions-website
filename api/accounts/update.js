// api/accounts/update.js - Account-Daten aktualisieren
const { createClient } = require('@supabase/supabase-js');

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

        console.log('🔍 Session-Token aus Cookie:', sessionToken ? 'Found' : 'Not found');
        console.log('🔍 Cookies:', req.headers.cookie);

        if (!sessionToken) {
            console.error('❌ No session token found in cookies');
            return res.status(401).json({ error: 'Keine gültige Session gefunden' });
        }

        // Validiere Session
        const { data: session, error: sessionError } = await supabase
            .from('website_sessions')
            .select('id, user_id, expires_at, website_users!inner(id, username, admin_user_id)')
            .eq('session_token', sessionToken)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (sessionError) {
            console.error('❌ Session validation error:', sessionError);
            return res.status(401).json({ 
                error: 'Ungültige oder abgelaufene Session',
                debug: sessionError.message 
            });
        }

        if (!session) {
            console.error('❌ No session found for token:', sessionToken);
            return res.status(401).json({ error: 'Keine Session gefunden' });
        }

        console.log('✅ Session validiert:', {
            sessionId: session.id,
            userId: session.user_id,
            expiresAt: session.expires_at
        });

        const websiteUser = session.website_users;
        const adminUserId = websiteUser.admin_user_id;

        console.log('🔍 Website User:', {
            id: websiteUser.id,
            username: websiteUser.username,
            adminUserId: adminUserId
        });

        if (!adminUserId) {
            console.error('❌ No admin_user_id found in website_user');
            return res.status(400).json({ error: 'Keine Admin-User-ID gefunden' });
        }

        const { username, currentPassword, newPassword } = req.body;

        // Hole aktuellen Admin-User
        const { data: adminUser, error: adminError } = await supabase
            .from('admin_users')
            .select('id, username, password_hash')
            .eq('id', adminUserId)
            .single();

        if (adminError || !adminUser) {
            return res.status(404).json({ error: 'Admin-User nicht gefunden' });
        }

        // Username ändern
        if (username) {
            console.log('🔍 Username-Update gestartet:', { 
                currentUsername: adminUser.username, 
                newUsername: username, 
                adminUserId: adminUserId 
            });

            if (username === adminUser.username) {
                return res.status(400).json({ error: 'Der neue Benutzername muss sich vom aktuellen unterscheiden' });
            }

            // Prüfe ob Username bereits existiert
            const { data: existingUser, error: existingUserError } = await supabase
                .from('admin_users')
                .select('id')
                .eq('username', username)
                .neq('id', adminUserId)
                .single();

            if (existingUserError && existingUserError.code !== 'PGRST116') {
                console.error('❌ Fehler beim Prüfen existierender Username:', existingUserError);
                return res.status(500).json({ error: 'Fehler beim Prüfen des Benutzernamens' });
            }

            if (existingUser) {
                return res.status(409).json({ error: 'Benutzername bereits vergeben' });
            }

            // Aktualisiere Admin-User
            console.log('🔍 Aktualisiere Admin-User...');
            const { data: updatedAdminUser, error: adminUpdateError } = await supabase
                .from('admin_users')
                .update({ 
                    username: username,
                    full_name: username
                })
                .eq('id', adminUserId)
                .select()
                .single();

            if (adminUpdateError) {
                console.error('❌ Admin user update error:', adminUpdateError);
                return res.status(500).json({ error: 'Fehler beim Aktualisieren des Admin-Users: ' + adminUpdateError.message });
            }

            console.log('✅ Admin-User aktualisiert:', updatedAdminUser);

            // Aktualisiere Website-User
            console.log('🔍 Aktualisiere Website-User...');
            const { data: updatedWebsiteUser, error: websiteUpdateError } = await supabase
                .from('website_users')
                .update({ 
                    username: username,
                    full_name: username
                })
                .eq('admin_user_id', adminUserId)
                .select()
                .single();

            if (websiteUpdateError) {
                console.error('❌ Website user update error:', websiteUpdateError);
                return res.status(500).json({ error: 'Fehler beim Aktualisieren des Website-Users: ' + websiteUpdateError.message });
            }

            console.log('✅ Website-User aktualisiert:', updatedWebsiteUser);
            console.log('✅ Username erfolgreich geändert für Admin-User-ID:', adminUserId);

            return res.status(200).json({
                success: true,
                message: 'Benutzername erfolgreich geändert',
                username: username,
                debug: {
                    adminUserId: adminUserId,
                    updatedAdminUser: updatedAdminUser,
                    updatedWebsiteUser: updatedWebsiteUser
                }
            });
        }

        // Passwort ändern
        if (currentPassword && newPassword) {
            // Validiere aktuelles Passwort (Klartext-Vergleich)
            if (currentPassword !== adminUser.password_hash) {
                return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });
            }

            // Passwort-Anforderungen wurden entfernt

            // Speichere neues Passwort als Klartext
            // Aktualisiere Admin-User
            const { error: adminUpdateError } = await supabase
                .from('admin_users')
                .update({ password_hash: newPassword })
                .eq('id', adminUserId);

            if (adminUpdateError) {
                console.error('Admin user password update error:', adminUpdateError);
                return res.status(500).json({ error: 'Fehler beim Aktualisieren des Passworts' });
            }

            // Aktualisiere Website-User (falls Passwort dort gespeichert ist)
            const { error: websiteUpdateError } = await supabase
                .from('website_users')
                .update({ password_hash: newPassword })
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

// Passwort-Validierung wurde entfernt
