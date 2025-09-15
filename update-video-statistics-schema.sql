-- Update video_statistics table to include view_history and additional fields
-- This adds JSONB column to store daily view counts and additional video metadata

ALTER TABLE public.video_statistics 
ADD COLUMN IF NOT EXISTS view_history JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

-- Add comments to explain the columns
COMMENT ON COLUMN public.video_statistics.view_history IS 'Daily view counts stored as JSONB: {"2024-01-15": 5, "2024-01-16": 3, ...}';
COMMENT ON COLUMN public.video_statistics.created_at IS 'Video creation timestamp from app';
COMMENT ON COLUMN public.video_statistics.updated_at IS 'Video last update timestamp from app';

-- Create index for better performance on view_history queries
CREATE INDEX IF NOT EXISTS idx_video_statistics_view_history 
ON public.video_statistics USING GIN (view_history);

-- Update the updated_at trigger to include the new column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure the trigger exists for video_statistics
DROP TRIGGER IF EXISTS update_video_statistics_updated_at ON public.video_statistics;
CREATE TRIGGER update_video_statistics_updated_at
    BEFORE UPDATE ON public.video_statistics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
