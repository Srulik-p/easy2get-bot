-- Create customer_submissions table
CREATE TABLE IF NOT EXISTS customer_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  form_type TEXT NOT NULL,
  form_type_label TEXT NOT NULL,
  submitted_fields JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in-progress', 'completed')),
  first_sent_at TIMESTAMP WITH TIME ZONE,
  last_interaction_at TIMESTAMP WITH TIME ZONE,
  last_reminder_sent_at TIMESTAMP WITH TIME ZONE,
  reminder_count INTEGER DEFAULT 0,
  reminder_paused BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(phone_number, form_type)
);

-- Create uploaded_files table
CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES customer_submissions(id) ON DELETE CASCADE,
  field_slug TEXT NOT NULL,
  field_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_submissions_phone ON customer_submissions(phone_number);
CREATE INDEX IF NOT EXISTS idx_customer_submissions_form_type ON customer_submissions(form_type);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_submission_id ON uploaded_files(submission_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_field_slug ON uploaded_files(field_slug);

-- Create storage bucket for customer files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-files',
  'customer-files',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- Create RLS policies
ALTER TABLE customer_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;

-- Policy for customer_submissions - allow all operations for now (you may want to restrict this)
CREATE POLICY "Allow all operations on customer_submissions" ON customer_submissions
  FOR ALL USING (true);

-- Policy for uploaded_files - allow all operations for now (you may want to restrict this)
CREATE POLICY "Allow all operations on uploaded_files" ON uploaded_files
  FOR ALL USING (true);

-- Storage policies for customer-files bucket
CREATE POLICY "Allow file uploads to customer-files bucket" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'customer-files');

CREATE POLICY "Allow file access from customer-files bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'customer-files');

CREATE POLICY "Allow file updates to customer-files bucket" ON storage.objects
  FOR UPDATE USING (bucket_id = 'customer-files');

CREATE POLICY "Allow file deletions from customer-files bucket" ON storage.objects
  FOR DELETE USING (bucket_id = 'customer-files');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_customer_submissions_updated_at
  BEFORE UPDATE ON customer_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration: Add status column to existing table (if it doesn't exist)
ALTER TABLE customer_submissions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in-progress', 'completed'));

-- Update existing records to have 'in-progress' status if they have submitted fields
UPDATE customer_submissions 
SET status = CASE 
  WHEN jsonb_array_length(submitted_fields) = 0 THEN 'new'
  ELSE 'in-progress'
END 
WHERE status IS NULL;

-- Migration: Add reminder tracking columns to existing table (if they don't exist)
ALTER TABLE customer_submissions 
ADD COLUMN IF NOT EXISTS first_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reminder_paused BOOLEAN DEFAULT FALSE;

-- Initialize last_interaction_at for existing records that have submitted fields
UPDATE customer_submissions 
SET last_interaction_at = updated_at 
WHERE last_interaction_at IS NULL AND jsonb_array_length(submitted_fields) > 0;