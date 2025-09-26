// api/statistics/sync.js - Statistiken-Synchronisation aus App
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
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('🔄 Statistics sync request received');
        
        const {
            admin_user_id,
            statistics,
            csv_data,
            device_id
        } = req.body;

        console.log('📊 Sync data:', { admin_user_id, statisticsKeys: Object.keys(statistics || {}) });

        if (!admin_user_id || !statistics) {
            console.log('❌ Missing required fields:', { admin_user_id: !!admin_user_id, statistics: !!statistics });
            return res.status(400).json({ success: false, error: 'Admin-Benutzer-ID und Statistiken sind erforderlich' });
        }

        // Prüfe ob Admin-Benutzer existiert und aktualisiere Geräte-ID
        const { data: adminUser } = await supabase
            .from('admin_users')
            .select('id')
            .eq('id', admin_user_id)
            .single();

        if (!adminUser) {
            return res.status(404).json({ error: 'Admin-Benutzer nicht gefunden' });
        }

        // Aktualisiere Geräte-ID und Geräte-Session falls vorhanden
        if (device_id) {
            console.log('📱 Updating device ID and session for admin user:', admin_user_id, 'device:', device_id);
            
            // 1. Aktualisiere device_id in admin_users
            const { error: deviceUpdateError } = await supabase
                .from('admin_users')
                .update({ device_id: device_id })
                .eq('id', admin_user_id);

            if (deviceUpdateError) {
                console.error('❌ Error updating device ID:', deviceUpdateError);
            } else {
                console.log('✅ Device ID updated successfully');
            }
            
            // 2. Aktualisiere oder erstelle Geräte-Session (dauerhaft speichern)
            console.log('📱 Updating device session for persistent storage...');
            const { data: sessionData, error: sessionError } = await supabase
                .rpc('update_device_activity', {
                    p_admin_user_id: admin_user_id,
                    p_device_id: device_id,
                    p_device_name: `Device ${device_id.substring(0, 8)}`
                });

            if (sessionError) {
                console.error('❌ Error updating device session:', sessionError);
                // Nicht kritisch, weiter mit Synchronisierung
            } else {
                console.log('✅ Device session updated successfully for persistent storage');
            }
        }

        // Synchronisiere App-Statistiken
        const today = new Date().toISOString().split('T')[0];
        
        // Erst prüfen, ob bereits ein Eintrag für heute existiert
        const { data: existingStats } = await supabase
            .from('app_statistics')
            .select('id')
            .eq('admin_user_id', admin_user_id)
            .eq('date', today)
            .single();

        // Geräte-spezifische Statistiken synchronisieren (falls device_id vorhanden)
        if (device_id) {
            console.log('📱 Syncing device-specific statistics for device:', device_id);
            
            // Prüfe, ob bereits ein Eintrag für dieses Gerät und Datum existiert
            const { data: existingDeviceStats } = await supabase
                .from('device_statistics')
                .select('id')
                .eq('admin_user_id', admin_user_id)
                .eq('device_id', device_id)
                .eq('date', today)
                .single();

            const deviceStatsData = {
                admin_user_id,
                device_id,
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
                updated_at: new Date().toISOString()
            };

            let deviceStatsError;
            if (existingDeviceStats) {
                // Update existing device record
                const { error } = await supabase
                    .from('device_statistics')
                    .update(deviceStatsData)
                    .eq('id', existingDeviceStats.id);
                deviceStatsError = error;
            } else {
                // Insert new device record
                const { error } = await supabase
                    .from('device_statistics')
                    .insert(deviceStatsData);
                deviceStatsError = error;
            }

            if (deviceStatsError) {
                console.error('❌ Device statistics sync error:', deviceStatsError);
                // Nicht kritisch, weiter mit normalen Statistiken
            } else {
                console.log('✅ Device statistics synced successfully for device:', device_id);
            }
        }

        const statsData = {
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
            updated_at: new Date().toISOString()
        };

        let appStatsError;
        if (existingStats) {
            // Update existing record
            const { error } = await supabase
                .from('app_statistics')
                .update(statsData)
                .eq('id', existingStats.id);
            appStatsError = error;
        } else {
            // Insert new record
            const { error } = await supabase
                .from('app_statistics')
                .insert(statsData);
            appStatsError = error;
        }

        if (appStatsError) {
            console.error('❌ App statistics sync error:', appStatsError);
            return res.status(500).json({ success: false, error: 'Fehler beim Synchronisieren der App-Statistiken: ' + appStatsError.message });
        }

        console.log('✅ App statistics synced successfully');

        // Synchronisiere Video-Statistiken
        console.log('📊 Video sync check:', {
            hasVideos: !!statistics.videos,
            isArray: Array.isArray(statistics.videos),
            length: statistics.videos?.length,
            videos: statistics.videos
        });

        if (statistics.videos && Array.isArray(statistics.videos)) {
            console.log('📊 Syncing videos:', statistics.videos.length, 'videos');
            
            for (const video of statistics.videos) {
                try {
                    console.log('📊 Processing video:', {
                        id: video.id,
                        title: video.title,
                        views: video.views,
                        hasViewHistory: !!video.viewHistory,
                        viewHistoryKeys: video.viewHistory ? Object.keys(video.viewHistory).length : 0
                    });

                    // Erst prüfen, ob bereits ein Eintrag existiert
                    const { data: existingVideo, error: checkError } = await supabase
                        .from('video_statistics')
                        .select('id')
                        .eq('admin_user_id', admin_user_id)
                        .eq('video_id', video.id)
                        .single();

                    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
                        console.error('❌ Error checking existing video:', checkError);
                        continue;
                    }

                    // Konvertiere Unix-Timestamps zu ISO-Strings
                    const convertTimestamp = (timestamp) => {
                        if (!timestamp) return null;
                        if (typeof timestamp === 'number' && timestamp > 1000000000000) {
                            // Unix-Timestamp in Millisekunden
                            return new Date(timestamp).toISOString();
                        } else if (typeof timestamp === 'string') {
                            // Bereits ein String, prüfe ob es ein gültiges Datum ist
                            const date = new Date(timestamp);
                            return isNaN(date.getTime()) ? null : date.toISOString();
                        }
                        return null;
                    };

                    const videoData = {
                        admin_user_id,
                        video_id: video.id,
                        video_title: video.title,
                        views: video.views || 0,
                        last_viewed: convertTimestamp(video.lastViewed),
                        created_at: convertTimestamp(video.createdAt),
                        updated_at: convertTimestamp(video.updatedAt)
                        // view_history wird erst hinzugefügt, wenn die Spalte existiert
                    };

                    // Füge view_history nur hinzu, wenn es existiert
                    if (video.viewHistory) {
                        videoData.view_history = video.viewHistory;
                    }

                    if (existingVideo) {
                        // Update existing record
                        const { error: updateError } = await supabase
                            .from('video_statistics')
                            .update(videoData)
                            .eq('id', existingVideo.id);
                        
                        if (updateError) {
                            console.error('❌ Error updating video:', updateError);
                        } else {
                            console.log('✅ Video updated:', video.id);
                        }
                    } else {
                        // Insert new record
                        const { error: insertError } = await supabase
                            .from('video_statistics')
                            .insert(videoData);
                        
                        if (insertError) {
                            console.error('❌ Error inserting video:', insertError);
                        } else {
                            console.log('✅ Video inserted:', video.id);
                        }
                    }

                    // Geräte-spezifische Video-Statistiken synchronisieren (falls device_id vorhanden)
                    if (device_id) {
                        console.log('📱 Syncing device-specific video statistics for video:', video.id, 'device:', device_id);
                        
                        // Prüfe, ob bereits ein geräte-spezifischer Eintrag existiert
                        const { data: existingDeviceVideo, error: checkDeviceError } = await supabase
                            .from('device_video_statistics')
                            .select('id')
                            .eq('admin_user_id', admin_user_id)
                            .eq('device_id', device_id)
                            .eq('video_id', video.id)
                            .single();

                        if (checkDeviceError && checkDeviceError.code !== 'PGRST116') { // PGRST116 = no rows found
                            console.error('❌ Error checking existing device video:', checkDeviceError);
                        } else {
                            const deviceVideoData = {
                                admin_user_id,
                                device_id,
                                video_id: video.id,
                                video_title: video.title,
                                views: video.views || 0,
                                last_viewed: convertTimestamp(video.lastViewed),
                                created_at: convertTimestamp(video.createdAt),
                                updated_at: convertTimestamp(video.updatedAt)
                            };

                            // Füge view_history nur hinzu, wenn es existiert
                            if (video.viewHistory) {
                                deviceVideoData.view_history = video.viewHistory;
                            }

                            if (existingDeviceVideo) {
                                // Update existing device video record
                                const { error: updateDeviceError } = await supabase
                                    .from('device_video_statistics')
                                    .update(deviceVideoData)
                                    .eq('id', existingDeviceVideo.id);
                                
                                if (updateDeviceError) {
                                    console.error('❌ Error updating device video:', updateDeviceError);
                                } else {
                                    console.log('✅ Device video updated:', video.id, 'for device:', device_id);
                                }
                            } else {
                                // Insert new device video record
                                const { error: insertDeviceError } = await supabase
                                    .from('device_video_statistics')
                                    .insert(deviceVideoData);
                                
                                if (insertDeviceError) {
                                    console.error('❌ Error inserting device video:', insertDeviceError);
                                } else {
                                    console.log('✅ Device video inserted:', video.id, 'for device:', device_id);
                                }
                            }
                        }
                    }
                } catch (videoError) {
                    console.error('❌ Video sync error for video', video.id, ':', videoError);
                }
            }
        } else {
            console.log('📊 No videos to sync or invalid format:', {
                hasVideos: !!statistics.videos,
                isArray: Array.isArray(statistics.videos),
                length: statistics.videos?.length
            });
        }

        // Synchronisiere Floor-Statistiken
        if (statistics.floors && Array.isArray(statistics.floors)) {
            for (const floor of statistics.floors) {
                // Erst prüfen, ob bereits ein Eintrag existiert
                const { data: existingFloor } = await supabase
                    .from('floor_statistics')
                    .select('id')
                    .eq('admin_user_id', admin_user_id)
                    .eq('floor_id', floor.id)
                    .single();

                const floorData = {
                    admin_user_id,
                    floor_id: floor.id,
                    floor_name: floor.name,
                    room_count: floor.objectVideoMappings?.length || 0
                };

                if (existingFloor) {
                    // Update existing record
                    await supabase
                        .from('floor_statistics')
                        .update(floorData)
                        .eq('id', existingFloor.id);
                } else {
                    // Insert new record
                    await supabase
                        .from('floor_statistics')
                        .insert(floorData);
                }
            }
        }

        // CSV-Synchronisation deaktiviert (Tabelle existiert nicht)
        console.log('📊 CSV sync disabled - table does not exist');

        return res.status(200).json({
            success: true,
            message: 'Statistiken erfolgreich synchronisiert'
        });

    } catch (error) {
        console.error('❌ Statistics sync error:', error);
        return res.status(500).json({ success: false, error: 'Interner Serverfehler: ' + error.message });
    }
}
