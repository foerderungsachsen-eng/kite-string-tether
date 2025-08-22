/*
  # Add skip_email_verification column to profiles table

  1. Changes
    - Add `skip_email_verification` column to profiles table
    - Set default value to false for all users
    - Add index for better performance
    - Update existing records to have the default value

  2. Security
    - Column is accessible via existing admin policies
    - No changes to RLS policies needed
*/

-- Add skip_email_verification column to profiles table
DO $$ 
BEGIN
    -- Check if column doesn't exist and add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'skip_email_verification'
        AND table_schema = 'public'
    ) THEN
        -- Add the column
        ALTER TABLE public.profiles 
        ADD COLUMN skip_email_verification boolean DEFAULT false;
        
        -- Update all existing records to have the default value
        UPDATE public.profiles 
        SET skip_email_verification = false 
        WHERE skip_email_verification IS NULL;
        
        -- Make the column NOT NULL after setting default values
        ALTER TABLE public.profiles 
        ALTER COLUMN skip_email_verification SET NOT NULL;
        
        -- Create index for better performance
        CREATE INDEX idx_profiles_skip_email_verification 
        ON public.profiles(skip_email_verification);
        
        -- Add comment for documentation
        COMMENT ON COLUMN public.profiles.skip_email_verification 
        IS 'When true, user can login without email verification';
        
    END IF;
END $$;

-- Ensure proper permissions are granted
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO anon;