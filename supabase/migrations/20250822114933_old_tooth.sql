/*
  # Fix Client-Profile Relationship

  1. Database Changes
    - Add foreign key constraint between clients.user_id and profiles.user_id
    - Ensure proper relationship for Supabase queries
    
  2. Security
    - Maintain existing RLS policies
    - No changes to permissions
*/

-- Add foreign key constraint from clients.user_id to profiles.user_id
-- This will allow Supabase to understand the relationship between tables
DO $$ 
BEGIN
    -- Check if the foreign key constraint doesn't already exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'clients_user_id_profiles_fkey' 
        AND table_name = 'clients'
    ) THEN
        ALTER TABLE clients 
        ADD CONSTRAINT clients_user_id_profiles_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index for better performance on the foreign key
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);

-- Grant necessary permissions
GRANT SELECT ON clients TO authenticated;
GRANT SELECT ON profiles TO authenticated;