/*
  # Add Client-Profile Relationship

  1. Database Changes
    - Add foreign key constraint between clients.user_id and profiles.user_id
    - Ensure proper relationship for Supabase queries
    
  2. Security
    - Maintain existing RLS policies
    - No changes to permissions
*/

-- Add foreign key constraint from clients.user_id to profiles.user_id
-- This will allow Supabase to understand the relationship between tables
ALTER TABLE clients 
ADD CONSTRAINT clients_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

-- Create index for better performance on the foreign key
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);