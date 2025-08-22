/*
  # Fix Webhook Visibility Issues

  1. Security Changes
    - Update RLS policies to allow admins to see all webhooks
    - Allow clients to see their own webhooks
    - Fix webhook assignment policies
    
  2. Policy Updates
    - Admins can view/manage all webhooks
    - Clients can view webhooks assigned to their client_id
*/

-- Drop existing problematic webhook policies
DROP POLICY IF EXISTS "Admins can manage all webhooks" ON webhooks;
DROP POLICY IF EXISTS "Users can view assigned webhooks" ON webhooks;
DROP POLICY IF EXISTS "Admins can manage webhook assignments" ON webhook_assignments;
DROP POLICY IF EXISTS "Users can view own assignments" ON webhook_assignments;

-- Create new webhook policies that work properly
CREATE POLICY "Admins can manage all webhooks"
ON webhooks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
);

CREATE POLICY "Clients can view their webhooks"
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

-- Create webhook assignment policies if table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_assignments') THEN
        -- Admins can manage all assignments
        CREATE POLICY "Admins can manage all webhook assignments"
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
        CREATE POLICY "Users can view their webhook assignments"
        ON webhook_assignments
        FOR SELECT
        TO authenticated
        USING (user_id = auth.uid());
    END IF;
END $$;

-- Ensure RLS is enabled on all tables
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT ON webhooks TO authenticated;
GRANT INSERT ON webhooks TO authenticated;
GRANT UPDATE ON webhooks TO authenticated;
GRANT DELETE ON webhooks TO authenticated;