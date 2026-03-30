/**
 * Aggregiert Video-Statistiken (wie Dashboard: device_video_statistics → Merge nach Titel)
 * und berechnet Aufrufe je Zeitraum aus view_history (tägliche Schlüssel YYYY-MM-DD).
 */

const videoSelectFull =
  'video_id, video_title, views, last_viewed, created_at, updated_at, view_history';

function hasMeaningfulHistory(rows) {
  return (
    rows &&
    rows.some((v) => v.view_history && Object.keys(v.view_history).length > 0)
  );
}

function mergeVideosByTitle(videos) {
  const merged = {};
  for (const video of videos) {
    const title = video.video_title || video.title || 'Unbenanntes Video';
    if (! merged[title]) {
      merged[title] = {
        title,
        views: 0,
        viewHistory: {},
      };
    }
    merged[title].views += parseInt(video.views, 10) || 0;
    const vh = video.view_history || video.viewHistory || {};
    for (const date of Object.keys(vh)) {
      if (!merged[title].viewHistory[date]) merged[title].viewHistory[date] = 0;
      merged[title].viewHistory[date] += parseInt(vh[date], 10) || 0;
    }
  }
  return Object.values(merged);
}

function viewsInRange(video, startDate, endDate) {
  const vh = video.viewHistory || {};
  let sum = 0;
  for (const dateStr of Object.keys(vh)) {
    const d = new Date(dateStr + 'T12:00:00.000Z');
    if (d >= startDate && d <= endDate) {
      sum += parseInt(vh[dateStr], 10) || 0;
    }
  }
  return sum;
}

/** Start des Tages UTC */
function startOfDayUtc(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/** Ende des Tages UTC */
function endOfDayUtc(date) {
  const d = new Date(date);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)
  );
}

/**
 * Für periodDays N: aktueller Block endet heute (UTC), vorheriger Block davor gleiche Länge.
 */
function getPeriodBounds(periodDays, now = new Date()) {
  const endCurrent = endOfDayUtc(now);
  const startCurrent = startOfDayUtc(
    new Date(endCurrent.getTime() - (periodDays - 1) * 24 * 60 * 60 * 1000)
  );
  const endPrevDay = new Date(startCurrent);
  endPrevDay.setUTCDate(endPrevDay.getUTCDate() - 1);
  const endPrev = endOfDayUtc(endPrevDay);
  const startPrev = startOfDayUtc(new Date(endPrev));
  startPrev.setUTCDate(startPrev.getUTCDate() - (periodDays - 1));
  return {
    current: { start: startCurrent, end: endCurrent },
    previous: { start: startPrev, end: endPrev },
  };
}

async function fetchMergedVideos(supabase, adminUserId) {
  const { data: dvData } = await supabase
    .from('device_video_statistics')
    .select(videoSelectFull)
    .eq('admin_user_id', adminUserId)
    .order('views', { ascending: false })
    .limit(400);

  let rows = dvData || [];
  if (rows.length === 0 || !hasMeaningfulHistory(rows)) {
    const { data: vsData } = await supabase
      .from('video_statistics')
      .select(videoSelectFull)
      .eq('admin_user_id', adminUserId)
      .order('views', { ascending: false })
      .limit(400);
    if (vsData && vsData.length > 0 && hasMeaningfulHistory(vsData)) {
      rows = vsData;
    } else if (rows.length === 0) {
      rows = vsData || [];
    }
  }

  return mergeVideosByTitle(
    rows.map((video) => ({
      video_id: video.video_id,
      video_title: video.video_title,
      views: video.views,
      view_history: video.view_history || {},
    }))
  );
}

function comparePercent(current, previous) {
  if (previous === 0 && current === 0) return { pct: 0, direction: 'gleich' };
  if (previous === 0 && current > 0) return { pct: null, direction: 'neu' };
  const pct = ((current - previous) / previous) * 100;
  let direction = 'gleich';
  if (current > previous) direction = 'gestiegen';
  else if (current < previous) direction = 'gesunken';
  return { pct, direction };
}

/**
 * @returns {{ totalCurrent: number, totalPrevious: number, comparison: object, top5: { title: string, views: number }[] }}
 */
async function computeReportForAdmin(supabase, adminUserId, periodDays) {
  const merged = await fetchMergedVideos(supabase, adminUserId);
  const { current, previous } = getPeriodBounds(periodDays);

  let totalCurrent = 0;
  let totalPrevious = 0;
  const perVideoCurrent = [];

  for (const v of merged) {
    const c = viewsInRange(v, current.start, current.end);
    const p = viewsInRange(v, previous.start, previous.end);
    totalCurrent += c;
    totalPrevious += p;
    if (c > 0) {
      perVideoCurrent.push({ title: v.title, views: c });
    }
  }

  perVideoCurrent.sort((a, b) => b.views - a.views);
  const top5 = perVideoCurrent.slice(0, 5);
  const comparison = comparePercent(totalCurrent, totalPrevious);

  return {
    totalCurrent,
    totalPrevious,
    comparison,
    top5,
    periodDays,
    windowCurrent: {
      start: current.start.toISOString().split('T')[0],
      end: current.end.toISOString().split('T')[0],
    },
    windowPrevious: {
      start: previous.start.toISOString().split('T')[0],
      end: previous.end.toISOString().split('T')[0],
    },
  };
}

module.exports = {
  fetchMergedVideos,
  computeReportForAdmin,
  getPeriodBounds,
  mergeVideosByTitle,
  viewsInRange,
};
