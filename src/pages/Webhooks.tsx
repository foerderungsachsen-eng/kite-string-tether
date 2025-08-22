import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Globe, Edit, Trash2, Play, Settings, Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Webhook {
  id: string;
  name: string;
  description: string | null;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: any;
  input_type: 'TEXT' | 'FILE';
  output_type: 'TEXT' | 'FILE';
  is_active: boolean;
  tokens_cost: number;
  created_at: string;
  client_id: string;
}

const Webhooks = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    url: '',
    method: 'POST' as 'GET' | 'POST' | 'PUT' | 'DELETE',
    headers: '{}',
    input_type: 'TEXT' as 'TEXT' | 'FILE',
    output_type: 'TEXT' as 'TEXT' | 'FILE',
    tokens_cost: 1,
    is_active: true
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWebhooks();
    }
  }, [user, isAdmin]);

  const fetchWebhooks = async () => {
    if (!user) return;

    setLoading(true);
    try {
      if (isAdmin) {
        // Admin can see all webhooks
        const { data: webhooksData, error } = await supabase
          .from('webhooks')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setWebhooks(webhooksData || []);
      } else {
        // Get client data first for regular users
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (clientError) {
          console.error('Client data error:', clientError);
          throw clientError;
        }

        if (!clientData) {
          console.log('No client data found for user:', user.id);
          setWebhooks([]);
          return;
        }

        // Get webhooks for this client
        const { data: webhooksData, error: webhooksError } = await supabase
          .from('webhooks')
          .select('*')
          .eq('client_id', clientData.id)
          .order('created_at', { ascending: false });

        if (webhooksError) {
          console.error('Client webhooks error:', webhooksError);
          throw webhooksError;
        }

        console.log('Found webhooks for client:', webhooksData?.length || 0);
        setWebhooks(webhooksData || []);
      }
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      toast({
        title: "Fehler beim Laden der Webhooks",
        description: (error && typeof error.message === 'string') ? error.message : "Die Webhooks konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setEditForm({
      name: webhook.name,
      description: webhook.description || '',
      url: webhook.url,
      method: webhook.method,
      headers: JSON.stringify(webhook.headers, null, 2),
      input_type: webhook.input_type,
      output_type: webhook.output_type,
      tokens_cost: webhook.tokens_cost,
      is_active: webhook.is_active
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setDeleteDialogOpen(true);
  };

  const updateWebhook = async () => {
    if (!selectedWebhook) return;

    setIsUpdating(true);
    try {
      let headers;
      try {
        headers = JSON.parse(editForm.headers);
      } catch {
        throw new Error('Headers müssen gültiges JSON sein');
      }

      const { error } = await supabase
        .from('webhooks')
        .update({
          name: editForm.name,
          description: editForm.description || null,
          url: editForm.url,
          method: editForm.method,
          headers: headers,
          input_type: editForm.input_type,
          output_type: editForm.output_type,
          tokens_cost: editForm.tokens_cost,
          is_active: editForm.is_active
        })
        .eq('id', selectedWebhook.id);

      if (error) throw error;

      toast({
        title: "Webhook aktualisiert",
        description: `${editForm.name} wurde erfolgreich aktualisiert.`,
      });

      setEditDialogOpen(false);
      setSelectedWebhook(null);
      await fetchWebhooks();
    } catch (error) {
      console.error('Error updating webhook:', error);
      toast({
        title: "Fehler beim Aktualisieren",
        description: (error && typeof error.message === 'string') ? error.message : "Der Webhook konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
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
        description: `${selectedWebhook.name} wurde erfolgreich gelöscht.`,
      });

      setDeleteDialogOpen(false);
      setSelectedWebhook(null);
      await fetchWebhooks();
    } catch (error) {
      console.error('Error deleting webhook:', error);
      toast({
        title: "Fehler beim Löschen",
        description: (error && typeof error.message === 'string') ? error.message : "Der Webhook konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const executeWebhook = (webhookId: string) => {
    navigate(`/execute/${webhookId}`);
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
            <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
            <p className="text-muted-foreground">
              {isAdmin ? "Verwalten Sie alle Webhooks" : "Ihre verfügbaren Webhooks"}
            </p>
          </div>
          
          {isAdmin && (
            <Button onClick={() => navigate('/webhooks/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Neuer Webhook
            </Button>
          )}
        </div>

        {webhooks.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {isAdmin ? "Noch keine Webhooks" : "Keine Webhooks zugewiesen"}
              </CardTitle>
              <CardDescription>
                {isAdmin 
                  ? "Erstellen Sie den ersten Webhook, um loszulegen."
                  : "Es wurden Ihnen noch keine Webhooks zugewiesen. Kontaktieren Sie Ihren Administrator."
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
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Globe className="h-5 w-5 text-blue-500" />
                      {webhook.name}
                    </CardTitle>
                    <Badge variant={webhook.is_active ? "default" : "secondary"}>
                      {webhook.is_active ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </div>
                  {webhook.description && (
                    <CardDescription>{webhook.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{webhook.method}</Badge>
                      <Badge variant="outline">{webhook.input_type}</Badge>
                      <Badge variant="outline">{webhook.output_type}</Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Coins className="h-4 w-4 text-muted-foreground" />
                      <span>{webhook.tokens_cost} Token{webhook.tokens_cost !== 1 ? 's' : ''}</span>
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      Erstellt: {new Date(webhook.created_at).toLocaleDateString('de-DE')}
                    </div>
                    
                    <div className="flex gap-2 pt-2 flex-wrap">
                      <Button 
                        size="sm" 
                        onClick={() => executeWebhook(webhook.id)}
                        disabled={!webhook.is_active}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Ausführen
                      </Button>
                      
                      {isAdmin && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openEditDialog(webhook)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Bearbeiten
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => openDeleteDialog(webhook)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen
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

        {/* Edit Webhook Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Webhook bearbeiten</DialogTitle>
              <DialogDescription>
                Bearbeiten Sie die Webhook-Einstellungen
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Webhook Name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-tokens-cost">Token-Kosten</Label>
                  <Input
                    id="edit-tokens-cost"
                    type="number"
                    min="1"
                    value={editForm.tokens_cost}
                    onChange={(e) => setEditForm(prev => ({ ...prev, tokens_cost: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-description">Beschreibung</Label>
                <Input
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optionale Beschreibung"
                />
              </div>

              <div>
                <Label htmlFor="edit-url">URL</Label>
                <Input
                  id="edit-url"
                  value={editForm.url}
                  onChange={(e) => setEditForm(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://example.com/webhook"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit-method">HTTP Methode</Label>
                  <Select value={editForm.method} onValueChange={(value: 'GET' | 'POST' | 'PUT' | 'DELETE') => setEditForm(prev => ({ ...prev, method: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-input-type">Input Typ</Label>
                  <Select value={editForm.input_type} onValueChange={(value: 'TEXT' | 'FILE') => setEditForm(prev => ({ ...prev, input_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEXT">Text</SelectItem>
                      <SelectItem value="FILE">Datei</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-output-type">Output Typ</Label>
                  <Select value={editForm.output_type} onValueChange={(value: 'TEXT' | 'FILE') => setEditForm(prev => ({ ...prev, output_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEXT">Text</SelectItem>
                      <SelectItem value="FILE">Datei</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="edit-headers">Headers (JSON)</Label>
                <Textarea
                  id="edit-headers"
                  value={editForm.headers}
                  onChange={(e) => setEditForm(prev => ({ ...prev, headers: e.target.value }))}
                  placeholder='{"Content-Type": "application/json"}'
                  rows={4}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-is-active"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm(prev => ({ ...prev, is_active: e.target.checked }))}
                />
                <Label htmlFor="edit-is-active">Webhook aktiv</Label>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={updateWebhook} disabled={isUpdating}>
                {isUpdating ? "Speichere..." : "Speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Webhook löschen</AlertDialogTitle>
              <AlertDialogDescription>
                Sind Sie sicher, dass Sie den Webhook "{selectedWebhook?.name}" löschen möchten? 
                Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction 
                onClick={deleteWebhook}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Lösche..." : "Löschen"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default Webhooks;