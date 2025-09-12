-- Storage policies for profile_picture bucket
-- Run these commands in your Supabase SQL editor

-- First, make sure the bucket exists (create if it doesn't)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile_picture', 'profile_picture', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the storage.objects table (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow authenticated users to upload their own profile pictures
CREATE POLICY "Users can upload their own profile pictures" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profile_picture' 
  AND auth.role() = 'authenticated'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Allow authenticated users to view all profile pictures
CREATE POLICY "Users can view profile pictures" ON storage.objects
FOR SELECT USING (
  bucket_id = 'profile_picture' 
  AND auth.role() = 'authenticated'
);

-- Policy 3: Allow users to update their own profile pictures
CREATE POLICY "Users can update their own profile pictures" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profile_picture' 
  AND auth.role() = 'authenticated'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Allow users to delete their own profile pictures
CREATE POLICY "Users can delete their own profile pictures" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profile_picture' 
  AND auth.role() = 'authenticated'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Alternative simpler policy if the above doesn't work:
-- This allows all authenticated users to upload to the profile_picture bucket
-- Uncomment the lines below if the above policies don't work

/*
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can view profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile pictures" ON storage.objects;

-- Create simpler policies
CREATE POLICY "Authenticated users can upload profile pictures" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profile_picture' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can view profile pictures" ON storage.objects
FOR SELECT USING (
  bucket_id = 'profile_picture' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update profile pictures" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profile_picture' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete profile pictures" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profile_picture' 
  AND auth.role() = 'authenticated'
);
*/
