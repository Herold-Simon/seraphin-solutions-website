-- Update video_statistics table to include view_history
-- This adds a JSONB column to store daily view counts

ALTER TABLE public.video_statistics 
ADD COLUMN IF NOT EXISTS view_history JSONB DEFAULT '{}';

-- Add comment to explain the column
COMMENT ON COLUMN public.video_statistics.view_history IS 'Daily view counts stored as JSONB: {"2024-01-15": 5, "2024-01-16": 3, ...}';

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
