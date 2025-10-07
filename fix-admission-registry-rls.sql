-- Fix RLS policies for admission_registry table
-- This will allow staff members to create admission registry entries

-- Step 1: Drop existing policies on admission_registry
DROP POLICY IF EXISTS "Staff can manage admission registry" ON admission_registry;

-- Step 2: Create a more permissive policy for authenticated users
CREATE POLICY "allow_authenticated_admission_registry" ON admission_registry
    FOR ALL USING (
        auth.role() = 'authenticated' 
        AND auth.uid() IS NOT NULL
    );

-- Step 3: Allow service role to bypass RLS completely
CREATE POLICY "service_role_bypass_admission_registry" ON admission_registry
    FOR ALL USING (auth.role() = 'service_role');

-- Step 4: Allow anon role for initial setup (temporary)
CREATE POLICY "allow_anon_admission_registry" ON admission_registry
    FOR ALL USING (auth.role() = 'anon');
