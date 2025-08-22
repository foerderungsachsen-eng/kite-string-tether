@@ .. @@
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
+
+-- Grant necessary permissions to authenticated role
+GRANT SELECT ON public.webhook_assignments TO authenticated;
+GRANT INSERT ON public.webhook_assignments TO authenticated;
+GRANT UPDATE ON public.webhook_assignments TO authenticated;
+GRANT DELETE ON public.webhook_assignments TO authenticated;