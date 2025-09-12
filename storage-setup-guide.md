# Supabase Storage Setup Guide

## Method 1: Using Supabase Dashboard (Recommended)

### Step 1: Create the Bucket
1. Go to your **Supabase Dashboard**
2. Navigate to **Storage** → **Buckets**
3. Click **"New bucket"**
4. Set:
   - **Name**: `profile_picture`
   - **Public**: ✅ **Yes** (check this box)
   - **File size limit**: 50MB (or your preference)
   - **Allowed MIME types**: `image/*` (optional)

### Step 2: Set Up Storage Policies
1. Go to **Storage** → **Policies**
2. Find the `profile_picture` bucket
3. Click **"New Policy"** and create these 4 policies:

#### Policy 1: Upload Policy
- **Policy name**: `Allow authenticated users to upload profile pictures`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
bucket_id = 'profile_picture'
```

#### Policy 2: View Policy
- **Policy name**: `Allow authenticated users to view profile pictures`
- **Allowed operation**: `SELECT`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
bucket_id = 'profile_picture'
```

#### Policy 3: Update Policy
- **Policy name**: `Allow authenticated users to update profile pictures`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
bucket_id = 'profile_picture'
```

#### Policy 4: Delete Policy
- **Policy name**: `Allow authenticated users to delete profile pictures`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
bucket_id = 'profile_picture'
```

## Method 2: Using Supabase CLI (If you have it installed)

```bash
# Create bucket
supabase storage create profile_picture --public

# Set policies (run these one by one)
supabase storage policy create profile_picture "Allow authenticated users to upload profile pictures" --operation INSERT --role authenticated --definition "bucket_id = 'profile_picture'"

supabase storage policy create profile_picture "Allow authenticated users to view profile pictures" --operation SELECT --role authenticated --definition "bucket_id = 'profile_picture'"

supabase storage policy create profile_picture "Allow authenticated users to update profile pictures" --operation UPDATE --role authenticated --definition "bucket_id = 'profile_picture'"

supabase storage policy create profile_picture "Allow authenticated users to delete profile pictures" --operation DELETE --role authenticated --definition "bucket_id = 'profile_picture'"
```

## Method 3: Alternative - Use a Different Bucket Name

If you're still having issues, try using the default `avatars` bucket:

1. Create a bucket named `avatars` (public)
2. Update the frontend code to use `avatars` instead of `profile_picture`

## Verification Steps

After setting up the policies:

1. **Check bucket exists**: Storage → Buckets → `profile_picture` should be listed
2. **Check bucket is public**: The bucket should show "Public" status
3. **Check policies**: Storage → Policies → Should show 4 policies for `profile_picture`
4. **Test upload**: Try uploading an avatar in your app

## Troubleshooting

### If upload still fails:
1. Check browser console for detailed error messages
2. Verify user is authenticated (check Supabase Auth)
3. Try uploading a smaller image file (< 1MB)
4. Check if the bucket has file size limits

### If policies don't work:
1. Make sure the bucket is **public**
2. Verify the user role is `authenticated`
3. Try creating policies with more permissive rules temporarily for testing


