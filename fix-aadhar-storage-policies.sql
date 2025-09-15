-- Fix Aadhar storage bucket policies
-- This will create proper policies for the aadhar_verify bucket

-- Step 1: Ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('aadhar_verify', 'aadhar_verify', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Step 2: Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop any existing policies on storage.objects for aadhar_verify
DROP POLICY IF EXISTS "aadhar_verify_upload" ON storage.objects;
DROP POLICY IF EXISTS "aadhar_verify_view" ON storage.objects;
DROP POLICY IF EXISTS "aadhar_verify_update" ON storage.objects;
DROP POLICY IF EXISTS "aadhar_verify_delete" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload Aadhar verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view Aadhar verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update Aadhar verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete Aadhar verification documents" ON storage.objects;

-- Step 4: Create simple, permissive policies for aadhar_verify bucket
-- Allow authenticated users to upload
CREATE POLICY "aadhar_verify_upload" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'aadhar_verify' 
    AND auth.role() = 'authenticated'
);

-- Allow authenticated users to view
CREATE POLICY "aadhar_verify_view" ON storage.objects
FOR SELECT USING (
    bucket_id = 'aadhar_verify' 
    AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update
CREATE POLICY "aadhar_verify_update" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'aadhar_verify' 
    AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete
CREATE POLICY "aadhar_verify_delete" ON storage.objects
FOR DELETE USING (
    bucket_id = 'aadhar_verify' 
    AND auth.role() = 'authenticated'
);

-- Step 5: Allow service role to bypass all restrictions
CREATE POLICY "service_role_bypass_storage" ON storage.objects
FOR ALL USING (auth.role() = 'service_role');

-- Step 6: Allow anon role for initial setup (temporary)
CREATE POLICY "anon_storage_access" ON storage.objects
FOR ALL USING (auth.role() = 'anon');

-- Step 7: Show confirmation
SELECT 'Aadhar storage policies created successfully' as status;
SELECT 'Bucket: aadhar_verify is now public and accessible' as bucket_status;
