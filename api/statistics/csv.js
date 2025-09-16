// api/statistics/csv.js - CSV-Statistiken abrufen
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
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('📊 CSV statistics request received');
        
        const { admin_user_id } = req.query;

        if (!admin_user_id) {
            console.log('❌ Missing admin_user_id');
            return res.status(400).json({ success: false, error: 'Admin-Benutzer-ID ist erforderlich' });
        }

        // Prüfe ob Admin-Benutzer existiert
        const { data: adminUser } = await supabase
            .from('admin_users')
            .select('id')
            .eq('id', admin_user_id)
            .single();

        if (!adminUser) {
            return res.status(404).json({ error: 'Admin-Benutzer nicht gefunden' });
        }

        // Hole die neueste CSV-Datei für diesen Admin-Benutzer
        const { data: csvData, error: csvError } = await supabase
            .from('csv_statistics')
            .select('*')
            .eq('admin_user_id', admin_user_id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (csvError && csvError.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('❌ CSV fetch error:', csvError);
            return res.status(500).json({ success: false, error: 'Fehler beim Abrufen der CSV-Daten' });
        }

        if (!csvData) {
            return res.status(404).json({ 
                success: false, 
                error: 'Keine CSV-Daten für diesen Benutzer gefunden' 
            });
        }

        // Setze Content-Type für CSV-Download
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${csvData.filename}"`);

        return res.status(200).send(csvData.csv_data);

    } catch (error) {
        console.error('❌ CSV statistics error:', error);
        return res.status(500).json({ success: false, error: 'Interner Serverfehler: ' + error.message });
    }
};
