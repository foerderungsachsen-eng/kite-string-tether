/*
  # Fix Admin Webhook Access and Management

  1. Security Changes
    - Fix RLS policies to ensure admins can see ALL webhooks
    - Add proper delete permissions for admins
    - Ensure webhook management works correctly
    
  2. Policy Updates
    - Simplify admin policies to avoid conflicts
    - Ensure clients can see their assigned webhooks
*/

-- Drop all existing webhook policies to start fresh
DROP POLICY IF EXISTS "Admins can manage all webhooks" ON webhooks;
DROP POLICY IF EXISTS "Clients can view their webhooks" ON webhooks;
DROP POLICY IF EXISTS "Users can view assigned webhooks" ON webhooks;
DROP POLICY IF EXISTS "Admins can manage webhook assignments" ON webhook_assignments;
DROP POLICY IF EXISTS "Users can view own assignments" ON webhook_assignments;

-- Create simple, working admin policy
CREATE POLICY "Admins have full webhook access"
ON webhooks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
);

-- Create client policy for viewing their webhooks
CREATE POLICY "Clients can view their assigned webhooks"
ON webhooks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = webhooks.client_id 
    AND clients.user_id = auth.uid()
  )
);

-- Ensure RLS is enabled
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- Grant all necessary permissions to authenticated users
GRANT ALL ON webhooks TO authenticated;
GRANT ALL ON clients TO authenticated;
GRANT ALL ON profiles TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_webhooks_client_id ON webhooks(client_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id_role ON profiles(user_id, role);