// api/test-login.js - Simple test API for login debugging
module.exports = async function handler(req, res) {
    // CORS-Header setzen
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // OPTIONS-Anfrage für Preflight behandeln
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Use POST with {"username": "...", "password": "..."}' });
    }

    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Benutzername und Passwort sind erforderlich' });
        }

        // Simuliere erfolgreichen Login für Test
        return res.status(200).json({
            success: true,
            message: 'Test-Login erfolgreich',
            user: {
                id: 'test-user-id',
                username: username,
                admin_user_id: 'test-admin-id'
            }
        });

    } catch (error) {
        console.error('Test Login error:', error);
        return res.status(500).json({ error: 'Interner Serverfehler beim Test-Login', details: error.message });
    }
};
