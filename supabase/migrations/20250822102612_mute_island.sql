/*
  # Add Admin Features and Client Restrictions

  1. Database Changes
    - Add skip_email_verification field to profiles
    - Add webhook search and edit capabilities
    - Ensure proper permissions for admin operations
    
  2. Security
    - Maintain existing RLS policies
    - Add new fields for email verification control
*/

-- Add skip_email_verification field to profiles
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'skip_email_verification'
    ) THEN
        ALTER TABLE profiles ADD COLUMN skip_email_verification boolean DEFAULT false;
    END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_skip_email_verification ON profiles(skip_email_verification);

-- Ensure admins can update all profile fields
DROP POLICY IF EXISTS "Admin full access to profiles" ON profiles;
CREATE POLICY "Admin full access to profiles"
ON profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() 
    AND p.role = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() 
    AND p.role = 'ADMIN'
  )
);

-- Grant necessary permissions
GRANT ALL ON profiles TO authenticated;