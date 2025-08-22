/*
  # Admin Webhook Management System

  1. New Tables
    - `webhook_assignments` - Links webhooks to specific users
    
  2. Security Changes
    - Update RLS policies to restrict webhook creation to admins only
    - Allow users to only see webhooks assigned to them
    - Admins can see and manage all webhooks
    
  3. Changes to existing tables
    - Add admin check functions
    - Update webhook policies
*/

-- Create webhook assignments table
CREATE TABLE IF NOT EXISTS webhook_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE(webhook_id, user_id)
);

-- Enable RLS on webhook assignments
ALTER TABLE webhook_assignments ENABLE ROW LEVEL SECURITY;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = $1 AND profiles.role = 'ADMIN'
  );
$$;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT is_admin(auth.uid());
$$;

-- Drop existing webhook policies
DROP POLICY IF EXISTS "Users can view their own webhooks" ON webhooks;
DROP POLICY IF EXISTS "Users can create webhooks" ON webhooks;
DROP POLICY IF EXISTS "Users can update their own webhooks" ON webhooks;
DROP POLICY IF EXISTS "Users can delete their own webhooks" ON webhooks;

-- New webhook policies - only admins can create/manage webhooks
CREATE POLICY "Admins can manage all webhooks"
ON webhooks
FOR ALL
USING (is_current_user_admin());

CREATE POLICY "Users can view assigned webhooks"
ON webhooks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM webhook_assignments wa
    WHERE wa.webhook_id = webhooks.id 
    AND wa.user_id = auth.uid()
    AND wa.is_active = true
  )
);

-- Webhook assignments policies
CREATE POLICY "Admins can manage webhook assignments"
ON webhook_assignments
FOR ALL
USING (is_current_user_admin());

CREATE POLICY "Users can view their assignments"
ON webhook_assignments
FOR SELECT
USING (user_id = auth.uid());

-- Update executions policies to work with assigned webhooks
DROP POLICY IF EXISTS "Users can view their own executions" ON executions;
DROP POLICY IF EXISTS "Users can create executions" ON executions;

CREATE POLICY "Admins can view all executions"
ON executions
FOR SELECT
USING (is_current_user_admin());

CREATE POLICY "Users can view executions for assigned webhooks"
ON executions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM webhook_assignments wa
    WHERE wa.webhook_id = executions.webhook_id
    AND wa.user_id = auth.uid()
    AND wa.is_active = true
  )
);

CREATE POLICY "Users can create executions for assigned webhooks"
ON executions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM webhook_assignments wa
    WHERE wa.webhook_id = executions.webhook_id
    AND wa.user_id = auth.uid()
    AND wa.is_active = true
  )
);

-- Create default admin user (you'll need to update this with actual admin user ID)
-- This is just a placeholder - you should update it with the actual admin user ID
-- INSERT INTO profiles (user_id, email, role) 
-- VALUES ('your-admin-user-id', 'admin@example.com', 'ADMIN')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'ADMIN';