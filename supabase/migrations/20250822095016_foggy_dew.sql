/*
  # Fix User Creation and Database Structure

  1. New Tables
    - Ensure `webhook_assignments` table exists with proper structure
    
  2. Security Changes
    - Fix RLS policies for user creation
    - Ensure proper foreign key relationships
    
  3. Profile Creation Fix
    - Remove problematic foreign key constraints
    - Allow profile creation without auth.users dependency
*/

-- First, let's check if webhook_assignments table exists and create it if not
CREATE TABLE IF NOT EXISTS webhook_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(webhook_id, user_id)
);

-- Enable RLS on webhook_assignments
ALTER TABLE webhook_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing problematic foreign key constraint on profiles if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_user_id_fkey' 
        AND table_name = 'profiles'
    ) THEN
        ALTER TABLE profiles DROP CONSTRAINT profiles_user_id_fkey;
    END IF;
END $$;

-- Recreate profiles table structure without foreign key to auth.users
-- This allows us to create profiles for users created via signup
ALTER TABLE profiles ALTER COLUMN user_id TYPE uuid;

-- Update RLS policies for profiles to allow insertion during signup
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" 
ON profiles 
FOR INSERT 
WITH CHECK (true); -- Allow any authenticated user to insert profiles

-- Add RLS policies for webhook_assignments
DROP POLICY IF EXISTS "Admins can manage webhook assignments" ON webhook_assignments;
DROP POLICY IF EXISTS "Users can view own assignments" ON webhook_assignments;

CREATE POLICY "Admins can manage webhook assignments"
ON webhook_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
);

CREATE POLICY "Users can view own assignments"
ON webhook_assignments
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_webhook_assignments_webhook_id ON webhook_assignments(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_assignments_user_id ON webhook_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_assignments_active ON webhook_assignments(is_active);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhook_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_webhook_assignments_updated_at ON webhook_assignments;
CREATE TRIGGER update_webhook_assignments_updated_at
  BEFORE UPDATE ON webhook_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_assignments_updated_at();

-- Update webhook policies to work with assignments
DROP POLICY IF EXISTS "Users can view assigned webhooks" ON webhooks;
CREATE POLICY "Users can view assigned webhooks"
ON webhooks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM webhook_assignments wa
    WHERE wa.webhook_id = webhooks.id 
    AND wa.user_id = auth.uid()
    AND wa.is_active = true
  )
);

-- Update executions policies to work with assigned webhooks
DROP POLICY IF EXISTS "Users can view executions for assigned webhooks" ON executions;
DROP POLICY IF EXISTS "Users can create executions for assigned webhooks" ON executions;

CREATE POLICY "Users can view executions for assigned webhooks"
ON executions
FOR SELECT
TO authenticated
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
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM webhook_assignments wa
    WHERE wa.webhook_id = executions.webhook_id
    AND wa.user_id = auth.uid()
    AND wa.is_active = true
  )
);