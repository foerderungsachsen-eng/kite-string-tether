import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Mail, Calendar, Shield, User, Globe, Users as UsersIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UserProfile {
  id: string;
  email: string;
  role: 'ADMIN' | 'CLIENT';
  created_at: string;
  user_id: string;
  webhooks_count?: number;
}

interface Webhook {
  id: string;
  name: string;
  is_active: boolean;
}

const Users = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedWebhooks, setSelectedWebhooks] = useState<string[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<'ADMIN' | 'CLIENT'>('CLIENT');
  const [isCreating, setIsCreating] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (user && isAdmin) {
      fetchUsers();
      fetchWebhooks();
    }
  }, [user, isAdmin]);

  // Don't redirect non-admins, just show access denied message
  if (!isAdmin && user) {
    return (
      <Layout>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Zugriff verweigert</CardTitle>
              <CardDescription>
                Nur Administratoren können Benutzer verwalten.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/')}>
                Zurück zum Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }
  const fetchUsers = async () => {
    try {
      const { data: usersData, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Get webhook assignment counts for each user
      const usersWithCounts = await Promise.all(
        (usersData || []).map(async (user) => {
          try {
            const { data: assignments } = await supabase
              .from('webhook_assignments')
              .select('id')
              .eq('user_id', user.user_id)
              .eq('is_active', true);
            
            return {
              ...user,
              webhooks_count: assignments?.length || 0
            };
          } catch (error) {
            console.error('Error fetching assignments for user:', user.user_id, error);
            return {
              ...user,
              webhooks_count: 0
            };
          }
        })
      );
      
      setUsers(usersWithCounts);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Fehler beim Laden der Benutzer",
        description: error?.message || "Die Benutzer konnten nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWebhooks = async () => {
    try {
      const { data, error } = await supabase
        .from('webhooks')
        .select('id, name, is_active')
        .order('name');

      if (error) throw error;
      setWebhooks(data || []);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      toast({
        title: "Fehler beim Laden der Webhooks",
        description: "Die Webhooks konnten nicht geladen werden.",
        variant: "destructive"
      });
    }
  };

  const createUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim()) {
      toast({
        title: "Felder erforderlich",
        description: "Bitte geben Sie E-Mail und Passwort ein.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    try {
      // Use regular signup instead of admin.createUser
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            email_confirm: false
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Wait a moment for the user to be fully created
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: authData.user.id,
            email: newUserEmail,
            role: newUserRole
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          throw new Error(`Profil konnte nicht erstellt werden: ${profileError.message}`);
        }

        // Create client record
        const { error: clientError } = await supabase
          .from('clients')
          .insert({
            user_id: authData.user.id,
            name: newUserEmail.split('@')[0],
            tokens_balance: 100
          });

        if (clientError) {
          console.error('Client creation error:', clientError);
          throw new Error(`Client-Datensatz konnte nicht erstellt werden: ${clientError.message}`);
        }
      }

      toast({
        title: "Benutzer erstellt",
        description: `Benutzer ${newUserEmail} wurde erfolgreich erstellt.`
      });

      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole('CLIENT');
      setIsCreateDialogOpen(false);
      await fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: "Fehler beim Erstellen des Benutzers",
        description: error?.message || "Der Benutzer konnte nicht erstellt werden.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const openAssignDialog = async (user: UserProfile) => {
    setSelectedUser(user);
    setIsAssignDialogOpen(true);
    
    try {
      // Get current assignments for this user
      const { data: assignments } = await supabase
        .from('webhook_assignments')
        .select('webhook_id')
        .eq('user_id', user.user_id)
        .eq('is_active', true);
      
      setSelectedWebhooks(assignments?.map(a => a.webhook_id) || []);
    } catch (error) {
      console.error('Error fetching user assignments:', error);
      setSelectedWebhooks([]);
    }
  };

  const saveWebhookAssignments = async () => {
    if (!selectedUser) return;
    
    setIsAssigning(true);
    try {
      // First, deactivate all current assignments for this user
      await supabase
        .from('webhook_assignments')
        .update({ is_active: false })
        .eq('user_id', selectedUser.user_id);
      
      // Then create new assignments for selected webhooks
      if (selectedWebhooks.length > 0) {
        const assignments = selectedWebhooks.map(webhookId => ({
          webhook_id: webhookId,
          user_id: selectedUser.user_id,
          assigned_by: user?.id,
          is_active: true
        }));
        
        const { error } = await supabase
          .from('webhook_assignments')
          .upsert(assignments, {
            onConflict: 'webhook_id,user_id'
          });
        
        if (error) throw error;
      }
      
      toast({
        title: "Zuweisungen gespeichert",
        description: `${selectedWebhooks.length} Webhooks wurden ${selectedUser.email} zugewiesen.`
      });
      
      // Refresh users list to update counts
      await fetchUsers();
      setIsAssignDialogOpen(false);
      setSelectedUser(null);
      setSelectedWebhooks([]);
    } catch (error: any) {
      console.error('Error saving assignments:', error);
      toast({
        title: "Fehler beim Speichern",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const toggleWebhookSelection = (webhookId: string) => {
    setSelectedWebhooks(prev => 
      prev.includes(webhookId)
        ? prev.filter(id => id !== webhookId)
        : [...prev, webhookId]
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Benutzer</h1>
            <p className="text-muted-foreground">
              Verwalten Sie alle Benutzerkonten und deren Rollen
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Neuer Benutzer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neuen Benutzer erstellen</DialogTitle>
                <DialogDescription>
                  Erstellen Sie ein neues Benutzerkonto. Der Benutzer erhält eine E-Mail mit den Anmeldedaten.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">E-Mail-Adresse</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="benutzer@beispiel.de"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Passwort</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Sicheres Passwort"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Rolle</Label>
                  <Select value={newUserRole} onValueChange={(value: 'ADMIN' | 'CLIENT') => setNewUserRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLIENT">Client</SelectItem>
                      <SelectItem value="ADMIN">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={createUser} disabled={isCreating}>
                  {isCreating ? "Erstelle..." : "Benutzer erstellen"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Webhook Assignment Dialog */}
          <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Webhooks zuweisen</DialogTitle>
                <DialogDescription>
                  Wählen Sie Webhooks für {selectedUser?.email} aus
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {webhooks.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">
                    Keine Webhooks verfügbar
                  </p>
                ) : (
                  webhooks.map((webhook) => (
                    <div key={webhook.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`webhook-${webhook.id}`}
                        checked={selectedWebhooks.includes(webhook.id)}
                        onChange={() => toggleWebhookSelection(webhook.id)}
                        className="rounded border-gray-300"
                      />
                      <Label 
                        htmlFor={`webhook-${webhook.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span>{webhook.name}</span>
                          <Badge variant={webhook.is_active ? "default" : "secondary"}>
                            {webhook.is_active ? "Aktiv" : "Inaktiv"}
                          </Badge>
                        </div>
                      </Label>
                    </div>
                  ))
                )}
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsAssignDialogOpen(false)}
                >
                  Abbrechen
                </Button>
                <Button 
                  onClick={saveWebhookAssignments} 
                  disabled={isAssigning}
                >
                  {isAssigning ? "Speichere..." : "Speichern"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {users.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Noch keine Benutzer</CardTitle>
              <CardDescription>
                Erstellen Sie den ersten Benutzer, um loszulegen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Ersten Benutzer erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map((userProfile) => (
              <Card key={userProfile.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {userProfile.role === 'ADMIN' ? (
                        <Shield className="h-5 w-5 text-orange-500" />
                      ) : (
                        <User className="h-5 w-5 text-blue-500" />
                      )}
                      {userProfile.email}
                    </CardTitle>
                    <Badge variant={userProfile.role === 'ADMIN' ? "default" : "secondary"}>
                      {userProfile.role === 'ADMIN' ? 'Administrator' : 'Client'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="break-all">{userProfile.email}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Erstellt: {new Date(userProfile.created_at).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        onClick={() => openAssignDialog(userProfile)}
                      >
                        <Globe className="h-4 w-4 mr-2" />
                        Webhooks ({userProfile.webhooks_count || 0})
                      </Button>
                      {userProfile.role === 'CLIENT' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => navigate(`/execute-user/${userProfile.user_id}`)}
                        >
                          <UsersIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Users;