-- Simple storage policies for profile_picture bucket
-- Run these commands in your Supabase SQL editor

-- Step 1: Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile_picture', 'profile_picture', true)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop any existing policies for this bucket
DROP POLICY IF EXISTS "Users can upload their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can view profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete profile pictures" ON storage.objects;

-- Step 4: Create new simple policies
CREATE POLICY "Allow authenticated users to upload profile pictures" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profile_picture' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to view profile pictures" ON storage.objects
FOR SELECT USING (
  bucket_id = 'profile_picture' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to update profile pictures" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profile_picture' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to delete profile pictures" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profile_picture' 
  AND auth.role() = 'authenticated'
);

-- Step 5: Verify the bucket exists and is public
SELECT * FROM storage.buckets WHERE id = 'profile_picture';


