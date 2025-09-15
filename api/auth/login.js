// api/auth/login.js - Website Login API
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Benutzername und Passwort sind erforderlich' });
        }

        // Prüfe Website-Benutzer
        const { data: user, error: userError } = await supabase
            .from('website_users')
            .select('*')
            .eq('username', username)
            .eq('is_active', true)
            .single();

        if (userError || !user) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }

        // Einfache Passwort-Überprüfung (in Produktion bcrypt verwenden)
        if (user.password_hash !== password) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }

        // Generiere Session-Token
        const sessionToken = require('crypto').randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Stunden

        // Speichere Session
        const { error: sessionError } = await supabase
            .from('website_sessions')
            .insert({
                user_id: user.id,
                session_token: sessionToken,
                expires_at: expiresAt.toISOString(),
                ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                user_agent: req.headers['user-agent']
            });

        if (sessionError) {
            console.error('Session creation error:', sessionError);
            return res.status(500).json({ error: 'Fehler beim Erstellen der Session' });
        }

        // Aktualisiere letztes Login
        await supabase
            .from('website_users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);

        // Setze HTTP-Only Cookie
        res.setHeader('Set-Cookie', [
            `session_token=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`
        ]);

        return res.status(200).json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                admin_user_id: user.admin_user_id
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Interner Serverfehler' });
    }
}
