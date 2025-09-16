-- Update für video_statistics Tabelle um view_history zu unterstützen
-- Führen Sie dieses SQL in der Supabase SQL Editor aus

-- Füge view_history Spalte hinzu (falls sie noch nicht existiert)
ALTER TABLE public.video_statistics 
ADD COLUMN IF NOT EXISTS view_history JSONB DEFAULT '{}';

-- Erstelle Index für bessere Performance
CREATE INDEX IF NOT EXISTS idx_video_statistics_admin_user_id 
ON public.video_statistics(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_video_statistics_views 
ON public.video_statistics(views DESC);

-- Kommentar hinzufügen
COMMENT ON COLUMN public.video_statistics.view_history IS 'Tägliche Aufruf-Statistiken als JSON-Objekt {date: count}';