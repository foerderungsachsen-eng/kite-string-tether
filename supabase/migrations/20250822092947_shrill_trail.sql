@@ .. @@
 CREATE POLICY "Users can update their own profile" 
 ON public.profiles 
 FOR UPDATE 
 USING (auth.uid() = user_id);
 
+-- Allow users to insert their own profile during signup
+CREATE POLICY "Users can insert their own profile" 
+ON public.profiles 
+FOR INSERT 
+WITH CHECK (auth.uid() = user_id);
+
 -- Create a separate admin policy that doesn't reference profiles table
 CREATE POLICY "Service role can view all profiles" 
 ON public.profiles 
 FOR ALL 
 USING (auth.role() = 'service_role');
 
+-- Add RLS policies for clients table
+CREATE POLICY "Users can view their own client data" 
+ON public.clients 
+FOR SELECT 
+USING (auth.uid() = user_id);
+
+CREATE POLICY "Users can insert their own client data" 
+ON public.clients 
+FOR INSERT 
+WITH CHECK (auth.uid() = user_id);
+
+CREATE POLICY "Users can update their own client data" 
+ON public.clients 
+FOR UPDATE 
+USING (auth.uid() = user_id);
+
+CREATE POLICY "Service role can manage all clients" 
+ON public.clients 
+FOR ALL 
+USING (auth.role() = 'service_role');
+
 -- Ensure RLS is enabled on all tables
 ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;