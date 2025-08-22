import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Plus, Settings, Play, Users, Trash2, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Webhook {
  id: string;
  name: string;
  target_url: string;
  method: string;
  is_active: boolean;
  description?: string;
  created_at: string;
  client_id: string;
  webhook_assignments?: { count: number }[];
  assigned_users?: number;
  client_name?: string;
  client_email?: string;
}

interface Client {
  id: string;
  name: string;
  user_id: string;
  email?: string;
}

const Webhooks = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editClientDialogOpen, setEditClientDialogOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWebhooks();
      if (isAdmin) {
        fetchClients();
      }
    }
  }, [user]);

  const fetchClients = async () => {
    try {
      // Get all active clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, user_id')
        .eq('is_active', true)
        .order('name');

      if (clientsError) throw clientsError;

      // Get profile information for each client
      const clientsWithProfiles = await Promise.all(
        (clientsData || []).map(async (client) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('email')
            .eq('user_id', client.user_id)
            .single();

          return {
            id: client.id,
            name: client.name,
            user_id: client.user_id,
            email: profileData?.email || 'No email'
          };
        })
      );

      setClients(clientsWithProfiles);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchWebhooks = async () => {
    if (!user) return;

    try {
      if (isAdmin) {
        // Admins see ALL webhooks - force query without RLS restrictions
        const { data, error } = await supabase
          .from('webhooks')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        console.log('Admin fetched webhooks:', data); // Debug log
        
        // Get client information for each webhook
        const webhooksWithClients = await Promise.all(
          (data || []).map(async (webhook) => {
            try {
              const { data: clientData } = await supabase
                .from('clients')
                .select('name, user_id')
                .eq('id', webhook.client_id)
                .single();
              
              if (clientData) {
                const { data: profileData } = await supabase
                  .from('profiles')
                  .select('email')
                  .eq('user_id', clientData.user_id)
                  .single();
                
                return {
                  ...webhook,
                  client_name: clientData.name,
                  client_email: profileData?.email || 'No email'
                };
              }
              return webhook;
            } catch (error) {
              console.error('Error fetching client data for webhook:', webhook.id, error);
              return webhook;
            }
          })
        );
        
        console.log('Webhooks with client data:', webhooksWithClients); // Debug log
        setWebhooks(webhooksWithClients);
      } else {
        // Regular users see only their assigned webhooks
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!clientData) {
          setWebhooks([]);
          return;
        }

        // Get webhooks for this client
        const { data, error } = await supabase
          .from('webhooks')
          .select('*')
          .eq('client_id', clientData.id)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        setWebhooks(data || []);
      }
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      toast({
        title: "Fehler beim Laden der Webhooks",
        description: `Die Webhooks konnten nicht geladen werden: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteWebhook = async () => {
    if (!selectedWebhook) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', selectedWebhook.id);

      if (error) throw error;

      toast({
        title: "Webhook gelöscht",
        description: `Webhook "${selectedWebhook.name}" wurde erfolgreich gelöscht.`,
      });

      setDeleteDialogOpen(false);
      setSelectedWebhook(null);
      fetchWebhooks(); // Refresh the list
    } catch (error: any) {
      toast({
        title: "Fehler beim Löschen",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const updateWebhookClient = async () => {
    if (!selectedWebhook || !selectedClientId) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('webhooks')
        .update({ client_id: selectedClientId })
        .eq('id', selectedWebhook.id);

      if (error) throw error;

      toast({
        title: "Client geändert",
        description: `Webhook "${selectedWebhook.name}" wurde einem neuen Client zugewiesen.`,
      });

      setEditClientDialogOpen(false);
      setSelectedWebhook(null);
      setSelectedClientId("");
      fetchWebhooks(); // Refresh the list
    } catch (error: any) {
      toast({
        title: "Fehler beim Ändern",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const openDeleteDialog = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setDeleteDialogOpen(true);
  };

  const openEditClientDialog = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setSelectedClientId(webhook.client_id);
    setEditClientDialogOpen(true);
  };

  const executeWebhook = (webhookId: string) => {
    navigate(`/execute/${webhookId}`);
  };

  const manageAssignments = (webhookId: string) => {
    navigate(`/webhooks/${webhookId}/assignments`);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
            <p className="text-muted-foreground">
              {isAdmin ? "Verwalten Sie alle Webhook-Endpunkte" : "Ihre zugewiesenen Webhook-Endpunkte"}
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => navigate('/users')}>
                  <Users className="mr-2 h-4 w-4" />
                  Benutzer
                </Button>
                <Button onClick={() => navigate('/webhooks/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Neuer Webhook
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Debug info for admin */}
        {isAdmin && (
          <div className="text-sm text-muted-foreground">
            Debug: Gefundene Webhooks: {webhooks.length}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        ) : webhooks.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {isAdmin ? "Noch keine Webhooks" : "Keine zugewiesenen Webhooks"}
              </CardTitle>
              <CardDescription>
                {isAdmin 
                  ? "Erstellen Sie Ihren ersten Webhook, um loszulegen."
                  : "Sie haben noch keine Webhooks zugewiesen bekommen. Kontaktieren Sie Ihren Administrator."
                }
              </CardDescription>
            </CardHeader>
            {isAdmin && (
              <CardContent>
                <Button onClick={() => navigate('/webhooks/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ersten Webhook erstellen
                </Button>
              </CardContent>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {webhooks.map((webhook) => (
              <Card key={webhook.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{webhook.name}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant={webhook.is_active ? "default" : "secondary"}>
                        {webhook.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                      {isAdmin && webhook.assigned_users !== undefined && (
                        <Badge variant="outline">
                          {webhook.assigned_users} Benutzer
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {webhook.description || "Keine Beschreibung verfügbar"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-xs break-all">{webhook.target_url}</span>
                    </div>
                    
                    {isAdmin && (webhook as any).client_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary">
                          {(webhook as any).client_name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {(webhook as any).client_email}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{webhook.method}</Badge>
                      <span className="text-muted-foreground">
                        {new Date(webhook.created_at).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                    
                    <div className="flex gap-2 pt-2 flex-wrap">
                      <Button 
                        size="sm" 
                        className={isAdmin ? "" : "flex-1"}
                        onClick={() => navigate(`/execute/${webhook.id}`)}
                        disabled={!webhook.is_active}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Ausführen
                      </Button>
                      {isAdmin && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => manageAssignments(webhook.id)}
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => toast({ title: "Wird bald implementiert", description: "Webhook-Einstellungen kommen in einem zukünftigen Update" })}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Webhook Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Webhook löschen</DialogTitle>
              <DialogDescription>
                Sind Sie sicher, dass Sie den Webhook "{selectedWebhook?.name}" löschen möchten? 
                Diese Aktion kann nicht rückgängig gemacht werden.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button variant="destructive" onClick={deleteWebhook} disabled={isDeleting}>
                {isDeleting ? "Lösche..." : "Löschen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Client Dialog */}
        <Dialog open={editClientDialogOpen} onOpenChange={setEditClientDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Client ändern</DialogTitle>
              <DialogDescription>
                Wählen Sie einen neuen Client für den Webhook "{selectedWebhook?.name}".
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-select">Neuer Client</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Client auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} ({client.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditClientDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={updateWebhookClient} disabled={isUpdating || !selectedClientId}>
                {isUpdating ? "Ändere..." : "Client ändern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Webhooks;