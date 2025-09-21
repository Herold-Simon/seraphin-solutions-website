// api/auth/logout.js - Website Logout API
import cookie from 'cookie';

// CORS-Header setzen
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
    // CORS-Header für alle Anfragen setzen
    setCorsHeaders(res);
    
    // OPTIONS-Anfrage für Preflight behandeln
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Lösche Cookie
        res.setHeader('Set-Cookie', cookie.serialize('session_token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            expires: new Date(0), // Expire immediately
            path: '/',
        }));

        return res.status(200).json({ success: true, message: 'Logout erfolgreich' });

    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ error: 'Interner Serverfehler' });
    }
}
