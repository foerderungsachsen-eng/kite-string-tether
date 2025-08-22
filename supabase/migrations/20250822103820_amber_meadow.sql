/*
  # Add skip_email_verification column to profiles table

  1. Changes
    - Add `skip_email_verification` column to profiles table
    - Set default value to false for all existing users
    - Add index for better performance

  2. Security
    - Column is accessible via existing admin policies
    - No changes to RLS policies needed
*/

-- Add skip_email_verification column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS skip_email_verification boolean DEFAULT false NOT NULL;

-- Update all existing records to have the default value
UPDATE public.profiles 
SET skip_email_verification = false 
WHERE skip_email_verification IS NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_skip_email_verification 
ON public.profiles(skip_email_verification);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.skip_email_verification 
IS 'When true, user can login without email verification';

-- Grant necessary permissions
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO anon;