import { useEffect, useState } from "react";
+import { supabase } from "@/integrations/supabase/client";
+import { useAuth } from "@/hooks/useAuth";
+import { toast } from "@/hooks/use-toast";
+import { Layout } from "@/components/Layout";
+import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
+import { Button } from "@/components/ui/button";
+import { Badge } from "@/components/ui/badge";
+import { Input } from "@/components/ui/input";
+import { Label } from "@/components/ui/label";
+import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
+import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
+import { Plus, Mail, Calendar, Shield, User } from "lucide-react";
+import { useNavigate } from "react-router-dom";
+
+interface UserProfile {
+  id: string;
+  email: string;
+  role: 'ADMIN' | 'CLIENT';
+  created_at: string;
+  user_id: string;
+}
+
+const Users = () => {
+  const { user, isAdmin } = useAuth();
+  const navigate = useNavigate();
+  const [users, setUsers] = useState<UserProfile[]>([]);
+  const [loading, setLoading] = useState(true);
+  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
+  const [newUserEmail, setNewUserEmail] = useState("");
+  const [newUserRole, setNewUserRole] = useState<'ADMIN' | 'CLIENT'>('CLIENT');
+  const [isCreating, setIsCreating] = useState(false);
+
+  useEffect(() => {
+    if (!isAdmin) {
+      navigate('/');
+      return;
+    }
+    if (user) {
+      fetchUsers();
+    }
+  }, [user, isAdmin, navigate]);
+
+  const fetchUsers = async () => {
+    try {
+      const { data, error } = await supabase
+        .from('profiles')
+        .select('*')
+        .order('created_at', { ascending: false });
+
+      if (error) throw error;
+      setUsers(data || []);
+    } catch (error) {
+      console.error('Error fetching users:', error);
+      toast({
+        title: "Fehler beim Laden der Benutzer",
+        description: "Die Benutzer konnten nicht geladen werden.",
+        variant: "destructive"
+      });
+    } finally {
+      setLoading(false);
+    }
+  };
+
+  const createUser = async () => {
+    if (!newUserEmail.trim()) {
+      toast({
+        title: "E-Mail erforderlich",
+        description: "Bitte geben Sie eine E-Mail-Adresse ein.",
+        variant: "destructive"
+      });
+      return;
+    }
+
+    setIsCreating(true);
+    try {
+      // Create user in Supabase Auth
+      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
+        email: newUserEmail,
+        password: Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8), // Generate random password
+        email_confirm: true
+      });
+
+      if (authError) throw authError;
+
+      // Create profile
+      const { error: profileError } = await supabase
+        .from('profiles')
+        .insert({
+          user_id: authData.user.id,
+          email: newUserEmail,
+          role: newUserRole
+        });
+
+      if (profileError) throw profileError;
+
+      toast({
+        title: "Benutzer erstellt",
+        description: `Benutzer ${newUserEmail} wurde erfolgreich erstellt.`
+      });
+
+      setNewUserEmail("");
+      setNewUserRole('CLIENT');
+      setIsCreateDialogOpen(false);
+      fetchUsers();
+    } catch (error: any) {
+      console.error('Error creating user:', error);
+      toast({
+        title: "Fehler beim Erstellen des Benutzers",
+        description: error.message || "Der Benutzer konnte nicht erstellt werden.",
+        variant: "destructive"
+      });
+    } finally {
+      setIsCreating(false);
+    }
+  };
+
+  if (!isAdmin) {
+    return null;
+  }
+
+  return (
+    <Layout>
+      <div className="space-y-6">
+        <div className="flex items-center justify-between">
+          <div>
+            <h1 className="text-3xl font-bold tracking-tight">Benutzer</h1>
+            <p className="text-muted-foreground">
+              Verwalten Sie alle Benutzerkonten und deren Rollen
+            </p>
+          </div>
+          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
+            <DialogTrigger asChild>
+              <Button>
+                <Plus className="mr-2 h-4 w-4" />
+                Neuer Benutzer
+              </Button>
+            </DialogTrigger>
+            <DialogContent>
+              <DialogHeader>
+                <DialogTitle>Neuen Benutzer erstellen</DialogTitle>
+                <DialogDescription>
+                  Erstellen Sie ein neues Benutzerkonto. Der Benutzer erhält eine E-Mail mit den Anmeldedaten.
+                </DialogDescription>
+              </DialogHeader>
+              <div className="space-y-4">
+                <div>
+                  <Label htmlFor="email">E-Mail-Adresse</Label>
+                  <Input
+                    id="email"
+                    type="email"
+                    value={newUserEmail}
+                    onChange={(e) => setNewUserEmail(e.target.value)}
+                    placeholder="benutzer@beispiel.de"
+                  />
+                </div>
+                <div>
+                  <Label htmlFor="role">Rolle</Label>
+                  <Select value={newUserRole} onValueChange={(value: 'ADMIN' | 'CLIENT') => setNewUserRole(value)}>
+                    <SelectTrigger>
+                      <SelectValue />
+                    </SelectTrigger>
+                    <SelectContent>
+                      <SelectItem value="CLIENT">Client</SelectItem>
+                      <SelectItem value="ADMIN">Administrator</SelectItem>
+                    </SelectContent>
+                  </Select>
+                </div>
+              </div>
+              <DialogFooter>
+                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
+                  Abbrechen
+                </Button>
+                <Button onClick={createUser} disabled={isCreating}>
+                  {isCreating ? "Erstelle..." : "Benutzer erstellen"}
+                </Button>
+              </DialogFooter>
+            </DialogContent>
+          </Dialog>
+        </div>
+
+        {loading ? (
+          <div className="flex items-center justify-center h-96">
+            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
+          </div>
+        ) : users.length === 0 ? (
+          <Card>
+            <CardHeader>
+              <CardTitle>Noch keine Benutzer</CardTitle>
+              <CardDescription>
+                Erstellen Sie den ersten Benutzer, um loszulegen.
+              </CardDescription>
+            </CardHeader>
+            <CardContent>
+              <Button onClick={() => setIsCreateDialogOpen(true)}>
+                <Plus className="mr-2 h-4 w-4" />
+                Ersten Benutzer erstellen
+              </Button>
+            </CardContent>
+          </Card>
+        ) : (
+          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
+            {users.map((userProfile) => (
+              <Card key={userProfile.id}>
+                <CardHeader>
+                  <div className="flex items-center justify-between">
+                    <CardTitle className="text-lg flex items-center gap-2">
+                      {userProfile.role === 'ADMIN' ? (
+                        <Shield className="h-5 w-5 text-orange-500" />
+                      ) : (
+                        <User className="h-5 w-5 text-blue-500" />
+                      )}
+                      {userProfile.email}
+                    </CardTitle>
+                    <Badge variant={userProfile.role === 'ADMIN' ? "default" : "secondary"}>
+                      {userProfile.role === 'ADMIN' ? 'Administrator' : 'Client'}
+                    </Badge>
+                  </div>
+                </CardHeader>
+                <CardContent>
+                  <div className="space-y-3">
+                    <div className="flex items-center gap-2 text-sm">
+                      <Mail className="h-4 w-4 text-muted-foreground" />
+                      <span className="break-all">{userProfile.email}</span>
+                    </div>
+                    
+                    <div className="flex items-center gap-2 text-sm">
+                      <Calendar className="h-4 w-4 text-muted-foreground" />
+                      <span className="text-muted-foreground">
+                        Erstellt: {new Date(userProfile.created_at).toLocaleDateString('de-DE')}
+                      </span>
+                    </div>
+                    
+                    <div className="flex gap-2 pt-2">
+                      <Button 
+                        size="sm" 
+                        variant="outline"
+                        onClick={() => navigate(`/users/${userProfile.user_id}/webhooks`)}
+                      >
+                        Webhooks verwalten
+                      </Button>
+                    </div>
+                  </div>
+                </CardContent>
+              </Card>
+            ))}
+          </div>
+        )}
+      </div>
+    </Layout>
+  );
+};
+
+export default Users;
+