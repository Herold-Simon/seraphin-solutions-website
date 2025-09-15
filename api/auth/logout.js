// api/auth/logout.js - Website Logout API
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const sessionToken = req.cookies.session_token;

        if (sessionToken) {
            // Lösche Session aus Datenbank
            await supabase
                .from('website_sessions')
                .delete()
                .eq('session_token', sessionToken);
        }

        // Lösche Cookie
        res.setHeader('Set-Cookie', [
            'session_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/'
        ]);

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ error: 'Interner Serverfehler' });
    }
}
