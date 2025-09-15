-- Storage policies for aadhar_verify bucket
-- Run these commands in your Supabase SQL editor

-- First, make sure the bucket exists (create if it doesn't)
INSERT INTO storage.buckets (id, name, public)
VALUES ('aadhar_verify', 'aadhar_verify', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the storage.objects table (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow authenticated users to upload Aadhar verification documents
CREATE POLICY "Users can upload Aadhar verification documents" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'aadhar_verify' 
  AND auth.role() = 'authenticated'
);

-- Policy 2: Allow authenticated users to view Aadhar verification documents
CREATE POLICY "Users can view Aadhar verification documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'aadhar_verify' 
  AND auth.role() = 'authenticated'
);

-- Policy 3: Allow users to update their own Aadhar verification documents
CREATE POLICY "Users can update Aadhar verification documents" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'aadhar_verify' 
  AND auth.role() = 'authenticated'
);

-- Policy 4: Allow users to delete their own Aadhar verification documents
CREATE POLICY "Users can delete Aadhar verification documents" ON storage.objects
FOR DELETE USING (
  bucket_id = 'aadhar_verify' 
  AND auth.role() = 'authenticated'
);
