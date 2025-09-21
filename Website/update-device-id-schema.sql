-- Update Schema: Add device_id column to admin_users table
-- Run this in Supabase SQL Editor

-- Add device_id column to admin_users table
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_admin_users_device_id ON public.admin_users(device_id);

-- Add comment to document the column
COMMENT ON COLUMN public.admin_users.device_id IS 'Device ID from the app for identifying which device the statistics come from';
