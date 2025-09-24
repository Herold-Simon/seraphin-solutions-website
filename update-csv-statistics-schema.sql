-- Create table for CSV statistics storage
-- This table stores CSV files generated from video statistics

CREATE TABLE IF NOT EXISTS public.csv_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    csv_data TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(admin_user_id, filename)
);

-- Add comments to explain the columns
COMMENT ON TABLE public.csv_statistics IS 'Stores CSV files generated from video statistics for each admin user';
COMMENT ON COLUMN public.csv_statistics.admin_user_id IS 'Reference to admin user who owns the statistics';
COMMENT ON COLUMN public.csv_statistics.filename IS 'Generated filename for the CSV file';
COMMENT ON COLUMN public.csv_statistics.csv_data IS 'The actual CSV content as text';
COMMENT ON COLUMN public.csv_statistics.created_at IS 'When the CSV was first created';
COMMENT ON COLUMN public.csv_statistics.updated_at IS 'When the CSV was last updated';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_csv_statistics_admin_user_id 
ON public.csv_statistics(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_csv_statistics_filename 
ON public.csv_statistics(filename);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_csv_statistics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_csv_statistics_updated_at ON public.csv_statistics;
CREATE TRIGGER update_csv_statistics_updated_at
    BEFORE UPDATE ON public.csv_statistics
    FOR EACH ROW
    EXECUTE FUNCTION update_csv_statistics_updated_at();
