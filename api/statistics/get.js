// api/statistics/get.js - Statistiken fuer das Dashboard (aggregiert oder pro Geraet)
// Liefert die gleiche Struktur wie bisher, damit das Dashboard-UI unveraendert bleibt.
// Geraeteuebergreifende Zusammenfuehrung gleicher Routentitel erfolgt clientseitig
// (mergeVideosByTitle); hier liefern wir die Roh-Zeilen je Geraet.
const { supabase, setCors, send, resolveSession } = require('../_lib/db');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return send(res, 405, { success: false, error: 'Method not allowed' });

  try {
    const ctx = await resolveSession(req);
    if (!ctx) {
      return send(res, 401, { success: false, error: 'Nicht authentifiziert' });
    }

    const accountId = ctx.effectiveAccountId;
    const deviceId = req.query.device_id;
    const singleDevice = deviceId && deviceId !== 'all';

    // Route-Statistiken laden
    let routeQuery = supabase
      .from('route_stats')
      .select('route_id, device_id, title, views, last_viewed, view_history, view_history_hourly')
      .eq('account_id', accountId);
    if (singleDevice) {
      routeQuery = routeQuery.eq('device_id', String(deviceId));
    }
    const { data: routeRows, error: routeError } = await routeQuery;
    if (routeError) {
      return send(res, 500, { success: false, error: 'Fehler beim Laden der Statistiken' });
    }

    // Geraete (fuer Stockwerk-/Raum-Karten)
    let deviceQuery = supabase
      .from('devices')
      .select('device_id, floors')
      .eq('account_id', accountId);
    if (singleDevice) {
      deviceQuery = deviceQuery.eq('device_id', String(deviceId));
    }
    const { data: deviceRows } = await deviceQuery;

    const videos = (routeRows || []).map(r => ({
      id: r.route_id,
      title: r.title || 'Unbenannt',
      views: r.views || 0,
      last_viewed: r.last_viewed,
      view_history: r.view_history || {},
      view_history_hourly: r.view_history_hourly || {},
      device_id: r.device_id
    }));

    // Stockwerke zusammenfuehren
    let floors = [];
    (deviceRows || []).forEach(d => {
      if (Array.isArray(d.floors)) {
        d.floors.forEach(f => {
          floors.push({
            id: f.id,
            name: f.name,
            room_count: f.room_count || 0,
            device_id: d.device_id
          });
        });
      }
    });

    // Aggregierte Werte berechnen
    const viewsByDate = {};
    let totalViews = 0;
    const titlesWithViews = new Set();
    videos.forEach(v => {
      totalViews += v.views || 0;
      if ((v.views || 0) > 0) titlesWithViews.add(v.title);
      const hist = v.view_history || {};
      Object.keys(hist).forEach(date => {
        const c = parseInt(hist[date], 10) || 0;
        viewsByDate[date] = (viewsByDate[date] || 0) + c;
      });
    });

    const history = Object.keys(viewsByDate)
      .sort()
      .map(date => ({ date, total_views: viewsByDate[date] }));

    const chartCount = Math.max(3, titlesWithViews.size);
    const totalRooms = floors.reduce((s, f) => s + (f.room_count || 0), 0);

    const sortedDates = history.map(h => h.date).sort();
    const current = {
      total_videos: videos.length,
      videos_with_views: titlesWithViews.size,
      total_views: totalViews,
      total_floors: floors.length,
      total_rooms: totalRooms,
      pie_chart_video_count: chartCount,
      line_chart_video_count: chartCount,
      bar_chart_video_count: chartCount,
      line_race_video_count: chartCount,
      time_range_start: sortedDates.length ? sortedDates[0] : null,
      time_range_end: sortedDates.length ? sortedDates[sortedDates.length - 1] : null
    };

    return send(res, 200, {
      success: true,
      statistics: {
        current,
        total: current,
        videos,
        floors,
        history,
        device_id: singleDevice ? String(deviceId) : 'all'
      }
    });
  } catch (error) {
    console.error('Statistics get error:', error.message);
    return send(res, 500, { success: false, error: 'Interner Serverfehler' });
  }
};
