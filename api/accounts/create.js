// api/accounts/create.js - Account-Erstellung aus App
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
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Benutzername und Passwort sind erforderlich' });
        }

        // Prüfe ob bereits ein Account existiert (nur ein Account erlaubt)
        const { data: existingUsers, error: checkError } = await supabase
            .from('admin_users')
            .select('id, username');

        if (checkError) {
            console.error('Error checking existing users:', checkError);
            return res.status(500).json({ 
                error: 'Database error',
                details: 'Failed to check existing accounts'
            });
        }

        if (existingUsers && existingUsers.length > 0) {
            return res.status(409).json({ error: 'Es kann nur ein Account erstellt werden. Bitte löschen Sie den bestehenden Account, um einen neuen zu erstellen.' });
        }

        // Hash das Passwort
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Erstelle Admin-Benutzer (Trigger erstellt automatisch Website-Benutzer)
        const { data: adminUser, error: adminError } = await supabase
            .from('admin_users')
            .insert({
                username,
                password_hash: hashedPassword,
                full_name: username
            })
            .select()
            .single();

        if (adminError) {
            console.error('Admin user creation error:', adminError);
            return res.status(500).json({ error: 'Fehler beim Erstellen des Accounts' });
        }

        // Hole den erstellten Website-Benutzer
        const { data: websiteUser } = await supabase
            .from('website_users')
            .select('id, username')
            .eq('admin_user_id', adminUser.id)
            .single();

        return res.status(201).json({
            success: true,
            message: 'Account erfolgreich erstellt',
            admin_user_id: adminUser.id,
            website_user_id: websiteUser.id,
            username: username
        });

    } catch (error) {
        console.error('Account creation error:', error);
        return res.status(500).json({ error: 'Interner Serverfehler' });
    }
}
