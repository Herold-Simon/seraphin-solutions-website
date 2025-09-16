// api/statistics/csv.js - CSV-Statistiken abrufen
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CSV-Generierungsfunktion für Website-API
function generateCSVFromVideoStats(videoStats) {
    if (!videoStats || videoStats.length === 0) {
        return 'Video ID,Video Titel,Gesamtaufrufe,Letzter Aufruf,Erstellt am,Geändert am\n';
    }

    // CSV-Header
    const headers = [
        'Video ID',
        'Video Titel', 
        'Gesamtaufrufe',
        'Letzter Aufruf',
        'Erstellt am',
        'Geändert am'
    ];

    // Erstelle einen erweiterten Zeitraum für die CSV
    const extendedDateRange = createExtendedDateRange(videoStats);
    
    // Füge Datumsspalten zum Header hinzu
    extendedDateRange.forEach(date => {
        headers.push(`Aufrufe am ${date}`);
    });

    // CSV-Zeilen generieren
    const csvRows = [headers.join(',')];

    videoStats.forEach(video => {
        const row = [
            escapeCSVField(video.video_id || ''),
            escapeCSVField(video.video_title || 'Unbenannt'),
            video.views || 0,
            video.last_viewed ? new Date(video.last_viewed).toLocaleDateString('de-DE') : '',
            video.created_at ? new Date(video.created_at).toLocaleDateString('de-DE') : '',
            video.updated_at ? new Date(video.updated_at).toLocaleDateString('de-DE') : ''
        ];

        // Füge Aufrufe für jeden Tag hinzu
        extendedDateRange.forEach(date => {
            const dailyViews = video.view_history?.[date] || 0;
            row.push(dailyViews);
        });

        csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
}

// Erstellt einen erweiterten Zeitraum für die CSV-Generierung
function createExtendedDateRange(videoStats) {
    const allDates = new Set();
    const today = new Date();
    
    // Sammle alle historischen Daten aus den Videos
    videoStats.forEach(video => {
        if (video.view_history) {
            Object.keys(video.view_history).forEach(date => {
                allDates.add(date);
            });
        }
    });

    // Füge die letzten 30 Tage hinzu (auch wenn keine Daten vorhanden sind)
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        allDates.add(dateString);
    }

    // Füge die nächsten 7 Tage hinzu (für zukünftige Planung)
    for (let i = 1; i <= 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        allDates.add(dateString);
    }

    // Sortiere alle Daten chronologisch
    return Array.from(allDates).sort();
}

// Escaped CSV-Felder für korrekte Formatierung
function escapeCSVField(field) {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
}

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

        // Wenn keine CSV-Daten vorhanden sind, generiere eine neue CSV aus den aktuellen Statistiken
        if (!csvData) {
            console.log('📊 Keine CSV-Daten gefunden, generiere neue CSV aus aktuellen Statistiken...');
            
            // Hole aktuelle Video-Statistiken
            const { data: videoStats, error: videoError } = await supabase
                .from('video_statistics')
                .select('*')
                .eq('admin_user_id', admin_user_id);

            if (videoError) {
                console.error('❌ Video statistics fetch error:', videoError);
                return res.status(500).json({ success: false, error: 'Fehler beim Abrufen der Video-Statistiken' });
            }

            if (!videoStats || videoStats.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Keine Video-Statistiken für diesen Benutzer gefunden' 
                });
            }

            // Generiere CSV aus aktuellen Daten
            const generatedCSV = generateCSVFromVideoStats(videoStats);
            const csvFileName = `video_statistics_${admin_user_id}_${new Date().toISOString().split('T')[0]}.csv`;

            // Setze Content-Type für CSV-Download
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${csvFileName}"`);

            return res.status(200).send(generatedCSV);
        }

        // Prüfe, ob die CSV-Datei aktuell ist (nicht älter als 1 Tag)
        const csvDate = new Date(csvData.updated_at);
        const today = new Date();
        const daysDiff = (today - csvDate) / (1000 * 60 * 60 * 24);

        if (daysDiff > 1) {
            console.log('📊 CSV-Datei ist veraltet, generiere neue CSV...');
            
            // Hole aktuelle Video-Statistiken
            const { data: videoStats, error: videoError } = await supabase
                .from('video_statistics')
                .select('*')
                .eq('admin_user_id', admin_user_id);

            if (!videoError && videoStats && videoStats.length > 0) {
                // Generiere neue CSV
                const generatedCSV = generateCSVFromVideoStats(videoStats);
                const csvFileName = `video_statistics_${admin_user_id}_${new Date().toISOString().split('T')[0]}.csv`;

                // Speichere neue CSV in der Datenbank
                await supabase
                    .from('csv_statistics')
                    .upsert({
                        admin_user_id,
                        filename: csvFileName,
                        csv_data: generatedCSV,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'admin_user_id,filename'
                    });

                // Setze Content-Type für CSV-Download
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${csvFileName}"`);

                return res.status(200).send(generatedCSV);
            }
        }

        // Verwende vorhandene CSV-Daten
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${csvData.filename}"`);

        return res.status(200).send(csvData.csv_data);

    } catch (error) {
        console.error('❌ CSV statistics error:', error);
        return res.status(500).json({ success: false, error: 'Interner Serverfehler: ' + error.message });
    }
};
