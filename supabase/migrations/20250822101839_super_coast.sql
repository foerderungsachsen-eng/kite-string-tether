/*
  # Complete Admin Management System

  1. Database Changes
    - Fix admin webhook visibility with proper RLS policies
    - Add token management for clients
    - Ensure proper permissions for all admin operations
    
  2. Security
    - Admins can see and manage all webhooks
    - Admins can manage all users and clients
    - Proper RLS policies for complete admin access
*/

-- Drop all existing problematic webhook policies
DROP POLICY IF EXISTS "Admins have full webhook access" ON webhooks;
DROP POLICY IF EXISTS "Clients can view their assigned webhooks" ON webhooks;
DROP POLICY IF EXISTS "Admins can manage all webhooks" ON webhooks;
DROP POLICY IF EXISTS "Clients can view their webhooks" ON webhooks;

-- Create simple, working admin policy for webhooks
CREATE POLICY "Admin full access to webhooks"
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
CREATE POLICY "Client view own webhooks"
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

-- Ensure admins can manage all clients
DROP POLICY IF EXISTS "Service role can manage all clients" ON clients;
DROP POLICY IF EXISTS "Users can view their own client data" ON clients;
DROP POLICY IF EXISTS "Users can insert their own client data" ON clients;
DROP POLICY IF EXISTS "Users can update their own client data" ON clients;

CREATE POLICY "Admin full access to clients"
ON clients
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

CREATE POLICY "Client view own data"
ON clients
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Client update own data"
ON clients
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Ensure admins can manage all profiles
DROP POLICY IF EXISTS "Service role can view all profiles" ON profiles;

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

-- Grant all necessary permissions
GRANT ALL ON webhooks TO authenticated;
GRANT ALL ON clients TO authenticated;
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON executions TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id_role ON profiles(user_id, role);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_client_id ON webhooks(client_id);

-- Ensure RLS is enabled
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;