/*
  # Fix Executions RLS Policies

  1. Security Changes
    - Fix RLS policies for executions table to allow proper access
    - Allow clients to create executions for their webhooks
    - Allow clients to view their own executions
    - Allow admins to view all executions
    
  2. Policy Updates
    - Drop existing problematic policies
    - Create working policies for both read and write access
*/

-- Drop all existing execution policies to start fresh
DROP POLICY IF EXISTS "Admins can view all executions" ON executions;
DROP POLICY IF EXISTS "Users can view executions for assigned webhooks" ON executions;
DROP POLICY IF EXISTS "Users can create executions for assigned webhooks" ON executions;

-- Create simple, working policies for executions

-- Admins can do everything with executions
CREATE POLICY "Admin full access to executions"
ON executions
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

-- Clients can view their own executions
CREATE POLICY "Client view own executions"
ON executions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = executions.client_id 
    AND clients.user_id = auth.uid()
  )
);

-- Clients can create executions for their own webhooks
CREATE POLICY "Client create own executions"
ON executions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients c
    JOIN webhooks w ON w.client_id = c.id
    WHERE c.user_id = auth.uid()
    AND w.id = executions.webhook_id
    AND c.id = executions.client_id
  )
);

-- Grant necessary permissions
GRANT ALL ON executions TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE executions ENABLE ROW LEVEL SECURITY;