/*
  # Create webhook assignments system

  1. New Tables
    - `webhook_assignments`
      - `id` (uuid, primary key)
      - `webhook_id` (uuid, foreign key to webhooks)
      - `user_id` (uuid, foreign key to auth.users)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `webhook_assignments` table
    - Add policies for admins to manage assignments
    - Add policies for users to view their assignments

  3. Changes
    - Create junction table for many-to-many relationship between webhooks and users
    - Add proper foreign key constraints
    - Add unique constraint to prevent duplicate assignments
*/

CREATE TABLE IF NOT EXISTS webhook_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(webhook_id, user_id)
);

ALTER TABLE webhook_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can manage all assignments
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

-- Users can view their own assignments
CREATE POLICY "Users can view own assignments"
  ON webhook_assignments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create index for better performance
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
CREATE TRIGGER update_webhook_assignments_updated_at
  BEFORE UPDATE ON webhook_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_assignments_updated_at();