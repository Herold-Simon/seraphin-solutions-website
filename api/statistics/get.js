// api/statistics/get.js - Statistiken für Website abrufen
const { createClient } = require('@supabase/supabase-js');
const cookie = require('cookie');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CSV-Parsing-Funktion
function parseCSVToVideoStats(csvData) {
    if (!csvData || typeof csvData !== 'string') {
        return [];
    }

    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
        return [];
    }

    const headers = lines[0].split(',');
    const videoStats = [];

    // Finde die Indizes der relevanten Spalten
    const idIndex = headers.findIndex(h => h.includes('Video ID'));
    const titleIndex = headers.findIndex(h => h.includes('Video Titel'));
    const viewsIndex = headers.findIndex(h => h.includes('Gesamtaufrufe'));
    const lastViewedIndex = headers.findIndex(h => h.includes('Letzter Aufruf'));
    const createdAtIndex = headers.findIndex(h => h.includes('Erstellt am'));
    const updatedAtIndex = headers.findIndex(h => h.includes('Geändert am'));

    // Finde alle Datumsspalten (Aufrufe am ...)
    const dateColumns = headers
        .map((header, index) => ({ header, index }))
        .filter(({ header }) => header.includes('Aufrufe am'))
        .map(({ header, index }) => ({
            date: header.replace('Aufrufe am ', ''),
            index
        }));

    // Parse jede Zeile (außer Header)
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        
        if (values.length < headers.length) continue;

        // Erstelle viewHistory-Objekt
        const viewHistory = {};
        dateColumns.forEach(({ date, index }) => {
            const views = parseInt(values[index]) || 0;
            if (views > 0) {
                viewHistory[date] = views;
            }
        });

        // Sichere Datums-Parsing-Funktion
        const parseDate = (dateString) => {
            if (!dateString || dateString.trim() === '') return null;
            try {
                const date = new Date(dateString);
                return isNaN(date.getTime()) ? null : date.toISOString();
            } catch (error) {
                console.log('Invalid date value:', dateString);
                return null;
            }
        };

        const video = {
            video_id: values[idIndex] || '',
            video_title: values[titleIndex] || 'Unbenannt',
            views: parseInt(values[viewsIndex]) || 0,
            last_viewed: parseDate(values[lastViewedIndex]),
            created_at: parseDate(values[createdAtIndex]),
            updated_at: parseDate(values[updatedAtIndex]),
            view_history: viewHistory
        };

        videoStats.push(video);
    }

    return videoStats;
}

// Hilfsfunktion zum Parsen einer CSV-Zeile (berücksichtigt Anführungszeichen)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
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
        const cookies = cookie.parse(req.headers.cookie || '');
        const sessionToken = cookies.session_token;

        if (!sessionToken) {
            return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
        }

        // Validiere Session
        const { data: session, error: sessionError } = await supabase
            .from('website_sessions')
            .select(`
                user_id,
                expires_at,
                website_users!inner(
                    id,
                    username,
                    admin_user_id
                )
            `)
            .eq('session_token', sessionToken)
            .single();

        if (sessionError || !session) {
            console.log('Statistics API - Session validation failed:', sessionError?.message || 'Session not found');
            return res.status(401).json({ success: false, error: 'Ungültige Session' });
        }

        // Überprüfe Ablaufzeit
        const now = new Date();
        const expiresAt = new Date(session.expires_at);
        
        if (now > expiresAt) {
            console.log('Statistics API - Session expired');
            return res.status(401).json({ success: false, error: 'Session abgelaufen' });
        }

        const adminUserId = session.website_users.admin_user_id;
        console.log('Statistics API - Loading data for admin_user_id:', adminUserId);

        // Hole App-Statistiken
        const { data: appStats } = await supabase
            .from('app_statistics')
            .select('*')
            .eq('admin_user_id', adminUserId)
            .order('date', { ascending: false })
            .limit(30);

        // Hole Video-Statistiken aus CSV-Daten (die von der App erstellt wurden)
        const { data: csvData } = await supabase
            .from('csv_statistics')
            .select('*')
            .eq('admin_user_id', adminUserId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        console.log('📊 CSV Data found:', !!csvData);

        // Parse CSV-Daten zu Video-Statistiken
        let videoStats = [];
        if (csvData && csvData.csv_data) {
            videoStats = parseCSVToVideoStats(csvData.csv_data);
            console.log('📊 Parsed Video Stats from CSV:', videoStats.length, 'videos');
        } else {
            // Fallback: Hole Video-Statistiken aus Datenbank
            const { data: dbVideoStats } = await supabase
                .from('video_statistics')
                .select('*')
                .eq('admin_user_id', adminUserId)
                .order('views', { ascending: false });
            
            videoStats = dbVideoStats || [];
            console.log('📊 Fallback: Video Stats from DB:', videoStats.length, 'videos');
        }

        // Hole Floor-Statistiken
        const { data: floorStats } = await supabase
            .from('floor_statistics')
            .select('*')
            .eq('admin_user_id', adminUserId);

        // Berechne Gesamtstatistiken
        const totalStats = {
            total_videos: videoStats?.length || 0,
            videos_with_views: videoStats?.filter(video => (video.views || 0) > 0).length || 0,
            total_views: videoStats?.reduce((sum, video) => sum + (video.views || 0), 0) || 0,
            total_floors: floorStats?.length || 0,
            total_rooms: floorStats?.reduce((sum, floor) => sum + (floor.room_count || 0), 0) || 0
        };

        // Hole aktuelle Statistiken
        const currentStats = appStats?.[0] || totalStats;

        // Strukturiere Video-Daten für das Dashboard
        const structuredVideos = (videoStats || []).map(video => ({
            id: video.video_id || '',
            title: video.video_title || 'Unbenanntes Video',
            views: parseInt(video.views) || 0,
            lastViewed: video.last_viewed || null,
            createdAt: video.created_at || null,
            updatedAt: video.updated_at || null,
            viewHistory: video.view_history || {}
        }));

        console.log('📊 Structured Videos:', structuredVideos.length, 'videos');
        console.log('📊 Total Stats:', totalStats);
        console.log('📊 Current Stats:', currentStats);

        // Prüfe ob überhaupt Daten vorhanden sind
        const hasAnyData = structuredVideos.length > 0 || 
                          (floorStats && floorStats.length > 0) || 
                          (appStats && appStats.length > 0) ||
                          Object.values(totalStats).some(val => val > 0);

        if (!hasAnyData) {
            console.log('📊 Keine Daten vorhanden, sende leere Statistiken');
        }

        return res.status(200).json({
            success: true,
            statistics: {
                current: currentStats,
                total: totalStats,
                videos: structuredVideos,
                floors: floorStats || [],
                history: appStats || []
            }
        });

    } catch (error) {
        console.error('Statistics fetch error:', error);
        return res.status(500).json({ success: false, error: 'Interner Serverfehler: ' + error.message });
    }
}
