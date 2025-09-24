-- Update Schema: Add device_sessions table for multi-device account management
-- Run this in Supabase SQL Editor

-- Create device_sessions table for managing multiple devices per account
CREATE TABLE IF NOT EXISTS public.device_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique device_id per admin_user_id
    UNIQUE(admin_user_id, device_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_device_sessions_admin_user_id ON public.device_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_device_id ON public.device_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_last_active ON public.device_sessions(last_active);
CREATE INDEX IF NOT EXISTS idx_device_sessions_is_active ON public.device_sessions(is_active);

-- Add comment to document the table
COMMENT ON TABLE public.device_sessions IS 'Manages multiple device sessions per admin account for multi-device statistics tracking';

-- Enable Row Level Security
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy for device sessions
CREATE POLICY "Device sessions are manageable by related admin" ON public.device_sessions
    FOR ALL USING (true); -- For API access

-- Add trigger for updated_at
CREATE TRIGGER update_device_sessions_updated_at
    BEFORE UPDATE ON public.device_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to cleanup inactive device sessions (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_inactive_device_sessions()
RETURNS void AS $$
BEGIN
    UPDATE public.device_sessions 
    SET is_active = false 
    WHERE last_active < NOW() - INTERVAL '30 days' AND is_active = true;
    
    -- Optionally delete very old sessions (older than 90 days)
    DELETE FROM public.device_sessions 
    WHERE last_active < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update device session activity
CREATE OR REPLACE FUNCTION public.update_device_activity(
    p_admin_user_id UUID,
    p_device_id TEXT,
    p_device_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    session_id UUID;
BEGIN
    -- Try to update existing session
    UPDATE public.device_sessions 
    SET 
        last_active = NOW(),
        device_name = COALESCE(p_device_name, device_name),
        is_active = true,
        updated_at = NOW()
    WHERE admin_user_id = p_admin_user_id AND device_id = p_device_id
    RETURNING id INTO session_id;
    
    -- If no existing session, create new one
    IF session_id IS NULL THEN
        INSERT INTO public.device_sessions (admin_user_id, device_id, device_name, last_active, is_active)
        VALUES (p_admin_user_id, p_device_id, p_device_name, NOW(), true)
        RETURNING id INTO session_id;
    END IF;
    
    RETURN session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
