// api/accounts/create.js - Account-Erstellung aus App
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Benutzername und Passwort sind erforderlich' });
        }

        // Prüfe ob Benutzername bereits existiert
        const { data: existingUser } = await supabase
            .from('admin_users')
            .select('id')
            .eq('username', username)
            .single();

        if (existingUser) {
            return res.status(409).json({ error: 'Benutzername bereits vergeben' });
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
