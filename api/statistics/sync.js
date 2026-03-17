// api/statistics/sync.js - Statistiken-Synchronisation aus App
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Throttle: Max. 1 echter Sync pro Gerät alle 5 Minuten (reduziert Supabase-Requests massiv)
const SYNC_THROTTLE_MS = 5 * 60 * 1000;
const lastSyncByKey = new Map();

function getSyncKey(adminUserId, deviceId) {
    return `sync:${adminUserId}:${deviceId || 'all'}`;
}

function shouldThrottle(adminUserId, deviceId) {
    const key = getSyncKey(adminUserId, deviceId);
    const last = lastSyncByKey.get(key);
    if (!last) return false;
    return (Date.now() - last) < SYNC_THROTTLE_MS;
}

function markSynced(adminUserId, deviceId) {
    lastSyncByKey.set(getSyncKey(adminUserId, deviceId), Date.now());
}

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
}

function convertTimestamp(timestamp) {
    if (!timestamp) return null;
    if (typeof timestamp === 'number' && timestamp > 1000000000000) {
        return new Date(timestamp).toISOString();
    } else if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? null : date.toISOString();
    }
    return null;
}

/**
 * Effizientes Bulk-Sync ohne UNIQUE-Constraints:
 * 1 Query zum Laden existierender IDs → 1 Batch-Insert für neue → parallele Updates für bestehende.
 *
 * @param {string} table        - Tabellenname
 * @param {Array}  rows         - Zeilen (müssen admin_user_id und rowKey enthalten)
 * @param {string} rowKey       - Eindeutige Spalte innerhalb eines Nutzers (z.B. 'video_id')
 * @param {Object} extraFilters - Zusätzliche Filter beim Lookup (z.B. { device_id: '...' })
 */
async function bulkSyncTable(table, rows, rowKey, extraFilters = {}) {
    if (!rows || rows.length === 0) return;

    const adminUserId = rows[0].admin_user_id;
    const keyValues = rows.map(r => r[rowKey]);

    // Schritt 1: Alle passenden existierenden Datensätze in EINER Query laden
    let fetchQuery = supabase
        .from(table)
        .select(`id, ${rowKey}`)
        .eq('admin_user_id', adminUserId)
        .in(rowKey, keyValues);

    for (const [col, val] of Object.entries(extraFilters)) {
        fetchQuery = fetchQuery.eq(col, val);
    }

    const { data: existing, error: fetchError } = await fetchQuery;

    if (fetchError) {
        console.error(`${table} fetch error:`, fetchError.message);
        return;
    }

    const existingMap = new Map((existing || []).map(r => [r[rowKey], r.id]));

    const toInsert = [];
    const updatePromises = [];

    for (const row of rows) {
        const existingId = existingMap.get(row[rowKey]);
        if (existingId) {
            updatePromises.push(
                supabase.from(table).update(row).eq('id', existingId)
            );
        } else {
            toInsert.push(row);
        }
    }

    // Schritt 2: Neue Zeilen als Batch einfügen (1 Query)
    if (toInsert.length > 0) {
        const { error } = await supabase.from(table).insert(toInsert);
        if (error) console.error(`${table} insert error:`, error.message);
    }

    // Schritt 3: Bestehende Zeilen parallel aktualisieren
    if (updatePromises.length > 0) {
        const results = await Promise.all(updatePromises);
        results.forEach(({ error }) => {
            if (error) console.error(`${table} update error:`, error.message);
        });
    }
}

/**
 * Sync einer einzelnen Zeile (z.B. app_statistics, device_statistics).
 * Nutzt .limit(1) statt .single() um bei Duplikaten nicht zu scheitern.
 */
async function syncSingleRow(table, data, matchConditions) {
    let query = supabase.from(table).select('id');
    for (const [col, val] of Object.entries(matchConditions)) {
        query = query.eq(col, val);
    }
    // .limit(1) statt .single() – funktioniert auch wenn Duplikate existieren
    const { data: rows } = await query.limit(1);
    const existing = rows?.[0] || null;

    if (existing) {
        const { error } = await supabase.from(table).update(data).eq('id', existing.id);
        if (error) console.error(`${table} update error:`, error.message);
    } else {
        const { error } = await supabase.from(table).insert(data);
        if (error) console.error(`${table} insert error:`, error.message);
    }
}

module.exports = async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { admin_user_id, statistics, device_id } = req.body;

        if (!admin_user_id || !statistics) {
            return res.status(400).json({ success: false, error: 'Admin-Benutzer-ID und Statistiken sind erforderlich' });
        }

        // Throttle: Wenn kürzlich synchronisiert, sofort 200 zurück – keine Supabase-Requests
        if (shouldThrottle(admin_user_id, device_id)) {
            return res.status(200).json({
                success: true,
                skipped: true,
                message: 'Sync übersprungen (Throttle: max. alle 5 Min)'
            });
        }

        // Admin-Benutzer prüfen
        const { data: adminUser } = await supabase
            .from('admin_users')
            .select('id')
            .eq('id', admin_user_id)
            .single();

        if (!adminUser) {
            return res.status(404).json({ error: 'Admin-Benutzer nicht gefunden' });
        }

        // Geräte-Session aktualisieren
        if (device_id) {
            const { error: sessionError } = await supabase
                .rpc('update_device_activity', {
                    p_admin_user_id: admin_user_id,
                    p_device_id: device_id,
                    p_device_name: `Device ${device_id.substring(0, 8)}`
                });
            if (sessionError) console.error('Device session update error:', sessionError.message);
        }

        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();

        const statsBase = {
            admin_user_id,
            date: today,
            total_videos: statistics.total_videos || 0,
            videos_with_views: statistics.videos_with_views || 0,
            total_views: statistics.total_views || 0,
            total_floors: statistics.total_floors || 0,
            total_rooms: statistics.total_rooms || 0,
            pie_chart_video_count: statistics.pie_chart_video_count || 0,
            line_chart_video_count: statistics.line_chart_video_count || 0,
            bar_chart_video_count: statistics.bar_chart_video_count || 0,
            line_race_video_count: statistics.line_race_video_count || 0,
            time_range_start: statistics.time_range_start,
            time_range_end: statistics.time_range_end,
            updated_at: now
        };

        // App- und Geräte-Statistiken parallel synchronisieren
        const syncPromises = [
            syncSingleRow('app_statistics', statsBase, { admin_user_id, date: today })
        ];
        if (device_id) {
            syncPromises.push(
                syncSingleRow('device_statistics', { ...statsBase, device_id }, { admin_user_id, device_id, date: today })
            );
        }
        await Promise.all(syncPromises);

        // Video-Statistiken synchronisieren
        if (statistics.videos && Array.isArray(statistics.videos) && statistics.videos.length > 0) {
            const videoRows = statistics.videos.map(video => {
                const row = {
                    admin_user_id,
                    video_id: video.id,
                    video_title: video.title,
                    views: video.views || 0,
                    last_viewed: convertTimestamp(video.lastViewed),
                    updated_at: convertTimestamp(video.updatedAt) || now
                };
                if (video.createdAt) row.created_at = convertTimestamp(video.createdAt);
                if (video.viewHistory) row.view_history = video.viewHistory;
                return row;
            });

            // video_statistics und device_video_statistics parallel synchronisieren
            const videoSyncPromises = [
                bulkSyncTable('video_statistics', videoRows, 'video_id')
            ];
            if (device_id) {
                const deviceVideoRows = videoRows.map(row => ({ ...row, device_id }));
                videoSyncPromises.push(
                    bulkSyncTable('device_video_statistics', deviceVideoRows, 'video_id', { device_id })
                );
            }
            await Promise.all(videoSyncPromises);
        }

        // Floor-Statistiken synchronisieren
        if (statistics.floors && Array.isArray(statistics.floors) && statistics.floors.length > 0) {
            const floorRows = statistics.floors.map(floor => ({
                admin_user_id,
                floor_id: floor.id,
                floor_name: floor.name,
                room_count: floor.objectVideoMappings?.length || 0
            }));
            await bulkSyncTable('floor_statistics', floorRows, 'floor_id');
        }

        markSynced(admin_user_id, device_id);

        return res.status(200).json({
            success: true,
            message: 'Statistiken erfolgreich synchronisiert'
        });

    } catch (error) {
        console.error('Statistics sync error:', error.message);
        return res.status(500).json({ success: false, error: 'Interner Serverfehler' });
    }
}
