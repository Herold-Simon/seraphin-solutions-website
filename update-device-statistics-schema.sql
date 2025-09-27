-- Update Schema: Add device-specific statistics tables
-- Run this in Supabase SQL Editor

-- 1. Device Statistics Table (für geräte-spezifische App-Statistiken)
CREATE TABLE IF NOT EXISTS public.device_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    total_videos INTEGER DEFAULT 0,
    videos_with_views INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    total_floors INTEGER DEFAULT 0,
    total_rooms INTEGER DEFAULT 0,
    pie_chart_video_count INTEGER DEFAULT 0,
    line_chart_video_count INTEGER DEFAULT 0,
    bar_chart_video_count INTEGER DEFAULT 0,
    line_race_video_count INTEGER DEFAULT 0,
    time_range_start TIMESTAMP WITH TIME ZONE,
    time_range_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique combination of admin_user_id, device_id, and date
    UNIQUE(admin_user_id, device_id, date)
);

-- 2. Device Video Statistics Table (für geräte-spezifische Video-Statistiken)
CREATE TABLE IF NOT EXISTS public.device_video_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    video_title TEXT,
    views INTEGER DEFAULT 0,
    last_viewed TIMESTAMP WITH TIME ZONE,
    view_history JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique combination of admin_user_id, device_id, and video_id
    UNIQUE(admin_user_id, device_id, video_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_device_statistics_admin_user_id ON public.device_statistics(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_device_statistics_device_id ON public.device_statistics(device_id);
CREATE INDEX IF NOT EXISTS idx_device_statistics_date ON public.device_statistics(date);
CREATE INDEX IF NOT EXISTS idx_device_statistics_admin_device_date ON public.device_statistics(admin_user_id, device_id, date);

CREATE INDEX IF NOT EXISTS idx_device_video_statistics_admin_user_id ON public.device_video_statistics(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_device_video_statistics_device_id ON public.device_video_statistics(device_id);
CREATE INDEX IF NOT EXISTS idx_device_video_statistics_video_id ON public.device_video_statistics(video_id);
CREATE INDEX IF NOT EXISTS idx_device_video_statistics_admin_device_video ON public.device_video_statistics(admin_user_id, device_id, video_id);

-- Add comments to document the tables
COMMENT ON TABLE public.device_statistics IS 'Device-specific app statistics for multi-device account management';
COMMENT ON TABLE public.device_video_statistics IS 'Device-specific video statistics for multi-device account management';

-- Enable Row Level Security
ALTER TABLE public.device_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_video_statistics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for device statistics
DROP POLICY IF EXISTS "Device statistics are viewable by related admin" ON public.device_statistics;
CREATE POLICY "Device statistics are viewable by related admin" ON public.device_statistics
    FOR SELECT USING (true); -- For API access

DROP POLICY IF EXISTS "Device statistics can be updated by related admin" ON public.device_statistics;
CREATE POLICY "Device statistics can be updated by related admin" ON public.device_statistics
    FOR ALL USING (true); -- For API access

-- RLS Policies for device video statistics
DROP POLICY IF EXISTS "Device video statistics are viewable by related admin" ON public.device_video_statistics;
CREATE POLICY "Device video statistics are viewable by related admin" ON public.device_video_statistics
    FOR SELECT USING (true); -- For API access

DROP POLICY IF EXISTS "Device video statistics can be updated by related admin" ON public.device_video_statistics;
CREATE POLICY "Device video statistics can be updated by related admin" ON public.device_video_statistics
    FOR ALL USING (true); -- For API access

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_device_statistics_updated_at ON public.device_statistics;
CREATE TRIGGER update_device_statistics_updated_at
    BEFORE UPDATE ON public.device_statistics
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_device_video_statistics_updated_at ON public.device_video_statistics;
CREATE TRIGGER update_device_video_statistics_updated_at
    BEFORE UPDATE ON public.device_video_statistics
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get aggregated statistics across all devices for an admin user
CREATE OR REPLACE FUNCTION public.get_aggregated_device_statistics(
    p_admin_user_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_videos BIGINT,
    videos_with_views BIGINT,
    total_views BIGINT,
    total_floors BIGINT,
    total_rooms BIGINT,
    pie_chart_video_count BIGINT,
    line_chart_video_count BIGINT,
    bar_chart_video_count BIGINT,
    line_race_video_count BIGINT,
    device_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(ds.total_videos), 0) as total_videos,
        COALESCE(SUM(ds.videos_with_views), 0) as videos_with_views,
        COALESCE(SUM(ds.total_views), 0) as total_views,
        COALESCE(SUM(ds.total_floors), 0) as total_floors,
        COALESCE(SUM(ds.total_rooms), 0) as total_rooms,
        COALESCE(SUM(ds.pie_chart_video_count), 0) as pie_chart_video_count,
        COALESCE(SUM(ds.line_chart_video_count), 0) as line_chart_video_count,
        COALESCE(SUM(ds.bar_chart_video_count), 0) as bar_chart_video_count,
        COALESCE(SUM(ds.line_race_video_count), 0) as line_race_video_count,
        COUNT(DISTINCT ds.device_id) as device_count
    FROM public.device_statistics ds
    WHERE ds.admin_user_id = p_admin_user_id 
    AND ds.date = p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get aggregated video statistics across all devices for an admin user
CREATE OR REPLACE FUNCTION public.get_aggregated_device_video_statistics(
    p_admin_user_id UUID
)
RETURNS TABLE (
    video_id TEXT,
    video_title TEXT,
    total_views BIGINT,
    device_count BIGINT,
    last_viewed TIMESTAMP WITH TIME ZONE,
    aggregated_by_title BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH video_aggregation AS (
        -- Aggregiere Videos nach video_id (nicht nach Titel) um alle Videos einzeln zu behalten
        SELECT 
            dvs.video_id,
            dvs.video_title,
            COALESCE(SUM(dvs.views), 0) as total_views,
            COUNT(DISTINCT dvs.device_id) as device_count,
            MAX(dvs.last_viewed) as last_viewed,
            false as aggregated_by_title
        FROM public.device_video_statistics dvs
        WHERE dvs.admin_user_id = p_admin_user_id
        GROUP BY dvs.video_id, dvs.video_title
    )
    SELECT 
        va.video_id,
        va.video_title,
        va.total_views,
        va.device_count,
        va.last_viewed,
        va.aggregated_by_title
    FROM video_aggregation va
    ORDER BY va.total_views DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
