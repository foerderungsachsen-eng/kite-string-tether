/*
  # Add skip_email_verification column to profiles table

  1. Changes
    - Add `skip_email_verification` column to profiles table
    - Set default value to false
    - Add index for better performance

  2. Security
    - No changes to RLS policies needed
    - Column is accessible via existing admin policies
*/

-- Add skip_email_verification column to profiles table
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

-- Update the types to include the new column
COMMENT ON COLUMN profiles.skip_email_verification IS 'Allow user to login without email verification when true';