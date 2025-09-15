-- Erweiterte Supabase-Schema für Account-System und Statistiken
-- Erstellen Sie diese Tabellen in der Supabase SQL Editor

-- 1. Admin-Benutzer Tabelle (für App-Admin-Panel)
CREATE TABLE public.admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    full_name TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Website-Benutzer Tabelle (für Website-Login)
CREATE TABLE public.website_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    full_name TEXT,
    admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. App-Statistiken Tabelle
CREATE TABLE public.app_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE,
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Video-Statistiken (detailliert)
CREATE TABLE public.video_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE,
    video_id TEXT NOT NULL,
    video_title TEXT,
    views INTEGER DEFAULT 0,
    last_viewed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Floor-Statistiken
CREATE TABLE public.floor_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE,
    floor_id TEXT NOT NULL,
    floor_name TEXT,
    room_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Website-Sessions
CREATE TABLE public.website_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.website_users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indizes für bessere Performance
CREATE INDEX idx_admin_users_username ON public.admin_users(username);
CREATE INDEX idx_website_users_username ON public.website_users(username);
CREATE INDEX idx_website_users_admin_user_id ON public.website_users(admin_user_id);
CREATE INDEX idx_app_statistics_admin_user_id ON public.app_statistics(admin_user_id);
CREATE INDEX idx_app_statistics_date ON public.app_statistics(date);
CREATE INDEX idx_video_statistics_admin_user_id ON public.video_statistics(admin_user_id);
CREATE INDEX idx_video_statistics_video_id ON public.video_statistics(video_id);
CREATE INDEX idx_floor_statistics_admin_user_id ON public.floor_statistics(admin_user_id);
CREATE INDEX idx_floor_statistics_floor_id ON public.floor_statistics(floor_id);
CREATE INDEX idx_website_sessions_token ON public.website_sessions(session_token);
CREATE INDEX idx_website_sessions_expires_at ON public.website_sessions(expires_at);

-- Row Level Security (RLS) aktivieren
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies für Admin-Benutzer
CREATE POLICY "Admin users can view own data" ON public.admin_users
    FOR ALL USING (true); -- Für API-Zugriff

-- RLS Policies für Website-Benutzer
CREATE POLICY "Website users can view own data" ON public.website_users
    FOR SELECT USING (true); -- Für API-Zugriff

CREATE POLICY "Website users can update own data" ON public.website_users
    FOR UPDATE USING (true); -- Für API-Zugriff

-- RLS Policies für Statistiken
CREATE POLICY "Statistics are viewable by related admin" ON public.app_statistics
    FOR SELECT USING (true); -- Für API-Zugriff

CREATE POLICY "Statistics can be updated by related admin" ON public.app_statistics
    FOR ALL USING (true); -- Für API-Zugriff

CREATE POLICY "Video statistics are viewable by related admin" ON public.video_statistics
    FOR SELECT USING (true); -- Für API-Zugriff

CREATE POLICY "Video statistics can be updated by related admin" ON public.video_statistics
    FOR ALL USING (true); -- Für API-Zugriff

CREATE POLICY "Floor statistics are viewable by related admin" ON public.floor_statistics
    FOR SELECT USING (true); -- Für API-Zugriff

CREATE POLICY "Floor statistics can be updated by related admin" ON public.floor_statistics
    FOR ALL USING (true); -- Für API-Zugriff

-- RLS Policies für Sessions
CREATE POLICY "Sessions are manageable by related user" ON public.website_sessions
    FOR ALL USING (true); -- Für API-Zugriff

-- Funktionen für automatische Updates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger für updated_at
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON public.admin_users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_website_users_updated_at
    BEFORE UPDATE ON public.website_users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_app_statistics_updated_at
    BEFORE UPDATE ON public.app_statistics
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_video_statistics_updated_at
    BEFORE UPDATE ON public.video_statistics
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_floor_statistics_updated_at
    BEFORE UPDATE ON public.floor_statistics
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Funktion für automatische Website-Benutzer-Erstellung
CREATE OR REPLACE FUNCTION public.create_website_user_for_admin()
RETURNS TRIGGER AS $$
BEGIN
    -- Erstelle automatisch einen Website-Benutzer für jeden Admin-Benutzer
    INSERT INTO public.website_users (username, password_hash, admin_user_id)
    VALUES (NEW.username, NEW.password_hash, NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger für automatische Website-Benutzer-Erstellung
CREATE TRIGGER create_website_user_trigger
    AFTER INSERT ON public.admin_users
    FOR EACH ROW EXECUTE FUNCTION public.create_website_user_for_admin();

-- Funktion zum Löschen abgelaufener Sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM public.website_sessions 
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
