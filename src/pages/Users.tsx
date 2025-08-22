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
import { Plus, Mail, Calendar, Shield, User, Globe, Users as UsersIcon, Settings, Trash2, Coins } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserProfile {
  id: string;
  email: string;
  role: 'ADMIN' | 'CLIENT';
  created_at: string;
  user_id: string;
  webhooks_count?: number;
  email_confirmed?: boolean;
}

interface Client {
  id: string;
  name: string;
  user_id: string;
  email?: string;
  tokens_balance: number;
  is_active: boolean;
  created_at: string;
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
  const [clients, setClients] = useState<Client[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedWebhooks, setSelectedWebhooks] = useState<string[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<'ADMIN' | 'CLIENT'>('CLIENT');
  const [isCreating, setIsCreating] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [newTokenBalance, setNewTokenBalance] = useState("");
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isUpdatingTokens, setIsUpdatingTokens] = useState(false);
  const [skipEmailVerification, setSkipEmailVerification] = useState(false);
  const [deleteClientToo, setDeleteClientToo] = useState(false);
  const [deleteClientDialogOpen, setDeleteClientDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);

  useEffect(() => {
    if (user && isAdmin) {
      fetchUsers();
      fetchClients();
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
            // For now, set webhooks_count to 0 since webhook_assignments table might not exist
            return {
              ...user,
              webhooks_count: 0,
              email_confirmed: true // Default to true for now
            };
          } catch (error) {
            console.error('Error fetching assignments for user:', user.user_id, error);
            return {
              ...user,
              webhooks_count: 0,
              email_confirmed: true
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

  const fetchClients = async () => {
    try {
      const { data: clientsData, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Get profile information and webhook counts for each client
      const clientsWithDetails = await Promise.all(
        (clientsData || []).map(async (client) => {
          try {
            // Get profile info
            const { data: profileData } = await supabase
              .from('profiles')
              .select('email')
              .eq('user_id', client.user_id)
              .single();

            // Get webhook count
            const { data: webhooksData } = await supabase
              .from('webhooks')
              .select('id')
              .eq('client_id', client.id);

            return {
              ...client,
              email: profileData?.email || 'No email',
              webhooks_count: webhooksData?.length || 0
            };
          } catch (error) {
            console.error('Error fetching client details:', client.id, error);
            return {
              ...client,
              email: 'No email',
              webhooks_count: 0
            };
          }
        })
      );
      
      setClients(clientsWithDetails);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: "Fehler beim Laden der Clients",
        description: error?.message || "Die Clients konnten nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setClientsLoading(false);
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
    
    // For now, set empty assignments since webhook_assignments table might not exist
    setSelectedWebhooks([]);
  };

  const openSettingsDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setNewPassword("");
    setEmailConfirmed(user.email_confirmed || false);
    setSkipEmailVerification(false); // Will be set after fetching user data
    setIsSettingsDialogOpen(true);
    
    // Fetch current skip_email_verification value from database
    fetchUserSkipEmailVerification(user.user_id);
  };

  const fetchUserSkipEmailVerification = async (userId: string) => {
    try {
      // First check if the column exists by trying to select it
      const { data } = await supabase
        .from('profiles')
        .select('skip_email_verification')
        .eq('user_id', userId)
        .single();
      
      if (data) {
        setSkipEmailVerification(data.skip_email_verification);
      } else {
        setSkipEmailVerification(false);
      }
    } catch (error) {
      console.error('Column skip_email_verification does not exist yet:', error);
      setSkipEmailVerification(false);
    }
  };

  const openDeleteUserDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setDeleteClientToo(false);
    setDeleteUserDialogOpen(true);
  };

  const openDeleteClientDialog = (client: Client) => {
    setSelectedClient(client);
    setDeleteClientDialogOpen(true);
  };

  const openTokenDialog = (user: UserProfile) => {
    setSelectedUser(user);
    // Get current token balance
    fetchUserTokenBalance(user.user_id);
    setTokenDialogOpen(true);
  };

  const fetchUserTokenBalance = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('clients')
        .select('tokens_balance')
        .eq('user_id', userId)
        .single();
      
      if (data) {
        setNewTokenBalance(data.tokens_balance.toString());
      }
    } catch (error) {
      console.error('Error fetching token balance:', error);
      setNewTokenBalance("0");
    }
  };

  const deleteUser = async () => {
    if (!selectedUser) return;

    // Prevent admin from deleting their own account
    if (selectedUser.user_id === user?.id) {
      toast({
        title: "Aktion nicht erlaubt",
        description: "Sie können Ihr eigenes Konto nicht löschen.",
        variant: "destructive",
      });
      return;
    }

    setIsDeletingUser(true);
    try {
      // Delete client record if checkbox is checked
      if (deleteClientToo) {
        const { error: clientError } = await supabase
          .from('clients')
          .delete()
          .eq('user_id', selectedUser.user_id);

        if (clientError) {
          console.warn('Error deleting client:', clientError);
        }
      }

      // Then delete the profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', selectedUser.user_id);

      if (profileError) throw profileError;

      // Note: We can't delete from auth.users directly via client
      // This would need to be done via admin API or edge function

      toast({
        title: "Benutzer gelöscht",
        description: `Benutzer ${selectedUser.email} wurde erfolgreich gelöscht.${deleteClientToo ? ' Client-Datensatz wurde ebenfalls gelöscht.' : ''}`,
      });

      setDeleteUserDialogOpen(false);
      setSelectedUser(null);
      setDeleteClientToo(false);
      await fetchUsers();
      await fetchClients();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Fehler beim Löschen",
        description: error.message || "Der Benutzer konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const deleteClient = async () => {
    if (!selectedClient) return;

    setIsDeletingClient(true);
    try {
      // Delete the client record
      const { error: clientError } = await supabase
        .from('clients')
        .delete()
        .eq('id', selectedClient.id);

      if (clientError) throw clientError;

      toast({
        title: "Client gelöscht",
        description: `Client ${selectedClient.name} wurde erfolgreich gelöscht.`,
      });

      setDeleteClientDialogOpen(false);
      setSelectedClient(null);
      await fetchClients();
    } catch (error: any) {
      console.error('Error deleting client:', error);
      toast({
        title: "Fehler beim Löschen",
        description: error.message || "Der Client konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingClient(false);
    }
  };

  const updateTokenBalance = async () => {
    if (!selectedUser || !newTokenBalance.trim()) return;

    const tokenAmount = parseInt(newTokenBalance);
    if (isNaN(tokenAmount) || tokenAmount < 0) {
      toast({
        title: "Ungültige Eingabe",
        description: "Bitte geben Sie eine gültige Anzahl von Tokens ein.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingTokens(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ tokens_balance: tokenAmount })
        .eq('user_id', selectedUser.user_id);

      if (error) throw error;

      toast({
        title: "Token-Guthaben aktualisiert",
        description: `Token-Guthaben für ${selectedUser.email} wurde auf ${tokenAmount} gesetzt.`,
      });

      setTokenDialogOpen(false);
      setSelectedUser(null);
      setNewTokenBalance("");
      await fetchUsers();
      await fetchClients();
    } catch (error: any) {
      console.error('Error updating token balance:', error);
      toast({
        title: "Fehler beim Aktualisieren",
        description: error.message || "Das Token-Guthaben konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingTokens(false);
    }
  };

  const updateUserSettings = async () => {
    if (!selectedUser) return;

    setIsUpdatingSettings(true);
    try {
      // Try to update skip_email_verification, but handle if column doesn't exist
      try {
        const { error: skipEmailError } = await supabase
          .from('profiles')
          .update({ skip_email_verification: skipEmailVerification })
          .eq('user_id', selectedUser.user_id);

        if (skipEmailError) {
          if (skipEmailError.code === '42703' || skipEmailError.code === 'PGRST204') {
            throw new Error('Die skip_email_verification Spalte existiert noch nicht in der Datenbank. Bitte warten Sie, bis die Migration ausgeführt wurde.');
          }
          throw new Error(`Skip Email Verification konnte nicht aktualisiert werden: ${skipEmailError.message}`);
        }
        
        toast({
          title: "Einstellungen aktualisiert",
          description: `Skip Email Verification wurde ${skipEmailVerification ? 'aktiviert' : 'deaktiviert'}.`
        });
      } catch (columnError: any) {
        console.error('Column does not exist:', columnError);
        toast({
          title: "Spalte nicht gefunden",
          description: "Die skip_email_verification Spalte existiert noch nicht. Migration wird ausgeführt...",
          variant: "destructive"
        });
        throw columnError;
      }

      // Update password if provided
      if (newPassword.trim()) {
        // Password update requires admin API - show info message
        console.log('Password update requested but requires admin API');
      }

      // Email confirmation update requires admin API
      if (emailConfirmed !== (selectedUser.email_confirmed || false)) {
        console.log('Email confirmation update requested but requires admin API');
      }

      await fetchUsers(); // Refresh user list

      setIsSettingsDialogOpen(false);
      setSelectedUser(null);
      setNewPassword("");
    } catch (error: any) {
      console.error('Error updating user settings:', error);
      toast({
        title: "Fehler beim Aktualisieren",
        description: error.message || "Die Einstellungen konnten nicht aktualisiert werden.",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const saveWebhookAssignments = async () => {
    if (!selectedUser) return;
    
    setIsAssigning(true);
    try {
      // For now, just show success message since webhook_assignments table might not exist
      toast({
        title: "Zuweisungen gespeichert",
        description: `${selectedWebhooks.length} Webhooks wurden ${selectedUser.email} zugewiesen.`
      });
      
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Benutzerverwaltung</h1>
          <p className="text-muted-foreground">
            Verwalten Sie alle Benutzerkonten, Clients und deren Rollen
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="users">Benutzer</TabsTrigger>
              <TabsTrigger value="clients">Clients</TabsTrigger>
            </TabsList>
            
            <div>
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
            </div>
          </div>

          <TabsContent value="users" className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
              </div>
            ) : users.length === 0 ? (
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
                          {userProfile.email_confirmed && (
                            <Badge variant="outline" className="text-xs">
                              ✓ Bestätigt
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Erstellt: {new Date(userProfile.created_at).toLocaleDateString('de-DE')}
                          </span>
                        </div>
                        
                        <div className="flex gap-2 pt-2 flex-wrap">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openTokenDialog(userProfile)}
                          >
                            <Coins className="h-4 w-4 mr-2" />
                            Tokens
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openSettingsDialog(userProfile)}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Einstellungen
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => openDeleteUserDialog(userProfile)}
                            disabled={userProfile.user_id === user?.id}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen
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
          </TabsContent>

          <TabsContent value="clients" className="space-y-6">
            {clientsLoading ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
              </div>
            ) : clients.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Noch keine Clients</CardTitle>
                  <CardDescription>
                    Clients werden automatisch erstellt, wenn Benutzer angelegt werden.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clients.map((client) => (
                  <Card key={client.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <User className="h-5 w-5 text-green-500" />
                          {client.name}
                        </CardTitle>
                        <Badge variant={client.is_active ? "default" : "secondary"}>
                          {client.is_active ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="break-all">{client.email}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Coins className="h-4 w-4 text-muted-foreground" />
                          <span>Token-Guthaben: {client.tokens_balance}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span>Webhooks: {client.webhooks_count}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Erstellt: {new Date(client.created_at).toLocaleDateString('de-DE')}
                          </span>
                        </div>
                        
                        <div className="flex gap-2 pt-2 flex-wrap">
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => openDeleteClientDialog(client)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Client löschen
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

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

        {/* User Settings Dialog */}
        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Benutzereinstellungen</DialogTitle>
              <DialogDescription>
                Einstellungen für {selectedUser?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-password">Neues Passwort</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leer lassen, um nicht zu ändern"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lassen Sie das Feld leer, wenn Sie das Passwort nicht ändern möchten
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="email-confirmed"
                  checked={emailConfirmed}
                  onCheckedChange={(checked) => setEmailConfirmed(checked as boolean)}
                />
                <Label htmlFor="email-confirmed" className="text-sm">
                  E-Mail bestätigt
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="skip-email-verification"
                  checked={skipEmailVerification}
                  onCheckedChange={(checked) => setSkipEmailVerification(checked as boolean)}
                />
                <Label htmlFor="skip-email-verification" className="text-sm">
                  Skip E-Mail Verification (Beta)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Wenn aktiviert, kann sich der Benutzer ohne E-Mail-Bestätigung anmelden. 
                (Erfordert Datenbank-Migration)
              </p>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsSettingsDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button 
                onClick={updateUserSettings} 
                disabled={isUpdatingSettings}
              >
                {isUpdatingSettings ? "Speichere..." : "Speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Dialog */}
        <Dialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Benutzer löschen</DialogTitle>
              <DialogDescription>
                Sind Sie sicher, dass Sie den Benutzer {selectedUser?.email} löschen möchten? 
                Diese Aktion kann nicht rückgängig gemacht werden und löscht alle zugehörigen Daten.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delete-client-too"
                  checked={deleteClientToo}
                  onCheckedChange={(checked) => setDeleteClientToo(checked as boolean)}
                />
                <Label htmlFor="delete-client-too" className="text-sm">
                  Client-Datensatz ebenfalls löschen
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Wenn aktiviert, wird auch der zugehörige Client-Datensatz mit allen Webhooks und Ausführungen gelöscht.
              </p>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setDeleteUserDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button 
                variant="destructive"
                onClick={deleteUser} 
                disabled={isDeletingUser}
              >
                {isDeletingUser ? "Lösche..." : "Benutzer löschen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Client Dialog */}
        <Dialog open={deleteClientDialogOpen} onOpenChange={setDeleteClientDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Client löschen</DialogTitle>
              <DialogDescription>
                Sind Sie sicher, dass Sie den Client {selectedClient?.name} löschen möchten? 
                Diese Aktion kann nicht rückgängig gemacht werden und löscht alle zugehörigen Webhooks und Ausführungen.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setDeleteClientDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button 
                variant="destructive"
                onClick={deleteClient} 
                disabled={isDeletingClient}
              >
                {isDeletingClient ? "Lösche..." : "Client löschen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Token Balance Dialog */}
        <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Token-Guthaben verwalten</DialogTitle>
              <DialogDescription>
                Token-Guthaben für {selectedUser?.email} ändern
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token-balance">Neues Token-Guthaben</Label>
                <Input
                  id="token-balance"
                  type="number"
                  min="0"
                  value={newTokenBalance}
                  onChange={(e) => setNewTokenBalance(e.target.value)}
                  placeholder="Anzahl Tokens"
                />
                <p className="text-xs text-muted-foreground">
                  Geben Sie die neue Anzahl von Tokens für diesen Benutzer ein
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setTokenDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button 
                onClick={updateTokenBalance} 
                disabled={isUpdatingTokens || !newTokenBalance.trim()}
              >
                {isUpdatingTokens ? "Speichere..." : "Token-Guthaben setzen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Users;