-- Create the customer-files storage bucket
-- Run this in your Supabase SQL Editor

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-files', 'customer-files', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket
-- Allow authenticated users to read/write files
CREATE POLICY "Allow authenticated users to upload files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'customer-files');

CREATE POLICY "Allow authenticated users to view files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'customer-files');

CREATE POLICY "Allow authenticated users to update files" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'customer-files');

CREATE POLICY "Allow authenticated users to delete files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'customer-files');

-- Allow public access to files (since we're using public URLs)
CREATE POLICY "Allow public access to files" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'customer-files');

-- Grant necessary permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO public;
