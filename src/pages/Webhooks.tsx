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
import { Separator } from "@/components/ui/separator";

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

interface ClientWithWebhooks {
  id: string;
  name: string;
  user_id: string;
  email?: string;
  webhooks: Webhook[];
}

const Webhooks = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [clientsWithWebhooks, setClientsWithWebhooks] = useState<ClientWithWebhooks[]>([]);
  const [userWebhooks, setUserWebhooks] = useState<Webhook[]>([]);
  const [allClients, setAllClients] = useState<ClientWithWebhooks[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editClientDialogOpen, setEditClientDialogOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editWebhookDialogOpen, setEditWebhookDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    target_url: "",
    method: "POST",
    description: "",
    headers: "{}",
    input_type: "TEXT",
    output_type: "TEXT"
  });
  const [isEditingWebhook, setIsEditingWebhook] = useState(false);

  useEffect(() => {
    if (user) {
      if (isAdmin) {
        fetchAllClientsWithWebhooks();
      } else {
        fetchUserWebhooks();
      }
    }
  }, [user, isAdmin]);

  const fetchAllClientsWithWebhooks = async () => {
    try {
      console.log('Fetching all clients with webhooks...');
      
      // Get all clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, user_id')
        .order('name');

      if (clientsError) throw clientsError;
      console.log('Found clients:', clientsData?.length || 0);

      // Get profile information and webhooks for each client
      const clientsWithWebhooksData = await Promise.all(
        (clientsData || []).map(async (client) => {
          // Get profile info
          const { data: profileData } = await supabase
            .from('profiles')
            .select('email')
            .eq('user_id', client.user_id)
            .single();

          // Get webhooks for this client
          const { data: webhooksData } = await supabase
            .from('webhooks')
            .select('*')
            .eq('client_id', client.id)
            .order('created_at', { ascending: false });

          console.log(`Client ${client.name} has ${webhooksData?.length || 0} webhooks`);

          return {
            id: client.id,
            name: client.name,
            user_id: client.user_id,
            email: profileData?.email || 'No email',
            webhooks: webhooksData || []
          };
        })
      );

      setClientsWithWebhooks(clientsWithWebhooksData);
      setAllClients(clientsWithWebhooksData);
      console.log('Total clients with webhooks:', clientsWithWebhooksData.length);
    } catch (error) {
      console.error('Error fetching clients with webhooks:', error);
      toast({
        title: "Fehler beim Laden",
        description: "Clients und Webhooks konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserWebhooks = async () => {
    if (!user) return;

    try {
      // Regular users see only their assigned webhooks
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!clientData) {
        setUserWebhooks([]);
        return;
      }

      // Get webhooks for this client
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('client_id', clientData.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setUserWebhooks(data || []);
    } catch (error) {
      console.error('Error fetching user webhooks:', error);
      toast({
        title: "Fehler beim Laden der Webhooks",
        description: "Ihre Webhooks konnten nicht geladen werden.",
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
      isAdmin ? fetchAllClientsWithWebhooks() : fetchUserWebhooks(); // Refresh the list
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
      isAdmin ? fetchAllClientsWithWebhooks() : fetchUserWebhooks(); // Refresh the list
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

  const openEditWebhookDialog = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setEditFormData({
      name: webhook.name,
      target_url: webhook.target_url,
      method: webhook.method,
      description: webhook.description || "",
      headers: JSON.stringify(webhook.headers || {}, null, 2),
      input_type: webhook.headers?.input_type || "TEXT",
      output_type: webhook.headers?.output_type || "TEXT"
    });
    setEditWebhookDialogOpen(true);
  };

  const updateWebhook = async () => {
    if (!selectedWebhook) return;

    setIsEditingWebhook(true);
    try {
      // Validate JSON headers
      let parsedHeaders = {};
      try {
        parsedHeaders = JSON.parse(editFormData.headers);
      } catch (error) {
        toast({
          title: "Ungültige Headers",
          description: "Headers müssen gültiges JSON sein",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('webhooks')
        .update({
          name: editFormData.name,
          target_url: editFormData.target_url,
          method: editFormData.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
          description: editFormData.description || null,
          headers: {
            ...parsedHeaders,
            input_type: editFormData.input_type,
            output_type: editFormData.output_type
          }
        })
        .eq('id', selectedWebhook.id);

      if (error) throw error;

      toast({
        title: "Webhook aktualisiert",
        description: `Webhook "${editFormData.name}" wurde erfolgreich aktualisiert.`,
      });

      setEditWebhookDialogOpen(false);
      setSelectedWebhook(null);
      isAdmin ? fetchAllClientsWithWebhooks() : fetchUserWebhooks();
    } catch (error: any) {
      toast({
        title: "Fehler beim Aktualisieren",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsEditingWebhook(false);
    }
  };

  const getTotalWebhooks = () => {
    if (isAdmin) {
      return clientsWithWebhooks.reduce((total, client) => total + client.webhooks.length, 0);
    }
    return userWebhooks.length;
  };

  const filteredClientsWithWebhooks = clientsWithWebhooks.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

        {isAdmin && (
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Klient suchen (Name oder E-Mail)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="text-sm text-muted-foreground">
            Gefundene Clients: {filteredClientsWithWebhooks.length} | Gesamt Webhooks: {getTotalWebhooks()}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        ) : (isAdmin ? getTotalWebhooks() === 0 : userWebhooks.length === 0) ? (
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
          <div className="space-y-8">
            {isAdmin ? (
              // Admin view: Show clients with their webhooks
              filteredClientsWithWebhooks.map((client) => (
                <div key={client.id} className="space-y-4">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold">{client.name}</h2>
                    <Badge variant="outline">{client.email}</Badge>
                    <Badge variant="secondary">{client.webhooks.length} Webhooks</Badge>
                  </div>
                  
                  {client.webhooks.length === 0 ? (
                    <Card>
                      <CardContent className="p-6">
                        <p className="text-muted-foreground text-center">
                          Dieser Client hat noch keine Webhooks
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {client.webhooks.map((webhook) => (
                        <Card key={webhook.id}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{webhook.name}</CardTitle>
                              <div className="flex gap-2">
                                <Badge variant={webhook.is_active ? "default" : "secondary"}>
                                  {webhook.is_active ? "Aktiv" : "Inaktiv"}
                                </Badge>
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
                              
                              <div className="flex items-center gap-2 text-sm">
                                <Badge variant="outline">{webhook.method}</Badge>
                                <span className="text-muted-foreground">
                                  {new Date(webhook.created_at).toLocaleDateString('de-DE')}
                                </span>
                              </div>
                              
                              <div className="flex gap-2 pt-2 flex-wrap">
                                <Button 
                                  size="sm" 
                                  onClick={() => navigate(`/execute/${webhook.id}`)}
                                  disabled={!webhook.is_active}
                                >
                                  <Play className="mr-2 h-4 w-4" />
                                  Ausführen
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => openEditWebhookDialog(webhook)}
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => openEditClientDialog(webhook)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => openDeleteDialog(webhook)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  
                  {client !== clientsWithWebhooks[clientsWithWebhooks.length - 1] && (
                    <Separator className="my-8" />
                  )}
                </div>
              ))
            ) : (
              // Client view: Show only their webhooks
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userWebhooks.map((webhook) => (
                  <Card key={webhook.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{webhook.name}</CardTitle>
                        <Badge variant={webhook.is_active ? "default" : "secondary"}>
                          {webhook.is_active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2">
                        {webhook.description || "Keine Beschreibung verfügbar"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {/* Hide webhook details from clients */}
                        <div className="text-sm text-muted-foreground">
                          Erstellt: {new Date(webhook.created_at).toLocaleDateString('de-DE')}
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          <Button 
                            size="sm" 
                            className="flex-1"
                            onClick={() => navigate(`/execute/${webhook.id}`)}
                            disabled={!webhook.is_active}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Ausführen
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
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
                    {allClients.map((client) => (
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

        {/* Edit Webhook Dialog */}
        <Dialog open={editWebhookDialogOpen} onOpenChange={setEditWebhookDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Webhook bearbeiten</DialogTitle>
              <DialogDescription>
                Bearbeiten Sie die Einstellungen für "{selectedWebhook?.name}".
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    placeholder="Webhook-Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-method">HTTP-Methode</Label>
                  <Select
                    value={editFormData.method}
                    onValueChange={(value) => setEditFormData({ ...editFormData, method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                      <SelectItem value="GET">GET</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-target-url">Ziel-URL</Label>
                <Input
                  id="edit-target-url"
                  type="url"
                  value={editFormData.target_url}
                  onChange={(e) => setEditFormData({ ...editFormData, target_url: e.target.value })}
                  placeholder="https://example.com/webhook"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-description">Beschreibung</Label>
                <Textarea
                  id="edit-description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Optionale Beschreibung"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label>Input-Typ</Label>
                  <RadioGroup
                    value={editFormData.input_type}
                    onValueChange={(value) => setEditFormData({ ...editFormData, input_type: value })}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="TEXT" id="edit-input-text" />
                      <Label htmlFor="edit-input-text">Text</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="FILE" id="edit-input-file" />
                      <Label htmlFor="edit-input-file">Datei</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div className="space-y-3">
                  <Label>Output-Typ</Label>
                  <RadioGroup
                    value={editFormData.output_type}
                    onValueChange={(value) => setEditFormData({ ...editFormData, output_type: value })}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="TEXT" id="edit-output-text" />
                      <Label htmlFor="edit-output-text">Text</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="FILE" id="edit-output-file" />
                      <Label htmlFor="edit-output-file">Datei</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-headers">HTTP-Headers (JSON)</Label>
                <Textarea
                  id="edit-headers"
                  value={editFormData.headers}
                  onChange={(e) => setEditFormData({ ...editFormData, headers: e.target.value })}
                  placeholder='{"Content-Type": "application/json"}'
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditWebhookDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={updateWebhook} disabled={isEditingWebhook}>
                {isEditingWebhook ? "Speichere..." : "Webhook aktualisieren"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Webhooks;